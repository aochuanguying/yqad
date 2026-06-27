import { IAudiApi, Post } from '../api/types';
import { AuthService } from './auth';
import { PostParser } from './post-parser';
import { CommentAnalyzer, PostFeatures } from './comment-analyzer';
import { generateComment, CommentGenerationOptions } from '../ai/content-generator';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { sleep, randomDelay } from '../utils/retry';
import { getCommentHistoryStorage, CreateCommentHistoryInput } from '../storage/mysql/comment-history-storage';
import { getCommentLogStorage, CreateCommentLogInput } from '../storage/mysql/comment-log-storage';

const logger = getLogger('auto-comment');

interface CommentRecord {
  postId: string;
  commentId: string;
  content: string;
  timestamp: string;
  publishTime?: string;    // 帖子原始发布时间
  postTitle?: string;      // 帖子标题（兜底模式用）
  postContent?: string;    // 帖子内容摘要（兜底模式用）
  contentType?: string;    // 帖子类型（兜底模式用）
}

export interface CommentResult {
  success: boolean;
  postId: string;
  postTitle: string;
  commentId?: string;
  error?: string;
}

/**
 * 评论日志记录接口
 */
interface CommentLogEntry {
  timestamp: string;           // 评论时间
  postId: string;              // 帖子 ID
  postTitle: string;           // 帖子标题
  postContent?: string;        // 帖子内容摘要
  contentType?: string;        // 帖子类型
  commentContent: string;      // 评论内容
  commentId?: string;          // 评论 ID
  success: boolean;            // 是否成功
  error?: string;              // 错误信息
  mode: 'normal' | 'fallback'; // 评论模式：正常/兜底
  source: 'auto' | 'manual';   // 执行来源：自动调度/手工执行
  publishTime?: string;        // 帖子发布时间
}

export class AutoCommentService {
  private api: IAudiApi;
  private authService: AuthService;
  private postParser: PostParser;
  private commentHistory: CommentRecord[] = [];
  private commentHistoryStorage = getCommentHistoryStorage();
  private commentLogStorage = getCommentLogStorage();

  constructor(api: IAudiApi, authService: AuthService) {
    this.api = api;
    this.authService = authService;
    this.postParser = new PostParser();
  }

  /**
   * 执行单条评论（立即评论功能）
   * 只评论 1 条，不启动调度
   */
  async performSingleComment(): Promise<CommentResult[]> {
    const config = loadConfig();
    const results: CommentResult[] = [];

    // 获取 1 篇帖子
    const allPosts = await this.fetchPostsWithPaging();
    
    // 排除已评论过的帖子
    let commentedPostIds = new Set<string>();
    try {
      commentedPostIds = await this.commentHistoryStorage.getCommentedPostIds();
    } catch (error: any) {
      logger.warn(`获取已评论帖子失败：${error.message}`);
    }
    const unCommentedPosts = allPosts.filter(p => !commentedPostIds.has(p.id));
    
    if (unCommentedPosts.length === 0) {
      logger.warn('立即评论：所有帖子均已评论过');
      return results;
    }

    // 只选最新的 1 篇
    const targetPost = unCommentedPosts[0];
    
    logger.info(`立即评论：选择帖子 "${targetPost.title}"`);

    // 解析帖子内容
    const parsedPosts = await this.postParser.parseAll([targetPost]);
    const parsedPost = parsedPosts[0];

    // 构建 enrichedPost 对象（兼容 ParsedPost 和 Post 类型）
    const enrichedPost = {
      id: parsedPost.id,
      title: parsedPost.title,
      content: parsedPost.fullText,
      images: parsedPost.originalImages,
      author: parsedPost.author || '',
      publishTime: parsedPost.publishTime || '',
      likeCount: parsedPost.likeCount || 0,
      commentCount: parsedPost.commentCount || 0,
      contentType: (targetPost as any).contentType,
    };

    // 分析帖子特征
    const commentAnalyzer = new CommentAnalyzer();
    const postFeatures = commentAnalyzer.analyzePost(enrichedPost);

    // 生成评论
    const recentOpenings = await this.getRecentOpenings(config.post.avoidRepeatDays);
    const genOptions: CommentGenerationOptions = {
      batchIndex: 0,
      recentOpenings,
    };
    const generated = await generateComment(postFeatures, genOptions);

    // 发布评论
    const currentToken = await this.authService.getAccessToken();
    const response = await this.api.publishComment(currentToken, enrichedPost.id, generated.content, enrichedPost.contentType);

    if (response.success) {
      // 记录评论历史
      const postTitle = enrichedPost.title || '未知帖子';
      await this.recordComment(enrichedPost.id, response.commentId, generated.content, {
        publishTime: enrichedPost.publishTime,
        postTitle: postTitle,
        postContent: enrichedPost.content?.substring(0, 500),
        contentType: enrichedPost.contentType,
      });
      results.push({
        success: true,
        postId: enrichedPost.id,
        postTitle: postTitle,
        commentId: response.commentId,
      });
      logger.info(`✓ 评论成功："${postTitle}" -> "${generated.content.substring(0, 30)}..."`);
    } else {
      const postTitle = enrichedPost.title || '未知帖子';
      results.push({
        success: false,
        postId: enrichedPost.id,
        postTitle: postTitle,
        error: '发布失败',
      });
    }

    // 保存评论日志（手工执行）
    const commentLogs: CreateCommentLogInput[] = results.map(r => ({
      post_id: r.postId,
      post_title: r.postTitle,
      post_content: enrichedPost.content?.substring(0, 500),
      content_type: enrichedPost.contentType,
      comment_content: generated.content,
      comment_id: r.commentId,
      success: r.success,
      error: r.error,
      mode: 'normal',
      source: 'manual',
      publish_time: enrichedPost.publishTime,
    }));
    await this.saveCommentLogs(commentLogs);

    return results;
  }

  /**
   * 执行每日自动评论任务
   * 支持多页获取、时间优先、兜底模式、拟人化回复
   */
  async performDailyComments(): Promise<CommentResult[]> {
    const config = loadConfig();
    const results: CommentResult[] = [];

    // 多页获取帖子列表
    const allPosts = await this.fetchPostsWithPaging();

    // 提取最近 avoidRepeatDays 天内的评论开头（用于避免重复）
    const avoidRepeatDays = (config.comment as any).avoidRepeatDays || 7;
    const recentOpenings = await this.getRecentOpenings(avoidRepeatDays);

    // 选择未评论过的帖子（已按时间排序）
    const targetPosts = await this.selectTargetPosts(allPosts, config.comment.dailyLimit);

    let postsToComment: Post[];
    let previousComments: Map<string, string> | undefined;
    let isFallbackMode = false;

    if (targetPosts.length === 0) {
      // 激活兜底模式
      const fallback = await this.selectFallbackPosts(config.comment.dailyLimit);
      if (!fallback) {
        return results;
      }
      postsToComment = fallback.posts;
      previousComments = fallback.previousComments;
      isFallbackMode = true;
    } else {
      postsToComment = targetPosts;
    }

    // 解析帖子内容（处理纯文字/长图文/图文混合）
    // 兜底模式下如果帖子内容为空，跳过解析直接使用已有内容
    let enrichedPosts: Post[];
    if (isFallbackMode) {
      // 兜底模式下，帖子内容已从历史记录中获取，无需重新解析
      enrichedPosts = postsToComment;
    } else {
      const parsedPosts = await this.postParser.parseAll(postsToComment);
      enrichedPosts = parsedPosts.map(parsed => ({
        id: parsed.id,
        title: parsed.title,
        content: parsed.fullText,
        images: parsed.originalImages,
        author: parsed.author || '',
        publishTime: parsed.publishTime || '',
        likeCount: parsed.likeCount || 0,
        commentCount: parsed.commentCount || 0,
        contentType: (postsToComment.find(p => p.id === parsed.id) as any)?.contentType,
      }));
    }

    logger.info(`选择了 ${enrichedPosts.length} 篇帖子进行评论${isFallbackMode ? '（兜底模式）' : ''}`);

    // 初始化帖子分析器
    const commentAnalyzer = new CommentAnalyzer();

    // 本次评论的日志记录
    const commentLogs: CommentLogEntry[] = [];

    for (let i = 0; i < enrichedPosts.length; i++) {
      const enrichedPost = enrichedPosts[i];

      try {
        // 分析帖子特征（兜底模式下使用简化特征）
        let postFeatures: PostFeatures;
        if (!isFallbackMode) {
          postFeatures = commentAnalyzer.analyzePost(enrichedPost);
        } else {
          // 兜底模式下创建简化特征
          const imageCount = enrichedPost.images ? enrichedPost.images.length : 0;
          const content = enrichedPost.content || '';
          postFeatures = {
            postId: enrichedPost.id,
            type: imageCount > 0 ? 'image-text-mixed' : 'text-only',
            topic: '其他',
            sentiment: 'positive',
            contentLength: content.length,
            keywords: [],
            post: {
              id: enrichedPost.id,
              title: enrichedPost.title || '未知帖子',
              content: content,
              images: enrichedPost.images || [],
              author: 'unknown',
              publishTime: enrichedPost.publishTime,
              likeCount: 0,
              commentCount: 0,
              contentType: enrichedPost.contentType,
            },
          };
        }

        // 构建生成选项
    const genOptions: CommentGenerationOptions = {
      batchIndex: i,
      recentOpenings: recentOpenings || [],
    };
    if (isFallbackMode && previousComments) {
      genOptions.previousComment = previousComments.get(enrichedPost.id);
    }

    // 生成评论
    const generated = await generateComment(postFeatures, genOptions);

        // 发布评论
        const currentToken = await this.authService.getAccessToken();
        const response = await this.api.publishComment(currentToken, enrichedPost.id, generated.content, enrichedPost.contentType);

        if (response.success) {
          // 记录评论历史（含新元数据）
          const postTitle = enrichedPost.title || '未知帖子';
          await this.recordComment(enrichedPost.id, response.commentId, generated.content, {
            publishTime: enrichedPost.publishTime,
            postTitle: postTitle,
            postContent: enrichedPost.content?.substring(0, 500),
            contentType: enrichedPost.contentType,
          });
          results.push({
            success: true,
            postId: enrichedPost.id,
            postTitle: postTitle,
            commentId: response.commentId,
          });
          // 记录评论日志（自动调度）
          commentLogs.push({
            timestamp: new Date().toISOString(),
            postId: enrichedPost.id,
            postTitle: postTitle,
            postContent: enrichedPost.content?.substring(0, 500),
            contentType: enrichedPost.contentType,
            commentContent: generated.content,
            commentId: response.commentId,
            success: true,
            mode: isFallbackMode ? 'fallback' : 'normal',
            source: 'auto',
            publishTime: enrichedPost.publishTime,
          });
          logger.info(`✓ 评论成功："${postTitle}" -> "${generated.content.substring(0, 30)}..."`);

          // 更新 recentOpenings 供后续帖子使用
          const opening = generated.content.substring(0, 15);
          recentOpenings.unshift(opening);
        } else {
          const postTitle = enrichedPost.title || '未知帖子';
          results.push({
            success: false,
            postId: enrichedPost.id,
            postTitle: postTitle,
            error: '发布失败',
          });
          // 记录失败日志（自动调度）
          commentLogs.push({
            timestamp: new Date().toISOString(),
            postId: enrichedPost.id,
            postTitle: postTitle,
            postContent: enrichedPost.content?.substring(0, 500),
            contentType: enrichedPost.contentType,
            commentContent: generated.content,
            success: false,
            error: '发布失败',
            mode: isFallbackMode ? 'fallback' : 'normal',
            source: 'auto',
            publishTime: enrichedPost.publishTime,
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const postTitle = enrichedPost.title || '未知帖子';
        results.push({
          success: false,
          postId: enrichedPost.id,
          postTitle: postTitle,
          error: errorMsg,
        });
        // 记录失败日志（自动调度）
        commentLogs.push({
          timestamp: new Date().toISOString(),
          postId: enrichedPost.id,
          postTitle: postTitle,
          postContent: enrichedPost.content?.substring(0, 500),
          contentType: enrichedPost.contentType,
          commentContent: '',
          success: false,
          error: errorMsg,
          mode: isFallbackMode ? 'fallback' : 'normal',
          source: 'auto',
          publishTime: enrichedPost.publishTime,
        });
        logger.error(`评论帖子 "${postTitle}" 失败：${errorMsg}`);
      }

      // 评论间随机延时（最后一条不需要等待）
      if (i < enrichedPosts.length - 1) {
        const delay = randomDelay(config.comment.delayMin * 1000, config.comment.delayMax * 1000);
        logger.info(`等待 ${Math.round(delay / 1000)}秒 后发布下一条评论...`);
        await sleep(delay);
      }
    }

    // 保存评论日志 - 转换为 CreateCommentLogInput 格式
    const logInputs: CreateCommentLogInput[] = commentLogs.map(log => ({
      post_id: log.postId,
      post_title: log.postTitle,
      post_content: log.postContent,
      content_type: log.contentType,
      comment_content: log.commentContent,
      comment_id: log.commentId,
      success: log.success,
      error: log.error,
      mode: log.mode,
      source: log.source,
      publish_time: log.publishTime,
    }));
    await this.saveCommentLogs(logInputs);

    return results;
  }

  /**
   * 获取最近 N 天内评论的开头句（前 15 字）
   */
  private async getRecentOpenings(days: number): Promise<string[]> {
    // 从 MySQL 获取
    return await this.commentHistoryStorage.getRecentOpenings(days);
  }

  /**
   * 选择评论目标帖子（按时间排序，排除已评论的）
   */
  private async selectTargetPosts(posts: Post[], limit: number): Promise<Post[]> {
    // 从 MySQL 获取已评论的帖子 ID
    let commentedPostIds = new Set<string>();
    try {
      commentedPostIds = await this.commentHistoryStorage.getCommentedPostIds();
    } catch (error: any) {
      logger.warn(`获取已评论帖子失败：${error.message}`);
    }

    // 按 publishTime 降序排列（最新优先），无效时间排最后
    const sorted = [...posts].sort((a, b) => {
      const timeA = Date.parse(a.publishTime);
      const timeB = Date.parse(b.publishTime);
      const validA = !isNaN(timeA);
      const validB = !isNaN(timeB);

      if (validA && validB) return timeB - timeA;
      if (validA && !validB) return -1;
      if (!validA && validB) return 1;
      return 0;
    });

    return sorted
      .filter(post => !commentedPostIds.has(post.id))
      .slice(0, limit);
  }

  /**
   * 兜底模式：从评论历史中选取帖子重新评论
   * 按帖子发布时间降序排列，选取最新的 N 条
   */
  private async selectFallbackPosts(limit: number): Promise<{ posts: Post[]; previousComments: Map<string, string> } | null> {
    try {
      // 从 MySQL 获取
      const historyList = await this.commentHistoryStorage.getAllCommentHistory();
      if (historyList.length === 0) {
        logger.warn('兜底模式：评论历史为空，无法选取帖子');
        return null;
      }

      logger.info('🔄 激活兜底模式：所有帖子均已评论，从历史中选取帖子重新评论');

      // 按 publishTime 降序排列，去重 postId
      const seenIds = new Set<string>();
      const uniqueRecords: any[] = [];
      const sortedHistory = [...historyList].sort((a, b) => {
        const timeA = Date.parse((a.publish_time as any) || '');
        const timeB = Date.parse((b.publish_time as any) || '');
        const validA = !isNaN(timeA);
        const validB = !isNaN(timeB);

        if (validA && validB) return timeB - timeA;
        if (validA && !validB) return -1;
        if (!validA && validB) return 1;
        return 0;
      });

      for (const record of sortedHistory) {
        if (!seenIds.has(record.post_id)) {
          seenIds.add(record.post_id);
          uniqueRecords.push(record);
        }
        if (uniqueRecords.length >= limit) break;
      }

      // 构建 Post 对象和上次评论映射
      const previousComments = new Map<string, string>();
      const posts: Post[] = uniqueRecords.map(record => {
        previousComments.set(record.post_id, record.content);
        return {
          id: record.post_id,
          title: record.post_title || '',
          content: record.post_content || '',
          images: [],
          author: '',
          publishTime: (record.publish_time as any) || '',
          likeCount: 0,
          commentCount: 0,
          contentType: record.content_type,
        };
      });

      return { posts, previousComments };
    } catch (error: any) {
      logger.error(`从 MySQL 获取评论历史失败：${error.message}`);
      return null;
    }
  }

  /**
   * 记录评论历史
   */
  private async recordComment(postId: string, commentId: string, content: string, meta?: {
    publishTime?: string;
    postTitle?: string;
    postContent?: string;
    contentType?: string;
  }): Promise<void> {
    // 保存到 MySQL
    const input = {
      post_id: postId,
      comment_id: commentId,
      content: content,
      post_title: meta?.postTitle,
      post_content: meta?.postContent,
      content_type: meta?.contentType,
      publish_time: meta?.publishTime,
    };
    
    // 检查是否已存在
    const exists = await this.commentHistoryStorage.hasCommented(postId);
    if (exists) {
      await this.commentHistoryStorage.updateCommentHistory(postId, input);
    } else {
      await this.commentHistoryStorage.createCommentHistory(input);
    }
  }

  /**
   * 多页获取帖子，遇到未评论帖子即停止
   */
  private async fetchPostsWithPaging(): Promise<Post[]> {
    const config = loadConfig();
    const maxPages = config.comment.maxFetchPages || 5;
    const allPosts: Post[] = [];
    const seenIds = new Set<string>();

    // 加载已评论帖子 ID 用于翻页优化
    let commentedPostIds = new Set<string>();
    try {
      commentedPostIds = await this.commentHistoryStorage.getCommentedPostIds();
    } catch (error: any) {
      logger.warn(`获取已评论帖子失败：${error.message}`);
    }

    for (let page = 1; page <= maxPages; page++) {
      try {
        const token = await this.authService.getAccessToken();
        const { posts } = await this.api.getPosts(token, page, 20);

        if (!posts || posts.length === 0) {
          logger.info(`第 ${page} 页无帖子，停止翻页`);
          break;
        }

        // 去重并合并
        for (const post of posts) {
          if (!seenIds.has(post.id)) {
            seenIds.add(post.id);
            allPosts.push(post);
          }
        }

        // 检查本页是否有未评论帖子
        const hasUncommented = posts.some(p => !commentedPostIds.has(p.id));
        if (hasUncommented) {
          logger.info(`第 ${page} 页发现未评论帖子，停止翻页（共获取 ${allPosts.length} 篇）`);
          break;
        }

        logger.info(`第 ${page} 页全部已评论，继续翻页...`);

        // 非最后一页时，页间随机延迟 1-3 秒
        if (page < maxPages) {
          const pageDelay = randomDelay(1000, 3000);
          await sleep(pageDelay);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(`获取第 ${page} 页失败：${errorMsg}，使用已获取的帖子继续`);
        break;
      }
    }

    logger.info(`多页获取完成，共 ${allPosts.length} 篇帖子`);
    return allPosts;
  }

  /**
   * 保存评论日志到 MySQL
   */
  private async saveCommentLogs(logs: CreateCommentLogInput[]): Promise<void> {
    if (logs.length === 0) {
      return;
    }

    // 保存到 MySQL
    for (const log of logs) {
      await this.commentLogStorage.createCommentLog(log);
    }
    logger.info(`评论日志已保存到 MySQL：${logs.length} 条记录`);
  }
}
