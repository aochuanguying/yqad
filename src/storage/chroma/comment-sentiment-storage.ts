/**
 * 评论情感分析 - ChromaDB
 * 
 * 功能：
 * 1. 存储评论的向量表示
 * 2. 情感聚类分析
 * 3. 识别相似评论（水军检测）
 * 4. 热门评论主题挖掘
 * 
 * 使用场景：
 * - 评论情感分析
 * - 水军评论检测
 * - 评论主题聚类
 */

import { Collection } from 'chromadb';
import { getChromaCollection } from '../../utils/chroma-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('comment-sentiment-storage');

/**
 * 评论向量元数据
 */
export interface CommentVectorMetadata {
  /** 评论 ID */
  comment_id: string;
  /** 帖子 ID */
  post_id?: string;
  /** 评论内容 */
  comment_text: string;
  /** 情感倾向 (positive/negative/neutral) */
  sentiment?: 'positive' | 'negative' | 'neutral';
  /** 情感得分 (0-1) */
  sentiment_score?: number;
  /** 用户 ID */
  user_id?: string;
  /** 创建时间戳 */
  created_at?: number;
  [key: string]: any;
}

/**
 * 相似评论检测结果
 */
export interface SimilarCommentResult {
  /** 评论 ID */
  commentId: string;
  /** 相似度分数 */
  similarity: number;
  /** 元数据 */
  metadata: CommentVectorMetadata;
}

/**
 * 情感聚类结果
 */
export interface SentimentCluster {
  /** 聚类 ID */
  clusterId: string;
  /** 评论数量 */
  count: number;
  /** 平均情感得分 */
  avgSentimentScore: number;
  /** 代表评论 */
  representativeComments: string[];
}

/**
 * 评论情感存储类
 */
class CommentSentimentStorage {
  private collectionName = 'prod_comment_sentiment'; // 使用下划线前缀，与 chroma-connection-manager 一致
  private collection: Collection | null = null;
  private initialized: boolean = false;

  /**
   * 检查是否已初始化
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.collection = await getChromaCollection(this.collectionName);
      this.initialized = true;
      logger.debug('CommentSentimentStorage 初始化成功');
    } catch (error) {
      logger.error('CommentSentimentStorage 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.collection) {
      throw new Error('CommentSentimentStorage 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 添加评论向量
   * @param id 评论 ID
   * @param embedding 向量数组
   * @param metadata 元数据
   */
  async addCommentVector(
    id: string,
    embedding: number[],
    metadata: CommentVectorMetadata
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.add({
        ids: [`comment_${id}`],
        embeddings: [embedding],
        metadatas: [metadata],
      });

      logger.debug(`添加评论向量：comment_${id}`);
    } catch (error) {
      logger.error(`添加评论向量失败：comment_${id}`, error);
      throw error;
    }
  }

  /**
   * 批量添加评论向量
   * @param ids 评论 ID 数组
   * @param embeddings 向量数组
   * @param metadatas 元数据数组
   */
  async addCommentVectors(
    ids: string[],
    embeddings: number[][],
    metadatas: CommentVectorMetadata[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        // 添加 comment_ 前缀
        const prefixedIds = batchIds.map(id => `comment_${id}`);

        await this.collection!.add({
          ids: prefixedIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        logger.debug(`批量添加评论向量：${i + batchIds.length}/${ids.length}`);
      }

      logger.info(`批量添加 ${ids.length} 个评论向量成功`);
    } catch (error) {
      logger.error('批量添加评论向量失败:', error);
      throw error;
    }
  }

  /**
   * 更新评论向量
   * @param id 评论 ID
   * @param embedding 新的向量
   * @param metadata 新的元数据（可选）
   */
  async updateCommentVector(
    id: string,
    embedding: number[],
    metadata?: Partial<CommentVectorMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const updateData: any = {
        ids: [`comment_${id}`],
        embeddings: [embedding],
      };

      if (metadata) {
        updateData.metadatas = [metadata];
      }

      await this.collection!.update(updateData);

      logger.debug(`更新评论向量：comment_${id}`);
    } catch (error) {
      logger.error(`更新评论向量失败：comment_${id}`, error);
      throw error;
    }
  }

  /**
   * 删除评论向量
   * @param id 评论 ID
   */
  async deleteCommentVector(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.delete({
        ids: [`comment_${id}`],
      });

      logger.debug(`删除评论向量：comment_${id}`);
    } catch (error) {
      logger.error(`删除评论向量失败：comment_${id}`, error);
      throw error;
    }
  }

  /**
   * 搜索相似评论
   * @param queryEmbedding 查询向量
   * @param nResults 返回结果数量（默认 10）
   * @param minSimilarity 最小相似度阈值（默认 0.8）
   * @returns 相似评论结果
   */
  async searchSimilarComments(
    queryEmbedding: number[],
    nResults: number = 10,
    minSimilarity: number = 0.8
  ): Promise<SimilarCommentResult[]> {
    this.ensureInitialized();

    try {
      const results = await this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ['metadatas', 'distances'],
      });

      // 转换结果格式并过滤
      const similarComments: SimilarCommentResult[] = [];
      
      if (results.ids && results.ids.length > 0 && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const distance = results.distances?.[0]?.[i] || 0;
          const metadata = results.metadatas?.[0]?.[i] as unknown as CommentVectorMetadata;
          
          // ChromaDB 返回的是距离，需要转换为相似度
          const similarity = 1 - distance;
          
          // 过滤低相似度
          if (similarity >= minSimilarity) {
            similarComments.push({
              commentId: id.replace(/^comment_/, ''),
              similarity,
              metadata: metadata || {} as CommentVectorMetadata,
            });
          }
        }
      }

      logger.debug(`相似评论搜索：找到 ${similarComments.length} 个结果（阈值：${minSimilarity}）`);
      
      return similarComments;
    } catch (error) {
      logger.error('相似评论搜索失败:', error);
      return [];
    }
  }

  /**
   * 检测疑似水军评论（高度相似的评论）
   * @param commentEmbedding 评论向量
   * @param timeWindowSeconds 时间窗口（秒，默认 3600 秒=1 小时）
   * @param minSimilarity 最小相似度阈值（默认 0.9）
   * @returns 疑似水军评论列表
   */
  async detectSuspiciousComments(
    commentEmbedding: number[],
    timeWindowSeconds: number = 3600,
    minSimilarity: number = 0.9
  ): Promise<SimilarCommentResult[]> {
    this.ensureInitialized();

    try {
      // 搜索高度相似的评论
      const similarComments = await this.searchSimilarComments(
        commentEmbedding,
        20,  // 多返回一些用于时间窗口筛选
        minSimilarity
      );

      // 过滤时间窗口内的评论
      const now = Date.now();
      const windowStart = now - (timeWindowSeconds * 1000);
      
      const suspiciousComments = similarComments.filter(c => {
        const commentTime = c.metadata.created_at || 0;
        return commentTime >= windowStart && commentTime <= now;
      });

      if (suspiciousComments.length > 0) {
        logger.warn(
          `检测到 ${suspiciousComments.length} 条疑似水军评论 ` +
          `(时间窗口：${timeWindowSeconds}秒，相似度>${minSimilarity})`
        );
      }

      return suspiciousComments;
    } catch (error) {
      logger.error('检测疑似水军评论失败:', error);
      return [];
    }
  }

  /**
   * 按情感倾向筛选评论
   * @param sentiment 情感倾向
   * @param nResults 返回结果数量（默认 20）
   * @returns 评论结果
   */
  async getCommentsBySentiment(
    sentiment: 'positive' | 'negative' | 'neutral',
    nResults: number = 20
  ): Promise<SimilarCommentResult[]> {
    this.ensureInitialized();

    try {
      // 获取所有评论（通过空查询）
      const results = await this.collection!.get({
        where: {
          sentiment: sentiment,
        },
        limit: nResults,
        include: ['metadatas'],
      });

      const comments: SimilarCommentResult[] = [];
      
      if (results.ids && results.ids.length > 0 && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const metadata = results.metadatas?.[0]?.[i] as unknown as CommentVectorMetadata;
          
          comments.push({
            commentId: id.replace(/^comment_/, ''),
            similarity: 1.0,  // 精确匹配
            metadata: metadata || ({} as CommentVectorMetadata),
          });
        }
      }

      return comments;
    } catch (error) {
      logger.error('按情感倾向筛选评论失败:', error);
      return [];
    }
  }

  /**
   * 获取向量数量
   */
  async count(): Promise<number> {
    this.ensureInitialized();

    try {
      const collection = await this.collection!.get();
      return collection.ids.length;
    } catch (error) {
      logger.error('获取向量数量失败:', error);
      return 0;
    }
  }

  /**
   * 清空所有向量
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    try {
      const collection = await this.collection!.get();
      if (collection.ids && collection.ids.length > 0) {
        await this.collection!.delete({
          ids: collection.ids,
        });
        logger.info('已清空所有评论情感向量');
      }
    } catch (error) {
      logger.error('清空评论情感向量失败:', error);
      throw error;
    }
  }

  /**
   * 获取 Collection 信息
   */
  async getCollectionInfo(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        name: this.collection!.name,
        metadata: this.collection!.metadata,
        count: await this.count(),
      };
    } catch (error) {
      logger.error('获取 Collection 信息失败:', error);
      return null;
    }
  }
}

// 导出单例
export const commentSentimentStorage = new CommentSentimentStorage();

// 导出便捷函数
export async function initCommentSentimentStorage(): Promise<void> {
  await commentSentimentStorage.initialize();
}

export async function addCommentVector(
  id: string,
  embedding: number[],
  metadata: CommentVectorMetadata
): Promise<void> {
  if (!commentSentimentStorage.isInitialized) {
    await commentSentimentStorage.initialize();
  }
  return commentSentimentStorage.addCommentVector(id, embedding, metadata);
}

export async function searchSimilarComments(
  queryEmbedding: number[],
  nResults?: number,
  minSimilarity?: number
): Promise<SimilarCommentResult[]> {
  if (!commentSentimentStorage.isInitialized) {
    await commentSentimentStorage.initialize();
  }
  return commentSentimentStorage.searchSimilarComments(queryEmbedding, nResults, minSimilarity);
}

export async function detectSuspiciousComments(
  commentEmbedding: number[],
  timeWindowSeconds?: number,
  minSimilarity?: number
): Promise<SimilarCommentResult[]> {
  if (!commentSentimentStorage.isInitialized) {
    await commentSentimentStorage.initialize();
  }
  return commentSentimentStorage.detectSuspiciousComments(commentEmbedding, timeWindowSeconds, minSimilarity);
}
