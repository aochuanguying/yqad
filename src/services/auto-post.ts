import * as fs from 'fs';
import * as path from 'path';
import { IAudiApi } from '../api/types';
import { AuthService } from './auth';
import { generatePost, GeneratedPost } from '../ai/content-generator';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { Topic } from '../web/services/topics-service';
import { load as loadGlobalPrompt } from './global-prompt-service';
import { selectImages, selectFeaturedImageCandidates } from './image-selector';
import { fetchHotTopics, matchTopics } from './topic-matcher';
import { PostSummary, PublishOptions, MatchedTopic, PostingMode, FeaturedPostingReadiness } from '../types/posting-optimization';
import { downloadImages, cleanTempImages } from '../utils/image-downloader';
import { evaluateFeaturedPostingReadiness } from './featured-posting-policy';
import { generateImageMetadata } from '../utils/image-metadata';
import type { ImageInfo, PendingPost } from '../types/api-remote-post';
import { pendingPostService } from './pending-post-service';
import { recommendSimilarTopics, getAllTopics, incrementTopicUseCount } from '../web/services/topics-service';
import { postLoggingService } from './post-logging-service';
import { postHistoryStorage, CreatePostHistoryInput } from '../storage/mysql/post-history-storage';

// CommonJS 模块导入（用于编译后的 JS 文件）
let internetReferenceService: any;
let plagiarismDetector: any;
try {
  internetReferenceService = require('./internet-reference-service');
  plagiarismDetector = require('../utils/plagiarism-detector');
} catch (e) {
  // 忽略，运行时动态加载
}

// 类型辅助函数
const search = internetReferenceService?.search || (async () => []);
const detectPlagiarism = plagiarismDetector?.detectPlagiarism || (() => false);

// 【第一步优化】合规性检查服务
import { complianceCheckOrchestrator } from './compliance-check-orchestrator';
import { contentDeduplicationService } from './content-deduplication-service';
import { chromaSearchService } from './chroma-search-service';

// 【第二步优化】主题多样化服务
import { topicDiversityService, ExtendedTopic, OutlineVariant } from './topic-diversity-service';

// 【第三步优化】混合素材服务
import { hybridMaterialService, MaterialSelectionResult, InternetReference } from './hybrid-material-service';

const logger = getLogger('auto-post');

interface PostRecord {
  postId: string;
  title: string;
  topic: string;
  timestamp: string;
}

/**
 * Pipeline 上下文：包含发帖流程的中间状态
 */
interface PostPipelineContext {
  topic: Topic;
  mode: PostingMode;
  triggerType: 'auto' | 'manual';
  featuredEnabled: boolean;
  config: any;
  
  // 子方向和提纲
  selectedSubDirectionIndex?: number;
  subDirection?: any;
  finalOutline?: string;
  topicConstraint?: string;
  
  // 生成的内容
  generated?: GeneratedPost;
  
  // 素材和图片
  imagePaths: string[];
  imageUrls: string[];
  materialSelectionResult: MaterialSelectionResult | null;
  
  // 话题匹配
  matchedTopics: MatchedTopic[];
  
  // 多样化变换
  finalTitle: string;
  finalContent: string;
  
  // 合规性检查
  complianceReportId?: string;
  
  // 发布结果
  postId?: string;
  success?: boolean;
  error?: string;
}

export interface PostResult {
  success: boolean;
  postId?: string;
  title?: string;
  error?: string;
  source?: 'topic' | 'free';
  mode?: PostingMode;
  featuredReadiness?: FeaturedPostingReadiness;
  topicId?: string;
  topicName?: string;
  content?: string;
  imageUrls?: string[];
  taskId?: string;
  // 【第一步优化】合规性检查报告 ID
  complianceReportId?: string;
}

export class AutoPostService {
  private api: IAudiApi;
  private authService: AuthService;

  constructor(api: IAudiApi, authService: AuthService) {
    this.api = api;
    this.authService = authService;
    
    logger.info('自动发帖服务已初始化（发帖历史使用 MySQL 存储）');
    
    // 【第三步优化】初始化混合素材服务
    const config = loadConfig();
    if (config.hybridMaterial?.enabled) {
      hybridMaterialService.initialize().catch((err: any) => {
        logger.warn(`初始化混合素材服务失败：${err.message}`);
      });
    }
  }

  /**
   * 执行每日自动发帖任务
   * @param count 发帖数量（默认使用配置）
   * @param mode 发帖模式（默认使用配置）
   * @param isManual 是否手动触发（默认 false）
   */
  async performDailyPosts(count?: number, mode?: PostingMode, isManual: boolean = false): Promise<PostResult[]> {
    const config = loadConfig();
    const results: PostResult[] = [];
    const postCount = count ?? config.post.dailyLimit;
    const postMode = mode ?? (config.featuredPosting.enabled ? 'featured' : 'normal');
    const triggerType = isManual ? 'manual' : 'auto';

    // 获取所有主题并选择可用的
    const allTopics = await getAllTopics();
    const availableTopics = allTopics.filter(t => t.status === 'unused');
    let topicIndex = 0;

    for (let i = 0; i < postCount; i++) {
      // 优先使用已配置主题
      const topic = availableTopics[topicIndex++] || null;

      if (topic) {
        const result = await this.postWithTopic(topic, postMode, triggerType);
        results.push(result);
      } else {
        // 无可用主题，回退到自由生成模式
        const result = await this.postFreeStyle(postMode, triggerType);
        results.push(result);
      }
    }

    return results;
  }



  /**
   * 基于预配置主题发帖（Pipeline 模式重构）
   * 流程：选择子方向 → 生成内容 → 选择素材 → 上传图片 → 匹配话题 → 多样化变换 → 合规检查 → 发布
   * @param topic 主题
   * @param mode 发帖模式（可选）
   * @param triggerType 触发方式（可选，默认'auto'）
   */
  private async postWithTopic(topic: Topic, mode?: PostingMode, triggerType: 'auto' | 'manual' = 'auto'): Promise<PostResult> {
    try {
      logger.info(`使用预配置主题发帖："${topic.title}"`);
      const config = loadConfig();
      const featuredEnabled = config.featuredPosting.enabled;

      // 初始化 Pipeline 上下文
      const ctx: PostPipelineContext = {
        topic,
        mode: mode ?? (featuredEnabled ? 'featured' : 'normal'),
        triggerType,
        featuredEnabled,
        config,
        imagePaths: [],
        imageUrls: [],
        matchedTopics: [],
        finalTitle: '',
        finalContent: '',
        materialSelectionResult: null,
      };

      // Pipeline 步骤 1：选择子方向和提纲
      await this.selectSubDirectionAndOutline(ctx);

      // Pipeline 步骤 2：生成内容并去重
      const contentGenerated = await this.generateContentWithDedup(ctx);
      if (!contentGenerated) {
        return { 
          success: false, 
          error: ctx.error || '标题去重失败', 
          source: 'topic', 
          mode: featuredEnabled ? 'featured' : 'normal',
          complianceReportId: ctx.complianceReportId,
        };
      }

      // Pipeline 步骤 3：选择素材
      await this.selectMaterials(ctx);

      // Pipeline 步骤 4：上传图片
      await this.uploadImagesToCDN(ctx);

      // Pipeline 步骤 5：匹配热门话题
      await this.matchHotTopics(ctx);

      // Pipeline 步骤 6：应用多样化变换
      await this.applyDiversityTransforms(ctx);

      // Pipeline 步骤 7：合规性检查
      const compliancePassed = await this.performComplianceCheck(ctx);
      if (!compliancePassed) {
        return {
          success: false,
          error: ctx.error || '合规性检查未通过',
          source: 'topic',
          mode: featuredEnabled ? 'featured' : 'normal',
          complianceReportId: ctx.complianceReportId,
        };
      }

      // Pipeline 步骤 8：发布并记录结果
      return await this.publishAndRecord(ctx);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`主题发帖失败 (${topic.title}): ${errorMsg}`);
      return { success: false, error: errorMsg, source: 'topic' };
    }
  }

  // ==================== Pipeline 子方法 ====================

  /**
   * 步骤 1：选择子方向和提纲变体
   */
  private async selectSubDirectionAndOutline(ctx: PostPipelineContext): Promise<void> {
    const { topic } = ctx;
    const extendedTopic = topic as ExtendedTopic;
    
    // 选择子方向（异步调用）
    const selectedSubDirectionIndex = await topicDiversityService.selectBalancedSubDirection(topic.id);
    const subDirection = extendedTopic.subDirections?.[selectedSubDirectionIndex];
    ctx.selectedSubDirectionIndex = subDirection ? selectedSubDirectionIndex : undefined;
    ctx.subDirection = subDirection;
    
    if (!subDirection) {
      logger.warn(`主题 "${topic.title}" 没有可用的子方向，使用默认 direction`);
    } else {
      logger.info(`【多样化】选择子方向 #${selectedSubDirectionIndex}: ${subDirection.direction || 'N/A'}`);
    }

    // 生成提纲变体（50% 概率）
    let finalOutline = subDirection?.outline || topic.outline;
    if (Math.random() < 0.5 && finalOutline) {
      try {
        const variant: OutlineVariant = await topicDiversityService.generateOutlineVariant(
          finalOutline,
          topic.title
        );
        finalOutline = variant.variant;
        logger.info(`【多样化】使用提纲变体：风格="${variant.style}"`);
      } catch (err) {
        logger.warn(`生成提纲变体失败，使用原提纲：${err instanceof Error ? err.message : String(err)}`);
      }
    }
    ctx.finalOutline = finalOutline;

    // 构建主题约束
    ctx.topicConstraint = subDirection
      ? `子方向：${subDirection.direction}${finalOutline ? `\n内容提纲：${finalOutline}` : ''}`
      : `主题方向：${topic.direction}${finalOutline ? `\n内容提纲：${finalOutline}` : ''}`;
  }

  /**
   * 步骤 2：生成内容并去重（包含语义去重）
   */
  private async generateContentWithDedup(ctx: PostPipelineContext): Promise<boolean> {
    const { topic, topicConstraint, mode, featuredEnabled } = ctx;
    const config = loadConfig();
    
    // 获取最近发帖历史用于去重
    const recentTopics = await this.getRecentTopics(7);
    
    // 读取全局人设
    const globalPrompt = loadGlobalPrompt() ?? undefined;

    // 生成内容（含标题去重）
    const generated = await this.generatePostWithDedup(
      topic,
      recentTopics,
      topicConstraint!,
      globalPrompt,
      featuredEnabled ? 'featured' : 'normal'
    );

    if (!generated) {
      logger.warn(`主题 "${topic.title}" 标题去重重试 2 次仍重复，跳过该主题`);
      ctx.error = '标题去重失败，已跳过该主题';
      return false;
    }
    ctx.generated = generated;

    // 语义去重检查
    try {
      const semanticDuplicateCheck = await chromaSearchService.checkContentDuplicate(
        generated.title,
        generated.content
      );
      
      if (semanticDuplicateCheck.isDuplicate) {
        logger.warn(
          `【语义去重】检测到重复内容！相似度：${semanticDuplicateCheck.maxSimilarity.toFixed(3)}, ` +
          `匹配帖子：${semanticDuplicateCheck.matchedTitle || semanticDuplicateCheck.matchedPostId}，跳过该主题`
        );
        ctx.error = `语义去重检测到重复（相似度：${semanticDuplicateCheck.maxSimilarity.toFixed(3)}）`;
        return false;
      }
      
      logger.info(`【语义去重】检查通过，相似度：${semanticDuplicateCheck.maxSimilarity.toFixed(3)}`);
    } catch (error) {
      logger.warn(`【语义去重】检查失败，跳过：${error instanceof Error ? error.message : String(error)}`);
    }

    return true;
  }

  /**
   * 步骤 3：选择素材（本地优先或混合）
   */
  private async selectMaterials(ctx: PostPipelineContext): Promise<void> {
    const { topic, subDirection, generated, featuredEnabled, config } = ctx;
    const minImages = config.featuredPosting.minImages;
    
    let imagePaths: string[] = [];
    let materialSelectionResult: MaterialSelectionResult | null = null;

    // 检查是否有本地素材
    const hasLocalMaterials = topic.materialPaths && topic.materialPaths.length > 0;
    
    if (hasLocalMaterials) {
      // 有本地素材，只使用本地素材
      logger.info(`主题发帖：使用本地素材（${topic.materialPaths.length}个）`);
      try {
        materialSelectionResult = await hybridMaterialService.selectHybridMaterials({
          priorityMode: 'local-first',
          localRatio: 1.0,  // 100% 本地素材
          title: generated!.title,
          internetReferences: [],
          neededCount: minImages,
        });
        
        if (materialSelectionResult && materialSelectionResult.selectedMaterials.length > 0) {
          imagePaths = materialSelectionResult.selectedMaterials.map((m: any) => m.path);
          logger.info(`【本地素材】选中 ${imagePaths.length} 张图片`);
        } else {
          logger.warn('本地素材匹配未返回结果，使用 fallback 逻辑');
          imagePaths = this.selectImagesFallback(generated!.title, generated!.content, topic, subDirection, minImages, featuredEnabled);
        }
      } catch (err) {
        logger.warn(`本地素材选择失败，回退到 fallback：${err instanceof Error ? (err as Error).message : String(err)}`);
        imagePaths = this.selectImagesFallback(generated!.title, generated!.content, topic, subDirection, minImages, featuredEnabled);
      }
    } else {
      // 没有本地素材，使用 fallback 逻辑
      logger.info('主题发帖：没有本地素材，使用 fallback 逻辑（网络素材）');
      imagePaths = this.selectImagesFallback(generated!.title, generated!.content, topic, subDirection, minImages, featuredEnabled);
    }
    
    if (imagePaths.length > 0) {
      logger.info(`图片选取：${imagePaths.length} 张图片`);
    } else {
      logger.info('无匹配图片，将发布纯文字帖子');
    }

    ctx.imagePaths = imagePaths;
    ctx.materialSelectionResult = materialSelectionResult;
  }

  /**
   * 步骤 4：上传图片到 CDN
   */
  private async uploadImagesToCDN(ctx: PostPipelineContext): Promise<void> {
    const { imagePaths, featuredEnabled, config } = ctx;
    
    if (imagePaths.length === 0) {
      ctx.imageUrls = [];
      return;
    }

    const token = await this.authService.getAccessToken();
    let imageUrls: string[] = [];

    try {
      if (featuredEnabled) {
        imageUrls = await this.uploadImagesToMinCount(
          token, 
          imagePaths, 
          config.featuredPosting.minImages,
          config.featuredPosting.maxImageUploadRetries
        );
      } else {
        const uploadResult = await this.api.uploadImages(token, imagePaths);
        imageUrls = uploadResult.urls;
        if (uploadResult.failed > 0 && imageUrls.length > 0) {
          logger.warn(`部分图片上传失败：成功${imageUrls.length}张，失败${uploadResult.failed}张，使用已成功的图片继续`);
        } else if (imageUrls.length === 0) {
          logger.warn('图片上传全部失败，以纯文字方式继续发帖');
        }
      }
    } catch (error: any) {
      logger.warn(`图片上传异常：${error.message}，以纯文字方式继续发帖`);
      imageUrls = [];
    }

    ctx.imageUrls = imageUrls;
  }

  /**
   * 步骤 5：匹配热门话题
   */
  private async matchHotTopics(ctx: PostPipelineContext): Promise<void> {
    const { generated } = ctx;
    const token = await this.authService.getAccessToken();
    let topicList: MatchedTopic[] = [];

    try {
      const hotTopics = await fetchHotTopics(token);
      if (hotTopics.length > 0) {
        topicList = await matchTopics(generated!.title, generated!.content, hotTopics);
        if (topicList.length > 0) {
          logger.info(`话题匹配：关联 ${topicList.length} 个话题 [${topicList.map(t => t.name).join(', ')}]`);
        }
      }
    } catch (error: any) {
      logger.warn(`话题匹配失败：${error.message}，以无话题方式继续发帖`);
    }

    ctx.matchedTopics = topicList;
  }

  /**
   * 步骤 6：应用多样化变换（标题和内容）
   */
  private async applyDiversityTransforms(ctx: PostPipelineContext): Promise<void> {
    const { topic, subDirection, generated } = ctx;

    // 多样化标题（30% 概率）
    let finalTitle = generated!.title;
    if (Math.random() < 0.3) {
      try {
        finalTitle = await topicDiversityService.generateDiverseTitle({
          baseTopic: topic.title,
          keyPoints: [subDirection?.direction || topic.direction],
          emotion: 'positive',
        });
        logger.info(`【多样化】使用 AI 生成标题："${finalTitle}"`);
      } catch (err) {
        logger.warn(`生成多样化标题失败，使用原标题：${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 多样化内容（20% 概率）
    let finalContent = generated!.content;
    if (Math.random() < 0.2) {
      try {
        const variant = await topicDiversityService.generateContentVariant(
          generated!.content,
          {
            perspective: Math.random() < 0.5 ? 'first' : 'third',
            structure: ['chronological', 'problem-solution', 'pros-cons'][
              Math.floor(Math.random() * 3)
            ] as any,
            tone: ['casual', 'formal', 'enthusiastic'][
              Math.floor(Math.random() * 3)
            ] as any,
          }
        );
        finalContent = variant;
        logger.info(`【多样化】使用内容变体：长度变化 ${generated!.content.length} → ${variant.length}`);
      } catch (err) {
        logger.warn(`生成内容变体失败，使用原内容：${err instanceof Error ? err.message : String(err)}`);
      }
    }

    ctx.finalTitle = finalTitle;
    ctx.finalContent = finalContent;
  }

  /**
   * 步骤 7：合规性检查
   */
  private async performComplianceCheck(ctx: PostPipelineContext): Promise<boolean> {
    const { finalTitle, finalContent, imagePaths, topic, triggerType, config } = ctx;
    
    const complianceCheckEnabled = config.contentDeduplication?.enabled !== false;
    if (!complianceCheckEnabled) {
      return true;
    }

    try {
      const complianceResult = await complianceCheckOrchestrator.performComplianceCheck({
        title: finalTitle,
        content: finalContent,
        imageCount: imagePaths.length,
        topicId: topic.id,
        topicName: topic.title,
        triggerType,
      });
      
      if (!complianceResult.passed) {
        logger.warn(`合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`);
        
        // 如果使用了敏感词替换，使用过滤后的内容
        if (complianceResult.filteredContent) {
          ctx.finalContent = complianceResult.filteredContent;
          logger.info(`已自动替换敏感词`);
        } else {
          // 检查未通过，跳过该帖子
          ctx.error = `合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`;
          ctx.complianceReportId = complianceResult.reportId;
          return false;
        }
      }
      
      logger.info(`【合规性检查】通过 (${complianceResult.qualityScore?.finalScore || 'N/A'}分)`);
      ctx.complianceReportId = complianceResult.reportId;
      return true;
    } catch (err) {
      logger.error(`合规性检查异常：${err instanceof Error ? err.message : String(err)}`);
      // 检查异常时降级处理，允许发布
      return true;
    }
  }

  /**
   * 步骤 8：发布并记录结果
   */
  private async publishAndRecord(ctx: PostPipelineContext): Promise<PostResult> {
    const { finalTitle, finalContent, imageUrls, matchedTopics, featuredEnabled, topic, triggerType } = ctx;
    const config = loadConfig();

    // 构建发布选项
    const publishOptions: PublishOptions = {
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      topicList: matchedTopics.length > 0 ? matchedTopics : undefined,
    };

    // 评估精华准备度
    const featuredReadiness = featuredEnabled
      ? evaluateFeaturedPostingReadiness({ 
          title: finalTitle, 
          content: finalContent, 
          imageUrls,
          topicNames: matchedTopics.map(t => t.name)
        })
      : undefined;

    const mode: PostingMode = featuredReadiness?.eligible ? 'featured' : 'normal';
    if (featuredEnabled && featuredReadiness && !featuredReadiness.eligible) {
      logger.warn(`精华候选不达标，降级发普通帖：${featuredReadiness.reasons.join('; ')}`);
    }

    // 发布帖子
    const token = await this.authService.getAccessToken();
    const response = await this.api.publishPost(
      token,
      finalTitle,
      finalContent,
      publishOptions
    );

    if (response.success) {
      // 记录成功
      await this.recordPostSuccess(ctx, response.postId, mode);
      
      logger.info(`✓ 主题发帖成功："${finalTitle}" (图片:${imageUrls.length}张，话题:${matchedTopics.length}个，mode:${mode}, 子方向索引:${ctx.selectedSubDirectionIndex ?? 'N/A'})`);
      
      return { 
        success: true, 
        postId: response.postId, 
        title: finalTitle, 
        content: finalContent,
        imageUrls,
        topicId: topic.id,
        topicName: topic.title,
        taskId: response.postId,
        source: 'topic', 
        mode, 
        featuredReadiness,
        complianceReportId: ctx.complianceReportId,
      };
    } else {
      // 记录失败
      await this.recordPostFailure(ctx, mode);
      
      return { 
        success: false, 
        error: '发布失败', 
        title: finalTitle,
        content: finalContent,
        imageUrls,
        topicId: topic.id,
        topicName: topic.title,
        source: 'topic', 
        mode, 
        featuredReadiness 
      };
    }
  }

  /**
   * 记录发帖成功（辅助方法）
   */
  private async recordPostSuccess(ctx: PostPipelineContext, postId: string, mode: PostingMode): Promise<void> {
    const { topic, selectedSubDirectionIndex, finalTitle, triggerType, imageUrls, finalContent, materialSelectionResult } = ctx;
    
    // 递增主题使用计数
    await incrementTopicUseCount(topic.id);
    
    // 记录发帖历史
    this.recordPost(postId, finalTitle, ctx.subDirection?.direction || topic.direction, finalContent, imageUrls);
    
    // 更新子方向使用记录
    if (selectedSubDirectionIndex !== undefined) {
      topicDiversityService.updateSubDirectionUsage(topic.id, selectedSubDirectionIndex);
    }

    // 更新素材使用记录
    if (materialSelectionResult) {
      const materialIds = materialSelectionResult.selectedMaterials.map((m: any) => m.id);
      await hybridMaterialService.updateMaterialUsage(materialIds, postId);
    }
    
    // 推荐相似主题
    try {
      const recommendations = await recommendSimilarTopics(topic.id, 3, 0.6);
      if (recommendations.length > 0) {
        logger.info(
          `为主题 "${topic.title}" 推荐 ${recommendations.length} 个相似主题：` +
          recommendations.map(r => `${r.topicTitle}(${r.similarity.toFixed(2)})`).join(', ')
        );
      }
    } catch (error) {
      logger.warn(`推荐相似主题失败：${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 记录发帖日志
    try {
      postLoggingService.log({
        timestamp: Date.now(),
        triggerType,
        postType: 'topic',
        mode,
        topicId: topic.id,
        topicName: topic.title,
        title: finalTitle,
        content: finalContent,
        imageUrls,
        status: 'success',
        taskId: postId,
      });
      logger.debug(`已记录${triggerType === 'manual' ? '手动' : '自动'}发帖日志：${finalTitle}`);
    } catch (logError: any) {
      logger.warn(`记录发帖日志失败：${logError.message}，不影响发帖主流程`);
    }
  }

  /**
   * 记录发帖失败（辅助方法）
   */
  private async recordPostFailure(ctx: PostPipelineContext, mode: PostingMode): Promise<void> {
    const { topic, finalTitle, triggerType, imageUrls, finalContent } = ctx;
    
    try {
      postLoggingService.log({
        timestamp: Date.now(),
        triggerType,
        postType: 'topic',
        mode,
        topicId: topic.id,
        topicName: topic.title,
        title: finalTitle,
        content: finalContent,
        imageUrls,
        status: 'failed',
        errorMessage: '发布失败',
        taskId: undefined,
      });
    } catch (logError: any) {
      logger.warn(`记录发帖失败日志失败：${logError.message}`);
    }
  }

  // ==================== 原 generatePostWithDedup 方法 ====================

  /**
   * 生成帖子内容并进行标题去重校验
   * 比对新生成标题与历史标题，重复时最多重试 2 次
   * @returns 生成的帖子内容，若去重失败返回 null
   */
  private async generatePostWithDedup(
    topic: Topic,
    recentTopics: string[],
    topicConstraint: string,
    globalPrompt?: any,
    mode: PostingMode = 'normal'
  ): Promise<GeneratedPost | null> {
    const config = loadConfig();
    const maxRetries = mode === 'featured'
      ? Math.max(2, config.featuredPosting.maxGenerateRetries)
      : 2;
    const historyTitles = topic.postHistory.map((h: any) => h.title);
    const minContentChars = mode === 'featured' ? config.featuredPosting.minContentChars : config.contentLimits.post.min;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const generated = await generatePost(
        topic.direction,
        recentTopics,
        undefined, // summary 已移除
        topicConstraint,
        {
          globalPrompt,
          topicHistory: topic.postHistory.length > 0 ? topic.postHistory : undefined,
          mode,
        }
      );

      // 标题去重校验：与历史标题比对
      const isDuplicate = historyTitles.some(
        (histTitle: any) => histTitle === generated.title
      );

      const isContentEnough = (generated.content || '').length >= minContentChars;

      if (!isDuplicate && isContentEnough) {
        return generated;
      }

      if (attempt < maxRetries) {
        if (isDuplicate) {
          logger.warn(`生成标题 "${generated.title}" 与历史标题重复，正在重试 (${attempt + 1}/${maxRetries})`);
        } else {
          logger.warn(`生成内容字数不足 (${generated.content.length}/${minContentChars})，正在重试 (${attempt + 1}/${maxRetries})`);
        }
      }
    }

    // 重试耗尽仍重复
    return null;
  }

  private async generatePostWithMinChars(
    topic: string,
    avoidTopics: string[],
    topicConstraint: string | undefined,
    options: any,
    minChars: number,
    maxRetries: number
  ): Promise<GeneratedPost> {
    let last: GeneratedPost | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const generated = await generatePost(topic, avoidTopics, undefined, topicConstraint, options);
      last = generated;
      if ((generated.content || '').length >= minChars) return generated;
      if (attempt < maxRetries) {
        logger.warn(`生成内容字数不足 (${generated.content.length}/${minChars})，正在重试 (${attempt + 1}/${maxRetries})`);
      }
    }
    return last!;
  }

  private async uploadImagesToMinCount(
    token: string,
    candidates: string[],
    minImages: number,
    maxRetries: number
  ): Promise<string[]> {
    const remaining = [...candidates];
    const used = new Set<string>();
    const imageUrls: string[] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (imageUrls.length >= minImages) break;
      const available = remaining.filter(p => !used.has(p));
      if (available.length === 0) break;

      const need = minImages - imageUrls.length;
      const batchSize = Math.min(9, available.length, Math.max(minImages, need));
      const batch = available.slice(0, batchSize);
      for (const p of batch) used.add(p);

      const uploadResult = await this.api.uploadImages(token, batch);
      for (const url of uploadResult.urls) {
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }

      if (imageUrls.length >= minImages) break;
    }

    if (imageUrls.length === 0) {
      logger.warn('图片上传全部失败，以纯文字方式继续发帖');
    } else if (imageUrls.length < minImages) {
      logger.warn(`图片上传后仍不足：${imageUrls.length}/${minImages}，将降级发普通帖`);
    }

    return imageUrls;
  }

  /**
   * 自由生成模式发帖
   * 只使用互联网参考模式（从小红书等平台获取参考素材，AI 改写生成原创内容，图片已去水印）
   * 互联网参考是唯一的外部参考来源，失败时直接返回错误
   */
  private async postFreeStyle(mode?: PostingMode, triggerType: 'auto' | 'manual' = 'auto'): Promise<PostResult> {
    try {
      logger.info('无可用主题，使用自由生成模式（互联网参考）发帖');

      // 只使用互联网参考模式
      return await this.tryInternetReferenceMode(mode, triggerType);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`自由发帖失败：${errorMsg}`);
      return { success: false, error: errorMsg, source: 'free' };
    }
  }

  /**
   * 互联网参考模式：查询参考帖子 → AI 改写 → 抄袭检测 → 发布
   * 只使用互联网参考模式，失败时返回错误结果
   * @param mode 发帖模式（可选）
   * @param triggerType 触发方式（可选，默认'auto'）
   */
  private async tryInternetReferenceMode(mode?: PostingMode, triggerType: 'auto' | 'manual' = 'auto'): Promise<PostResult> {
    try {
      const config = loadConfig();
      const featuredEnabled = config.featuredPosting.enabled;
      const minImages = config.featuredPosting.minImages;

      // 使用预加载的 CommonJS 模块
      const { canQuery, search } = internetReferenceService || require('./internet-reference-service');
      const { detectPlagiarism } = plagiarismDetector || require('../utils/plagiarism-detector');

      // 检查频率限制
      if (!canQuery()) {
        logger.error('互联网参考查询频率超限，无法发帖');
        return { success: false, error: '互联网参考查询频率超限', source: 'free' };
      }

      // 查询互联网参考素材
      const references = await search();
      if (!references || references.length === 0) {
        logger.error('互联网参考查询未返回结果，无法发帖');
        return { success: false, error: '互联网参考查询未返回结果', source: 'free' };
      }

      logger.info(`获取到 ${references.length} 篇互联网参考素材（已包含去水印处理）`);

      // 读取全局人设（降级为 undefined）
      const globalPrompt = loadGlobalPrompt() ?? undefined;

      // 构建去重避免列表
      const recentTopics = await this.getRecentTopics(config.post.avoidRepeatDays);

      // 使用第一篇参考帖子的标题作为主题方向
      const topic = references[0].title || '奥迪用车分享';

      const generated = await this.generatePostWithMinChars(
        topic,
        recentTopics,
        undefined,
        {
          globalPrompt,
          referenceTexts: references,
          mode: featuredEnabled ? 'featured' : 'normal',
        },
        featuredEnabled ? config.featuredPosting.minContentChars : config.contentLimits.post.min,
        featuredEnabled ? config.featuredPosting.maxGenerateRetries : 0
      );

      // 抄袭检测
      if (detectPlagiarism(generated.content, references)) {
        logger.error('生成内容与参考素材存在抄袭嫌疑，无法发帖');
        return { success: false, error: '生成内容存在抄袭嫌疑', source: 'free' };
      }

      // 图片获取：自由发帖从本地和网络同时获取候选素材，但按贴合度排序选择
      let imagePaths: string[] = [];
      let materialSelectionResult: MaterialSelectionResult | null = null;

      // 【第三步优化】收集互联网参考素材
      const internetReferences: InternetReference[] = [];
      for (const ref of references) {
        // 优先使用处理后的图片 URL
        const imageUrls = ref.processedImageUrls && ref.processedImageUrls.length > 0
          ? ref.processedImageUrls
          : ref.imageUrls || [];
        
        if (imageUrls.length > 0) {
          internetReferences.push({
            title: ref.title || '',
            content: ref.content || '',
            source: ref.source || 'internet',
            url: ref.url || '',
            imageUrls,
          });
        }
      }

      // 【第三步优化】使用混合素材服务选择素材（按贴合度排序，不强制混合）
      const hybridConfig = config.hybridMaterial;
      if (hybridConfig?.enabled) {
        try {
          materialSelectionResult = await hybridMaterialService.selectHybridMaterials({
            priorityMode: 'hybrid',  // 混合模式，但按质量排序
            localRatio: hybridConfig.localRatio ?? 0.6,
            title: generated.title,
            internetReferences: internetReferences.length > 0 ? internetReferences : undefined,
            neededCount: minImages,
          });
          
          // 提取素材路径（已经按贴合度排序）
          imagePaths = materialSelectionResult.selectedMaterials.map((m: any) => m.path);
          logger.info(`【自由发帖素材】${materialSelectionResult.strategy}，选中 ${imagePaths.length} 张图片`);
          
        } catch (err) {
          logger.warn(`混合素材选择失败，回退到原逻辑：${err instanceof Error ? (err as Error).message : String(err)}`);
          imagePaths = await this.selectImagesFallbackForFreeStyle(generated.title, generated.content, references, minImages);
        }
      } else {
        // 回退到原逻辑
        imagePaths = await this.selectImagesFallbackForFreeStyle(generated.title, generated.content, references, minImages);
      }

      // 话题匹配
      const token = await this.authService.getAccessToken();
      let matchedTopics: MatchedTopic[] = [];
      try {
        const hotTopics = await fetchHotTopics(token);
        if (hotTopics.length > 0) {
          matchedTopics = await matchTopics(generated.title, generated.content, hotTopics);
        }
      } catch (err) {
        logger.warn(`话题匹配失败，以无话题方式继续：${err instanceof Error ? err.message : String(err)}`);
      }

      // 构建发布选项
      let imageUrls: string[] = [];
      if (imagePaths.length > 0 || featuredEnabled) {
        try {
          if (featuredEnabled) {
            const supplemental = selectFeaturedImageCandidates({
              keywords: generated.title + ' ' + generated.content,
              minCount: minImages,
            });
            const candidates = Array.from(new Set([...imagePaths, ...supplemental]));
            imageUrls = await this.uploadImagesToMinCount(token, candidates, minImages, config.featuredPosting.maxImageUploadRetries);
          } else {
            const uploadResult = await this.api.uploadImages(token, imagePaths);
            imageUrls = uploadResult.urls;
            if (uploadResult.failed > 0 && imageUrls.length > 0) {
              logger.warn(`部分图片上传失败：成功${imageUrls.length}张，失败${uploadResult.failed}张`);
            } else if (imageUrls.length === 0) {
              logger.warn('图片上传全部失败，以纯文字方式继续发帖');
            }
          }
        } catch (err: any) {
          logger.warn(`图片上传异常：${err.message}，以纯文字方式继续发帖`);
        }
      }

      const publishOptions: PublishOptions = {
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        topicList: matchedTopics.length > 0 ? matchedTopics : undefined,
      };

      const featuredReadiness = featuredEnabled
        ? evaluateFeaturedPostingReadiness({ 
            title: generated.title, 
            content: generated.content, 
            imageUrls,
            topicNames: matchedTopics.map(t => t.name)
          })
        : undefined;
      const mode: PostingMode = featuredReadiness?.eligible ? 'featured' : 'normal';
      if (featuredEnabled && featuredReadiness && !featuredReadiness.eligible) {
        logger.warn(`精华候选不达标，降级发普通帖：${featuredReadiness.reasons.join('; ')}`);
      }

      // 发布帖子
      const response = await this.api.publishPost(
        token,
        generated.title,
        generated.content,
        publishOptions
      );

      if (response.success) {
        // 记录发帖历史，包含来源信息
        this.recordPost(response.postId, generated.title, `互联网参考：${references[0].source}`);
        
        // 记录发帖日志
        try {
          postLoggingService.log({
            timestamp: Date.now(),
            triggerType,
            postType: 'free',
            mode,
            title: generated.title,
            content: generated.content,
            imageUrls,
            status: 'success',
            taskId: response.postId,
          });
          logger.debug(`已记录${triggerType === 'manual' ? '手动' : '自动'}自由发帖日志：${generated.title}`);
        } catch (logError: any) {
          logger.warn(`记录发帖日志失败：${logError.message}，不影响发帖主流程`);
        }
        
        logger.info(`✓ 互联网参考模式发帖成功："${generated.title}"`);
        // 清理过期临时图片
        cleanTempImages();
        return { 
          success: true, 
          postId: response.postId, 
          title: generated.title, 
          content: generated.content,
          imageUrls,
          taskId: response.postId,
          source: 'free', 
          mode, 
          featuredReadiness 
        };
      } else {
        // 记录失败日志
        try {
          postLoggingService.log({
            timestamp: Date.now(),
            triggerType,
            postType: 'free',
            mode,
            title: generated.title,
            content: generated.content,
            imageUrls,
            status: 'failed',
            errorMessage: '发布失败',
            taskId: undefined,
          });
        } catch (logError: any) {
          logger.warn(`记录发帖失败日志失败：${logError.message}`);
        }
        
        return { 
          success: false, 
          error: '发布失败', 
          title: generated.title,
          content: generated.content,
          imageUrls,
          source: 'free', 
          mode, 
          featuredReadiness 
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`互联网参考模式失败：${errorMsg}`);
      return { success: false, error: errorMsg, source: 'free' };
    }
  }



  /**
   * 获取最近 N 天内的发帖话题
   */
  private async getRecentTopics(days: number): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    try {
      const result = await postHistoryStorage.queryPosts({
        startDate: cutoff,
        limit: 1000,
      });
      return result.posts
        .filter(p => p.topic)
        .map(p => p.topic!);
    } catch (error) {
      logger.error(`获取最近主题失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 记录发帖历史
   */
  private async recordPost(postId: string, title: string, topic: string, content?: string, imageUrls?: string[]): Promise<void> {
    try {
      const input: CreatePostHistoryInput = {
        id: postId,
        title,
        topic,
        content: content || null,
        imageUrls,
        publishedAt: new Date(),
      };
      await postHistoryStorage.createPost(input);
      logger.debug(`记录发帖历史：${postId}`);
    } catch (error) {
      logger.error(`记录发帖历史失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成发帖内容（不发布），供远程 API 调用
   * @param useTopic 是否使用主题（默认 true）
   * @param mode 发帖模式（可选）
   * @param topicId 指定主题 ID（可选）
   * @returns 包含 taskId 的响应，客户端发布后需回调确认
   */
  async generatePostContent(options?: {
    useTopic?: boolean;
    mode?: PostingMode;
    topicId?: string;
  }): Promise<{
    success: boolean;
    data?: {
      taskId: string;        // 待确认记录 ID，客户端发布后需回调
      title: string;
      content: string;
      images: ImageInfo[];
      mode: PostingMode;
      topics?: MatchedTopic[];
      metadata: {
        topicId?: string;
        topicTitle?: string;
        subDirectionIndex?: number;
        generatedAt: string;
      };
    };
    error?: string;
  }> {
    try {
      const config = loadConfig();
      const useTopic = options?.useTopic ?? true;
      const featuredEnabled = options?.mode ? options.mode === 'featured' : config.featuredPosting.enabled;
      const triggerType = 'auto';  // API 调用视为自动触发

      // 获取主题（如果启用）
      let topic: Topic | null = null;
      if (useTopic) {
        if (options?.topicId) {
          // 指定主题 ID
          const topics = await getAllTopics();
          topic = topics.find(t => t.id === options.topicId) || null;
        } else {
          // 随机选择一个未使用的主题（远程 API 模式）
          const topics = await getAllTopics();
          const availableTopics = topics.filter(t => t.status === 'unused');
          topic = availableTopics.length > 0 
            ? availableTopics[Math.floor(Math.random() * availableTopics.length)]
            : null;
        }
      }

      let generated: GeneratedPost;
      let imagePaths: string[] = [];
      let topicId: string | undefined;
      let topicTitle: string | undefined;
      let subDirectionIndex: number | undefined;
      let materialSelectionResult: MaterialSelectionResult | null = null;

      if (topic) {
        // 使用主题发帖 - 【集成所有优化逻辑】
        topicId = topic.id;
        topicTitle = topic.title;
        
        logger.info(`使用预配置主题生成内容："${topic.title}"`);
        const recentTopics = await this.getRecentTopics(7);

        // 【第二步优化】使用加权均衡的子方向选择
        const extendedTopic = topic as ExtendedTopic;
        const selectedSubDirectionIndex = await topicDiversityService.selectBalancedSubDirection(topic.id);
        const subDirection = extendedTopic.subDirections?.[selectedSubDirectionIndex];
        subDirectionIndex = subDirection ? selectedSubDirectionIndex : undefined;
        
        if (!subDirection) {
          logger.warn(`主题 "${topic.title}" 没有可用的子方向，使用默认 direction`);
        } else {
          logger.info(`【多样化】选择子方向 #${selectedSubDirectionIndex}: ${subDirection.direction || 'N/A'}`);
        }

        // 【第二步优化】生成提纲变体（50% 概率使用变体）
        let finalOutline = subDirection?.outline || topic.outline;
        if (Math.random() < 0.5 && finalOutline) {
          try {
            const variant: OutlineVariant = await topicDiversityService.generateOutlineVariant(
              finalOutline,
              topic.title
            );
            finalOutline = variant.variant;
            logger.info(`【多样化】使用提纲变体：风格="${variant.style}"`);
          } catch (err) {
            logger.warn(`生成提纲变体失败，使用原提纲`);
          }
        }

        const topicConstraint = subDirection
          ? `子方向：${subDirection.direction}${finalOutline ? `\n内容提纲：${finalOutline}` : ''}`
          : `主题方向：${topic.direction}${finalOutline ? `\n内容提纲：${finalOutline}` : ''}`;

        // 1. 读取全局人设
        const globalPrompt = loadGlobalPrompt() ?? undefined;

        // 2. 生成内容，带标题去重校验
        const dedupResult = await this.generatePostWithDedup(
          topic,
          recentTopics,
          topicConstraint,
          globalPrompt,
          featuredEnabled ? 'featured' : 'normal'
        );

        if (!dedupResult) {
          logger.warn('标题去重失败，返回空内容');
          return {
            success: false,
            error: '标题去重失败',
          };
        }
        
        generated = dedupResult;

        // 3. 【第三步优化】选择素材（主题发帖优先使用本地素材）
        const minImages = config.featuredPosting.minImages;
        
        // ⭐ 主题发帖逻辑：优先使用本地素材，不足时才从网络获取
        const hasLocalMaterials = topic.materialPaths && topic.materialPaths.length > 0;
        
        if (hasLocalMaterials) {
          // 有本地素材，只使用本地素材
          logger.info(`远程 API 主题发帖：使用本地素材（${topic.materialPaths.length}个）`);
          try {
            materialSelectionResult = await hybridMaterialService.selectHybridMaterials({
              priorityMode: 'local-first',
              localRatio: 1.0,  // 100% 本地素材
              title: generated!.title,
              internetReferences: [],
              neededCount: minImages,
            });
            
            if (materialSelectionResult && materialSelectionResult.selectedMaterials.length > 0) {
              imagePaths = materialSelectionResult.selectedMaterials.map((m: any) => m.path);
              logger.info(`【本地素材】选中 ${imagePaths.length} 张图片`);
            } else {
              logger.warn('本地素材匹配未返回结果，使用 fallback 逻辑');
              imagePaths = this.selectImagesFallback(generated!.title, generated!.content, topic, subDirection, minImages, featuredEnabled);
            }
          } catch (err) {
            logger.warn(`本地素材选择失败，回退到 fallback：${err instanceof Error ? (err as Error).message : String(err)}`);
            imagePaths = this.selectImagesFallback(generated!.title, generated!.content, topic, subDirection, minImages, featuredEnabled);
          }
        } else {
          // 没有本地素材，使用 fallback 逻辑
          logger.info('远程 API 主题发帖：没有本地素材，使用 fallback 逻辑');
          imagePaths = this.selectImagesFallback(generated!.title, generated!.content, topic, subDirection, minImages, featuredEnabled);
        }

        // 【第二步优化】生成多样化标题（30% 概率使用 AI 生成的多样化标题）
        let finalTitle = generated.title;
        if (Math.random() < 0.3) {
          try {
            finalTitle = await topicDiversityService.generateDiverseTitle({
              baseTopic: topic.title,
              keyPoints: [subDirection?.direction || topic.direction],
              emotion: 'positive',
            });
            logger.info(`【多样化】使��� AI 生成标题："${finalTitle}"`);
          } catch (err) {
            logger.warn(`生成多样化标题失败，使用原标题`);
          }
        }
        generated.title = finalTitle;

        // 【第二步优化】生成内容变体（20% 概率使用变体）
        if (Math.random() < 0.2) {
          try {
            const variant = await topicDiversityService.generateContentVariant(
              generated.content,
              {
                perspective: Math.random() < 0.5 ? 'first' : 'third',
                structure: ['chronological', 'problem-solution', 'pros-cons'][
                  Math.floor(Math.random() * 3)
                ] as any,
                tone: ['casual', 'formal', 'enthusiastic'][
                  Math.floor(Math.random() * 3)
                ] as any,
              }
            );
            generated.content = variant;
            logger.info(`【多样化】使用内容变体：长度变化 ${generated.content.length} 字`);
          } catch (err) {
            logger.warn(`生成内容变体失败，使用原内容`);
          }
        }

        // 【第一步优化】合规性检查
        const complianceCheckEnabled = config.contentDeduplication?.enabled !== false;
        if (complianceCheckEnabled) {
          try {
            const complianceResult = await complianceCheckOrchestrator.performComplianceCheck({
              title: generated.title,
              content: generated.content,
              imageCount: imagePaths.length,
              topicId: topic.id,
              topicName: topic.title,
              triggerType,
            });
            
            if (!complianceResult.passed) {
              logger.warn(`合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`);
              
              if (complianceResult.filteredContent) {
                generated.content = complianceResult.filteredContent;
                logger.info(`已自动替换敏感词`);
              } else {
                return {
                  success: false,
                  error: `合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`,
                };
              }
            }
            
            logger.info(`【合规性检查】通过 (${complianceResult.qualityScore?.finalScore || 'N/A'}分)`);
          } catch (err) {
            logger.error(`合规性检查异常`);
          }
        }

        // 防重检查：检查待确认记录中是否有重复
        const isDup = await pendingPostService.isDuplicate(generated.title, generated.content);
        if (isDup) {
          logger.warn(`检测到重复内容，拒绝生成：${generated.title}`);
          return {
            success: false,
            error: '内容与待确认记录重复',
          };
        }
      } else {
        // 自由生成模式 - 【集成混合素材服务】
        logger.info('使用自由生成模式（互联网参考）生成内容');
        
        const references = await search(undefined);
        if (!references || references.length === 0) {
          return {
            success: false,
            error: '互联网参考查询未返回结果',
          };
        }

        const recentTopics = await this.getRecentTopics(config.post.avoidRepeatDays);
        const topic = references[0].title || '奥迪用车分享';
        const globalPrompt = loadGlobalPrompt() ?? undefined;

        generated = await this.generatePostWithMinChars(
          topic,
          recentTopics,
          undefined,
          {
            globalPrompt,
            referenceTexts: references,
            mode: featuredEnabled ? 'featured' : 'normal',
          },
          featuredEnabled ? config.featuredPosting.minContentChars : config.contentLimits.post.min,
          featuredEnabled ? config.featuredPosting.maxGenerateRetries : 0
        );

        // 抄袭检测
        if (detectPlagiarism(generated.content, references)) {
          return {
            success: false,
            error: '生成内容存在抄袭嫌疑',
          };
        }

        // 防重检查：检查待确认记录中是否有重复
        const isDup = await pendingPostService.isDuplicate(generated.title, generated.content);
        if (isDup) {
          logger.warn(`检测到重复内容，拒绝生成：${generated.title}`);
          return {
            success: false,
            error: '内容与待确认记录重复',
          };
        }

        // 【第三步优化】使用混合素材服务选择图片
        const minImages = config.featuredPosting.minImages;
        const hybridConfig = config.hybridMaterial;
        
        // 收集互联网参考素材
        const internetReferences: InternetReference[] = [];
        for (const ref of references) {
          const imageUrls = ref.processedImageUrls && ref.processedImageUrls.length > 0
            ? ref.processedImageUrls
            : ref.imageUrls || [];
          
          if (imageUrls.length > 0) {
            internetReferences.push({
              title: ref.title || '',
              content: ref.content || '',
              source: ref.source || 'internet',
              url: ref.url || '',
              imageUrls,
            });
          }
        }

        // 使用混合素材服务
        if (hybridConfig?.enabled && internetReferences.length > 0) {
          try {
            materialSelectionResult = await hybridMaterialService.selectHybridMaterials({
              priorityMode: hybridConfig.priorityMode || 'hybrid',
              localRatio: hybridConfig.localRatio ?? 0.6,
              title: generated.title,
              internetReferences,
              neededCount: minImages,
            });
            
            // 提取本地素材路径
            if (materialSelectionResult) {
              imagePaths = materialSelectionResult.selectedMaterials.map((m: any) => m.path);
              logger.info(`【混合素材】${materialSelectionResult.strategy}，选中 ${imagePaths.length} 张图片`);
            }
            
          } catch (err) {
            logger.warn(`混合素材选择失败，回退到原逻辑：${err instanceof Error ? (err as Error).message : String(err)}`);
            imagePaths = await this.selectImagesFallbackForFreeStyle(generated.title, generated.content, references, minImages);
          }
        } else {
          // 回退到原逻辑
          imagePaths = await this.selectImagesFallbackForFreeStyle(generated.title, generated.content, references, minImages);
        }

        // 【第一步优化】合规性检查（自由模式也需要）
        const complianceCheckEnabled = config.contentDeduplication?.enabled !== false;
        if (complianceCheckEnabled) {
          try {
            const complianceResult = await complianceCheckOrchestrator.performComplianceCheck({
              title: generated.title,
              content: generated.content,
              imageCount: imagePaths.length,
              topicId: undefined,
              topicName: '自由发帖',
              triggerType,
            });
            
            if (!complianceResult.passed) {
              logger.warn(`合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`);
              
              if (complianceResult.filteredContent) {
                generated.content = complianceResult.filteredContent;
                logger.info(`已自动替换敏感词`);
              } else {
                return {
                  success: false,
                  error: `合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`,
                };
              }
            }
            
            logger.info(`【合规性检查】通过 (${complianceResult.qualityScore?.finalScore || 'N/A'}分)`);
          } catch (err) {
            logger.error(`合规性检查异常`);
          }
        }
      }

      // 生成图片元数据
      const images = imagePaths.map(p => generateImageMetadata(p));

      // 话题匹配
      let topics: MatchedTopic[] | undefined;
      try {
        // 注意：这里需要 token，但 API 模式下由手机端发布，所以可选
        // 如果需要，可以通过参数传入 token
        const hotTopics = await fetchHotTopics('');
        if (hotTopics.length > 0) {
          topics = await matchTopics(generated.title, generated.content, hotTopics);
        }
      } catch (error: any) {
        logger.warn(`话题匹配失败：${error.message}`);
        topics = undefined;
      }

      // 评估精华准备度
      const mode: PostingMode = featuredEnabled ? 'featured' : 'normal';

      // 生成 taskId
      const taskId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 持久化待确认记录
      const pendingPost: PendingPost = {
        taskId,
        topicId,
        title: generated.title,
        content: generated.content,
        images,
        topics,
        mode,
        createdAt: Date.now(),
        subDirectionIndex,
      };
      pendingPostService.save(pendingPost);
      logger.info(`已保存待确认记录：${taskId} (${generated.title})`);

      return {
        success: true,
        data: {
          taskId,
          title: generated.title,
          content: generated.content,
          images,
          mode,
          topics,
          metadata: {
            topicId,
            topicTitle,
            subDirectionIndex,
            generatedAt: new Date().toISOString(),
          },
        },
      };
    } catch (error: any) {
      logger.error(`生成发帖内容失败：${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }



  /**
   * 【第三步优化】图片选择回退方法（原逻辑）
   */
  private selectImagesFallback(
    title: string,
    content: string,
    topic: Topic,
    subDirection: any,
    minImages: number,
    featuredEnabled: boolean
  ): string[] {
    const config = loadConfig();
    const contentKeywords = `${title} ${content}`.substring(0, 500);
    
    const imageCandidates = featuredEnabled
      ? selectFeaturedImageCandidates({
          keywords: topic.materialPaths && topic.materialPaths.length > 0 
            ? subDirection?.direction || topic.direction
            : contentKeywords,
          materialPaths: topic.materialPaths,
          minCount: minImages,
        })
      : selectImages(
          topic.materialPaths && topic.materialPaths.length > 0 
            ? subDirection?.direction || topic.direction 
            : contentKeywords,
          topic.materialPaths
        );
    
    return featuredEnabled ? imageCandidates.slice(0, 9) : imageCandidates;
  }

  /**
   * 【第三步优化】自由发帖模式的图片选择回退方法
   */
  private async selectImagesFallbackForFreeStyle(
    title: string,
    content: string,
    references: any[],
    minImages: number
  ): Promise<string[]> {
    const config = loadConfig();
    const featuredEnabled = config.featuredPosting.enabled;
    let imagePaths: string[] = [];

    // 1. 优先收集去水印后的图片 URL（processedImageUrls）
    const processedImageUrls: string[] = [];
    const originalImageUrls: string[] = [];
    
    for (const ref of references) {
      // 优先使用处理后的图片 URL
      if (ref.processedImageUrls && ref.processedImageUrls.length > 0) {
        processedImageUrls.push(...ref.processedImageUrls);
      } else if (ref.imageUrls && ref.imageUrls.length > 0) {
        // 降级使用原始图片 URL
        originalImageUrls.push(...ref.imageUrls);
      }
    }

    const referenceImageUrls = processedImageUrls.length > 0 ? processedImageUrls : originalImageUrls;
    const imageUrlSource = processedImageUrls.length > 0 ? '去水印后' : '原始';

    // 2. 尝试下载参考图片
    if (referenceImageUrls.length > 0) {
      logger.info(`参考帖子包含 ${referenceImageUrls.length} 个${imageUrlSource}图片 URL，开始下载`);
      try {
        imagePaths = await downloadImages(referenceImageUrls);
        if (imagePaths.length > 0) {
          logger.info(`成功下载 ${imagePaths.length} 张${imageUrlSource}参考图片`);
        }
      } catch (err: any) {
        logger.warn(`参考图片下载异常：${err.message}`);
      }
    }

    // 3. 如果参考图片下载失败或没有参考图片，使用混合素材服务匹配本地素材
    if (imagePaths.length === 0) {
      logger.info(`参考图片下载失败或没有参考图片，尝试使用混合素材服务匹配本地素材`);
      
      const hybridConfig = config.hybridMaterial;
      if (hybridConfig?.enabled) {
        try {
          // 即使没有互联网参考素材，也调用混合素材服务来匹配本地素材
          const materialSelectionResult = await hybridMaterialService.selectHybridMaterials({
            priorityMode: hybridConfig.priorityMode || 'local-first',  // 改为本地优先
            localRatio: hybridConfig.localRatio ?? 0.6,
            title: title,
            internetReferences: [],  // 空的互联网参考
            neededCount: minImages,
          });
          
          if (materialSelectionResult && materialSelectionResult.selectedMaterials.length > 0) {
            imagePaths = materialSelectionResult.selectedMaterials.map((m: any) => m.path);
            logger.info(`【混合素材回退】${materialSelectionResult.strategy}，选中 ${imagePaths.length} 张图片`);
          } else {
            logger.warn(`混合素材服务未返回任何素材`);
          }
        } catch (err: any) {
          logger.warn(`混合素材服务调用失败，回退到旧逻辑：${err.message}`);
          imagePaths = selectImages(title + ' ' + content);
        }
      } else {
        // 混合素材服务未启用，使用旧逻辑
        imagePaths = selectImages(title + ' ' + content);
      }
    }

    return imagePaths;
  }
}
