/**
 * 内容去重服务（使用 ChromaDB + OpenAI Embedding）
 * 
 * 功能：
 * 1. 基于 OpenAI Embedding 生成高质量向量
 * 2. 基于 ChromaDB 进行语义相似度搜索
 * 3. 与历史发帖进行比对，检测重复内容
 * 4. 支持标题和内容的加权相似度计算
 * 
 * 技术栈：
 * - OpenAI Embedding API (text-embedding-3-small, 1536 维)
 * - ChromaDB 向量数据库
 * - 语义相似度（cosine similarity）
 */

import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { getPostHistoryStorage } from '../storage/mysql/post-history-storage';
import { chromaSearchService } from './chroma-search-service';

const logger = getLogger('content-deduplication');

/**
 * 历史发帖内容记录
 */
export interface PostHistoryContent {
  postId: string;
  title: string;
  content: string;
  timestamp: string;
  topic?: string;
}

/**
 * 相似度检测结果
 */
export interface SimilarityCheckResult {
  isDuplicate: boolean;
  maxSimilarity: number;
  matchedPostId?: string;
  matchedTitle?: string;
  similarityDetails: {
    titleSimilarity: number;
    contentSimilarity: number;
    weightedSimilarity: number;
  };
}



/**
 * 内容去重服务类（使用 ChromaDB）
 */
class ContentDeduplicationService {
  private postHistoryStorage = getPostHistoryStorage();

  /**
   * 检查内容相似度（使用 ChromaDB + OpenAI Embedding）
   * @param title 帖子标题
   * @param content 帖子内容
   * @returns 相似度检测结果
   */
  async checkSimilarity(title: string, content: string): Promise<SimilarityCheckResult> {
    const config = loadConfig();
    const threshold = config.contentDeduplication?.similarityThreshold || 0.85;

    try {
      // 使用 ChromaDB Service 进行语义去重检测
      const result = await chromaSearchService.checkContentDuplicate(title, content);
      
      logger.info(
        `相似度检测：最高相似度=${result.maxSimilarity.toFixed(3)}, ` +
        `阈值=${threshold}, 结果=${result.isDuplicate ? '重复' : '通过'}` +
        (result.matchedTitle ? `, 匹配帖子："${result.matchedTitle}"` : '')
      );

      return {
        isDuplicate: result.isDuplicate,
        maxSimilarity: result.maxSimilarity,
        matchedPostId: result.matchedPostId,
        matchedTitle: result.matchedTitle,
        similarityDetails: {
          titleSimilarity: result.maxSimilarity,
          contentSimilarity: result.maxSimilarity,
          weightedSimilarity: result.maxSimilarity,
        },
      };
    } catch (error) {
      logger.error('内容相似度检测失败:', error);
      // 降级方案：返回不重复
      return {
        isDuplicate: false,
        maxSimilarity: 0,
        matchedPostId: undefined,
        matchedTitle: undefined,
        similarityDetails: {
          titleSimilarity: 0,
          contentSimilarity: 0,
          weightedSimilarity: 0,
        },
      };
    }
  }

  /**
   * 批量检查相似度
   */
  async batchCheckSimilarity(posts: Array<{ title: string; content: string }>): Promise<SimilarityCheckResult[]> {
    return Promise.all(posts.map(post => this.checkSimilarity(post.title, post.content)));
  }

  /**
   * 添加发帖记录到历史
   */
  async addPostToHistory(post: PostHistoryContent): Promise<void> {
    try {
      // 转换为 MySQL 格式
      const input = {
        id: post.postId,
        title: post.title,
        topic: post.topic || null,
        content: post.content || null,
        imageUrls: [],
        publishedAt: new Date(post.timestamp),
      };
      
      await this.postHistoryStorage.createPost(input);
      logger.debug(`已保存发帖历史记录：${post.postId}`);
    } catch (error) {
      logger.error(`保存发帖历史记录失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例
export const contentDeduplicationService = new ContentDeduplicationService();
