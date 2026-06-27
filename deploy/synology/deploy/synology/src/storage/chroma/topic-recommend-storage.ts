/**
 * 主题推荐向量存储 - ChromaDB
 * 
 * 功能：
 * 1. 存储主题的向量表示
 * 2. 支持语义相似度搜索
 * 3. 支持主题推荐
 * 4. 支持向量更新和删除
 * 
 * 使用场景：
 * - 根据当前主题推荐相关主题
 * - 主题语义搜索
 * - 主题聚类分析
 */

import { Collection } from 'chromadb';
import { getChromaCollection } from '../../utils/chroma-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('topic-recommend-storage');

/**
 * 主题向量元数据
 */
export interface TopicVectorMetadata {
  /** 主题名称 */
  topic_name: string;
  /** 主题方向 */
  topic_direction?: string;
  /** 主题提纲 */
  topic_outline?: string;
  /** 标签 */
  tags?: string;
  /** 创建时间戳 */
  created_at?: number;
  [key: string]: any;
}

/**
 * 主题推荐结果
 */
export interface TopicRecommendResult {
  /** 主题 ID */
  topicId: string;
  /** 相似度分数 */
  similarity: number;
  /** 元数据 */
  metadata: TopicVectorMetadata;
}

/**
 * 主题推荐存储类
 */
class TopicRecommendStorage {
  private collectionName = getPrefixedCollectionName('topic_recommend');
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
      logger.debug('TopicRecommendStorage 初始化成功');
    } catch (error) {
      logger.error('TopicRecommendStorage 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.collection) {
      throw new Error('TopicRecommendStorage 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 添加主题向量
   * @param id 主题 ID
   * @param embedding 向量数组
   * @param metadata 元数据
   */
  async addTopicVector(
    id: string,
    embedding: number[],
    metadata: TopicVectorMetadata
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.add({
        ids: [`topic_${id}`],
        embeddings: [embedding],
        metadatas: [metadata],
      });

      logger.debug(`添加主题向量：topic_${id}`);
    } catch (error) {
      logger.error(`添加主题向量失败：topic_${id}`, error);
      throw error;
    }
  }

  /**
   * 批量添加主题向量
   * @param ids 主题 ID 数组
   * @param embeddings 向量数组
   * @param metadatas 元数据数组
   */
  async addTopicVectors(
    ids: string[],
    embeddings: number[][],
    metadatas: TopicVectorMetadata[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        // 添加 topic_ 前缀
        const prefixedIds = batchIds.map(id => `topic_${id}`);

        await this.collection!.add({
          ids: prefixedIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        logger.debug(`批量添加主题向量：${i + batchIds.length}/${ids.length}`);
      }

      logger.info(`批量添加 ${ids.length} 个主题向量成功`);
    } catch (error) {
      logger.error('批量添加主题向量失败:', error);
      throw error;
    }
  }

  /**
   * 更新主题向量
   * @param id 主题 ID
   * @param embedding 新的向量
   * @param metadata 新的元数据（可选）
   */
  async updateTopicVector(
    id: string,
    embedding: number[],
    metadata?: Partial<TopicVectorMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const updateData: any = {
        ids: [`topic_${id}`],
        embeddings: [embedding],
      };

      if (metadata) {
        updateData.metadatas = [metadata];
      }

      await this.collection!.update(updateData);

      logger.debug(`更新主题向量：topic_${id}`);
    } catch (error) {
      logger.error(`更新主题向量失败：topic_${id}`, error);
      throw error;
    }
  }

  /**
   * 删除主题向量
   * @param id 主题 ID
   */
  async deleteTopicVector(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.delete({
        ids: [`topic_${id}`],
      });

      logger.debug(`删除主题向量：topic_${id}`);
    } catch (error) {
      logger.error(`删除主题向量失败：topic_${id}`, error);
      throw error;
    }
  }

  /**
   * 推荐相似主题
   * @param queryEmbedding 查询向量
   * @param nResults 返回推荐数量（默认 5）
   * @param minSimilarity 最小相似度阈值（默认 0.6）
   * @returns 主题推荐结果
   */
  async recommendTopics(
    queryEmbedding: number[],
    nResults: number = 5,
    minSimilarity: number = 0.6
  ): Promise<TopicRecommendResult[]> {
    this.ensureInitialized();

    try {
      const results = await this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ['metadatas', 'distances'],
      });

      // 转换结果格式并过滤
      const recommendResults: TopicRecommendResult[] = [];
      
      if (results.ids && results.ids.length > 0 && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const distance = results.distances?.[0]?.[i] || 0;
          const metadata = results.metadatas?.[0]?.[i] as TopicVectorMetadata;
          
          // ChromaDB 返回的是距离，需要转换为相似度
          const similarity = 1 - distance;
          
          // 过滤低相似度
          if (similarity >= minSimilarity) {
            recommendResults.push({
              topicId: id.replace(/^topic_/, ''),
              similarity,
              metadata: metadata || {} as TopicVectorMetadata,
            });
          }
        }
      }

      logger.debug(`主题推荐：找到 ${recommendResults.length} 个结果（阈值：${minSimilarity}）`);
      
      return recommendResults;
    } catch (error) {
      logger.error('主题推荐失败:', error);
      throw error;
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
        logger.info('已清空所有主题推荐向量');
      }
    } catch (error) {
      logger.error('清空主题推荐向量失败:', error);
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

/**
 * 获取带环境前缀的 Collection 名称
 */
function getPrefixedCollectionName(baseName: string): string {
  const env = process.env.NODE_ENV || 'development';
  const prefix = env === 'production' ? 'prod:' : 'dev:';
  return `${prefix}${baseName}`;
}

// 导出单例
export const topicRecommendStorage = new TopicRecommendStorage();

// 导出便捷函数
export async function initTopicRecommendStorage(): Promise<void> {
  await topicRecommendStorage.initialize();
}

export async function addTopicVector(
  id: string,
  embedding: number[],
  metadata: TopicVectorMetadata
): Promise<void> {
  if (!topicRecommendStorage.isInitialized) {
    await topicRecommendStorage.initialize();
  }
  return topicRecommendStorage.addTopicVector(id, embedding, metadata);
}

export async function recommendSimilarTopics(
  queryEmbedding: number[],
  nResults?: number,
  minSimilarity?: number
): Promise<TopicRecommendResult[]> {
  if (!topicRecommendStorage.isInitialized) {
    await topicRecommendStorage.initialize();
  }
  return topicRecommendStorage.recommendTopics(queryEmbedding, nResults, minSimilarity);
}
