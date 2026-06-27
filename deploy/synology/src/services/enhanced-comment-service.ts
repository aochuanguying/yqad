/**
 * 增强评论服务（集成 ChromaDB 情感分析）
 * 
 * 功能：
 * 1. 基于原有 CommentService
 * 2. 在评论创建时自动进行情感分析
 * 3. 检测疑似水军评论
 * 4. 统计情感分布
 * 
 * 技术栈：
 * - MySQL: 存储评论数据
 * - ChromaDB: 存储评论向量，情感分析
 */

import { getCommentService } from './comment-service';
import { commentSentimentStorage, CommentVectorMetadata } from '../storage/chroma/comment-sentiment-storage';
import { embeddingVectorizer } from '../utils/embedding-vectorizer';
import { getLogger } from '../utils/logger';
import { loadConfig } from '../utils/config';

const logger = getLogger('enhanced-comment-service');

/**
 * 增强评论服务类
 */
class EnhancedCommentService {
  private baseService = getCommentService();

  /**
   * 创建评论（带情感分析）
   */
  async createCommentWithSentimentAnalysis(input: {
    post_id: string;
    content: string;
    user_id?: string;
    parent_id?: string;
  }) {
    const config = loadConfig();
    
    // 1. 使用基础服务创建评论（MySQL 存储）
    const comment = await this.baseService.createComment(input);
    logger.info(`评论创建成功：${comment.id}`);

    // 2. 异步进行情感分析（不阻塞主流程）
    if (config.enhancedCommentService?.enableSentimentAnalysis !== false) {
      // 使用 setImmediate 异步执行，不阻塞返回
      setImmediate(async () => {
        try {
          await this.analyzeCommentSentiment(comment);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`评论情感分析失败：${errorMsg}`);
        }
      });
    }

    return comment;
  }

  /**
   * 分析评论情感（内部方法）
   */
  private async analyzeCommentSentiment(comment: any) {
    try {
      // 确保存储已初始化
      if (!commentSentimentStorage.isInitialized) {
        await commentSentimentStorage.initialize();
      }

      // 生成评论向量
      const embedding = await embeddingVectorizer.generateEmbedding(comment.content);

      // 优化的情感分析（基于向量相似度）
      const sentiment = await this.advancedSentimentAnalysis(comment.content);

      // 构建元数据
      const metadata: CommentVectorMetadata = {
        comment_id: comment.id,
        post_id: comment.post_id,
        comment_text: comment.content,
        sentiment: sentiment.sentiment,
        sentiment_score: sentiment.score,
        user_id: comment.user_id,
        created_at: Date.now(),
      };

      // 添加到 ChromaDB
      await commentSentimentStorage.addCommentVector(
        comment.id,
        embedding,
        metadata
      );

      logger.debug(
        `评论情感分析完成：${comment.id} | ` +
        `情感：${sentiment.sentiment} (${sentiment.score.toFixed(2)})`
      );

      // 3. 检测疑似水军
      const suspiciousComments = await commentSentimentStorage.detectSuspiciousComments(
        embedding,
        3600,  // 1 小时时间窗口
        0.9    // 高相似度阈值
      );

      if (suspiciousComments.length > 0) {
        logger.warn(
          `检测到 ${suspiciousComments.length} 条疑似水军评论，与评论 "${comment.id}" 高度相似：` +
          suspiciousComments.map(c => `${c.commentId}(${(c.similarity * 100).toFixed(1)}%)`).join(', ')
        );

        // 可以触发审核流程（这里仅记录日志）
        // await this.triggerReviewProcess(comment.id, suspiciousComments);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`分析评论情感失败：${errorMsg}`);
      throw error;
    }
  }

  /**
   * 优化的情感分析（基于向量相似度）
   * 使用预定义的情感模板向量进行匹配
   */
  private async advancedSentimentAnalysis(text: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; score: number }> {
    // 情感模板（可以预先生成并缓存）
    const templates = {
      positive: [
        '这个活动真不错，非常喜欢',
        '太棒了，支持',
        '很满意，体验很好',
        '优秀的活动，推荐',
        '精彩的体验，赞',
      ],
      negative: [
        '感觉很失望，体验不好',
        '太差了，不满意',
        '糟糕的体验，讨厌',
        '垃圾活动，恶心',
        '差劲的服务，失望',
      ],
      neutral: [
        '一般般吧，没什么特别的',
        '还行，普普通通',
        '不好也不坏',
        '中等水平',
        '就这样吧',
      ],
    };

    try {
      // 生成评论向量
      const textEmbedding = await embeddingVectorizer.generateEmbedding(text);
      
      // 计算与各模板的相似度
      const similarities = {
        positive: await this.calculateMaxSimilarity(textEmbedding, templates.positive),
        negative: await this.calculateMaxSimilarity(textEmbedding, templates.negative),
        neutral: await this.calculateMaxSimilarity(textEmbedding, templates.neutral),
      };

      // 找出最高相似度
      const maxSimilarity = Math.max(
        similarities.positive,
        similarities.negative,
        similarities.neutral
      );

      // 确定情感倾向
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (similarities.positive >= similarities.negative && similarities.positive >= similarities.neutral) {
        sentiment = 'positive';
      } else if (similarities.negative >= similarities.positive && similarities.negative >= similarities.neutral) {
        sentiment = 'negative';
      }

      // 计算情感得分（0-1）
      const score = sentiment === 'positive' 
        ? 0.5 + maxSimilarity * 0.5
        : sentiment === 'negative'
        ? 0.5 - maxSimilarity * 0.5
        : 0.5;

      return { sentiment, score: Math.max(0, Math.min(1, score)) };
    } catch (error) {
      // 降级到简单关键词匹配
      logger.warn(`高级情感分析失败，降级到关键词匹配：${error instanceof Error ? error.message : String(error)}`);
      return this.simpleSentimentAnalysis(text);
    }
  }

  /**
   * 计算文本与模板数组的最大相似度
   */
  private async calculateMaxSimilarity(textEmbedding: number[], templates: string[]): Promise<number> {
    let maxSimilarity = 0;

    for (const template of templates) {
      const templateEmbedding = await embeddingVectorizer.generateEmbedding(template);
      const similarity = this.cosineSimilarity(textEmbedding, templateEmbedding);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 简单的情感分析（基于关键词）- 降级方案
   */
  private simpleSentimentAnalysis(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
    const positiveWords = ['好', '不错', '喜欢', '满意', '优秀', '支持', '赞', '棒', '精彩', '出色'];
    const negativeWords = ['差', '不好', '失望', '讨厌', '糟糕', '垃圾', '烂', '差劲', '垃圾', '恶心'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (text.includes(word)) {
        positiveCount++;
      }
    }

    for (const word of negativeWords) {
      if (text.includes(word)) {
        negativeCount++;
      }
    }

    const totalCount = positiveCount + negativeCount;
    if (totalCount === 0) {
      return { sentiment: 'neutral', score: 0.5 };
    }

    const positiveRatio = positiveCount / totalCount;
    
    if (positiveRatio > 0.6) {
      return { sentiment: 'positive', score: 0.5 + positiveRatio * 0.5 };
    } else if (positiveRatio < 0.4) {
      return { sentiment: 'negative', score: 0.5 - (1 - positiveRatio) * 0.5 };
    } else {
      return { sentiment: 'neutral', score: 0.5 };
    }
  }

  /**
   * 查询相似评论
   */
  async searchSimilarComments(
    query: string,
    nResults: number = 10,
    minSimilarity: number = 0.8
  ) {
    if (!commentSentimentStorage.isInitialized) {
      await commentSentimentStorage.initialize();
    }

    const embedding = await embeddingVectorizer.generateEmbedding(query);
    return await commentSentimentStorage.searchSimilarComments(embedding, nResults, minSimilarity);
  }

  /**
   * 获取情感统计
   */
  async getSentimentStats(postId?: string) {
    if (!commentSentimentStorage.isInitialized) {
      await commentSentimentStorage.initialize();
    }

    const [positive, negative, neutral] = await Promise.all([
      commentSentimentStorage.getCommentsBySentiment('positive', 100),
      commentSentimentStorage.getCommentsBySentiment('negative', 100),
      commentSentimentStorage.getCommentsBySentiment('neutral', 100),
    ]);

    const total = positive.length + negative.length + neutral.length;

    return {
      total,
      positive: {
        count: positive.length,
        percentage: total > 0 ? ((positive.length / total) * 100).toFixed(1) + '%' : '0%',
      },
      negative: {
        count: negative.length,
        percentage: total > 0 ? ((negative.length / total) * 100).toFixed(1) + '%' : '0%',
      },
      neutral: {
        count: neutral.length,
        percentage: total > 0 ? ((neutral.length / total) * 100).toFixed(1) + '%' : '0%',
      },
    };
  }

  /**
   * 检测疑似水军评论
   */
  async detectSuspiciousComments(commentId: string, timeWindowSeconds: number = 3600) {
    if (!commentSentimentStorage.isInitialized) {
      await commentSentimentStorage.initialize();
    }

    // 获取评论的向量
    const comment = await this.baseService.getCommentById(commentId);
    if (!comment) {
      throw new Error(`评论不存在：${commentId}`);
    }

    const embedding = await embeddingVectorizer.generateEmbedding(comment.content);
    return await commentSentimentStorage.detectSuspiciousComments(embedding, timeWindowSeconds, 0.9);
  }

  /**
   * 委托方法到基础服务
   */
  async getCommentById(id: string) {
    return await this.baseService.getCommentById(id);
  }

  async getCommentsByPostId(postId: string, page: number = 1, pageSize: number = 20) {
    return await this.baseService.getCommentsByPostId(postId, page, pageSize);
  }

  async updateComment(id: string, input: any) {
    return await this.baseService.updateComment(id, input);
  }

  async moderateComment(id: string, status: string) {
    return await this.baseService.moderateComment(id, status);
  }

  async deleteComment(id: string) {
    return await this.baseService.deleteComment(id);
  }

  async getCommentTree(postId: string) {
    return await this.baseService.getCommentTree(postId);
  }
}

// 导出单例
export const enhancedCommentService = new EnhancedCommentService();

// 导出工厂函数
export function getEnhancedCommentService() {
  return enhancedCommentService;
}
