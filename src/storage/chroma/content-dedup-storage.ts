/**
 * 内容去重向量存储 - ChromaDB
 * 
 * 功能：
 * 1. 存储发帖内容的向量表示
 * 2. 支持相似度搜索（内容去重）
 * 3. 支持向量更新和删除
 * 4. 支持批量操作
 * 
 * 使用场景：
 * - 检测新发帖是否与历史内容重复
 * - 语义层面的内容去重
 * - 相似内容推荐
 */

import { Collection } from 'chromadb';
import { getChromaCollection } from '../../utils/chroma-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('content-dedup-storage');

/**
 * 内容向量元数据
 */
export interface ContentVectorMetadata {
  /** 帖子标题 */
  title: string;
  /** 帖子主题 */
  topic?: string;
  /** 创建时间戳 */
  created_at?: number;
  [key: string]: any;
}

/**
 * 相似度搜索结果
 */
export interface SimilaritySearchResult {
  /** 向量 ID */
  id: string;
  /** 相似度分数 */
  similarity: number;
  /** 元数据 */
  metadata: ContentVectorMetadata;
}

/**
 * 内容去重存储类
 */
class ContentDedupStorage {
  private collectionName = 'prod_content_dedup'; // 使用下划线前缀，与 chroma-connection-manager 一致
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
      logger.debug('ContentDedupStorage 初始化成功');
    } catch (error) {
      logger.error('ContentDedupStorage 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.collection) {
      throw new Error('ContentDedupStorage 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 添加帖子向量
   * @param id 帖子 ID
   * @param embedding 向量数组
   * @param metadata 元数据
   */
  async addPostVector(
    id: string,
    embedding: number[],
    metadata: ContentVectorMetadata
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.add({
        ids: [`post_${id}`],
        embeddings: [embedding],
        metadatas: [metadata],
      });

      logger.debug(`添加帖子向量：post_${id}`);
    } catch (error) {
      logger.error(`添加帖子向量失败：post_${id}`, error);
      throw error;
    }
  }

  /**
   * 批量添加帖子向量
   * @param ids 帖子 ID 数组
   * @param embeddings 向量数组
   * @param metadatas 元数据数组
   */
  async addPostVectors(
    ids: string[],
    embeddings: number[][],
    metadatas: ContentVectorMetadata[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        // 添加 post_ 前缀
        const prefixedIds = batchIds.map(id => `post_${id}`);

        await this.collection!.add({
          ids: prefixedIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        logger.debug(`批量添加帖子向量：${i + batchIds.length}/${ids.length}`);
      }

      logger.info(`批量添加 ${ids.length} 个帖子向量成功`);
    } catch (error) {
      logger.error('批量添加帖子向量失败:', error);
      throw error;
    }
  }

  /**
   * 更新帖子向量
   * @param id 帖子 ID
   * @param embedding 新的向量
   * @param metadata 新的元数据（可选）
   */
  async updatePostVector(
    id: string,
    embedding: number[],
    metadata?: Partial<ContentVectorMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const updateData: any = {
        ids: [`post_${id}`],
        embeddings: [embedding],
      };

      if (metadata) {
        updateData.metadatas = [metadata];
      }

      await this.collection!.update(updateData);

      logger.debug(`更新帖子向量：post_${id}`);
    } catch (error) {
      logger.error(`更新帖子向量失败：post_${id}`, error);
      throw error;
    }
  }

  /**
   * 删除帖子向量
   * @param id 帖子 ID
   */
  async deletePostVector(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.delete({
        ids: [`post_${id}`],
      });

      logger.debug(`删除帖子向量：post_${id}`);
    } catch (error) {
      logger.error(`删除帖子向量失败：post_${id}`, error);
      throw error;
    }
  }

  /**
   * 相似度搜索
   * @param queryEmbedding 查询向量
   * @param nResults 返回结果数量（默认 5）
   * @returns 相似度搜索结果
   */
  async searchSimilar(
    queryEmbedding: number[],
    nResults: number = 5
  ): Promise<SimilaritySearchResult[]> {
    this.ensureInitialized();

    try {
      const results = await this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ['metadatas', 'distances'],
      });

      // 转换结果格式
      const searchResults: SimilaritySearchResult[] = [];
      
      if (results.ids && results.ids.length > 0 && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const distance = results.distances?.[0]?.[i] || 0;
          const metadata = results.metadatas?.[0]?.[i] as ContentVectorMetadata;
          
          // ChromaDB 返回的是距离，需要转换为相似度（cosine 距离 = 1 - 相似度）
          const similarity = 1 - distance;

          searchResults.push({
            id: id.replace(/^post_/, ''),
            similarity,
            metadata: metadata || {} as ContentVectorMetadata,
          });
        }
      }

      logger.debug(`内容去重搜索：找到 ${searchResults.length} 个结果`);
      
      return searchResults;
    } catch (error) {
      logger.error('内容去重搜索失败:', error);
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
        logger.info('已清空所有内容去重向量');
      }
    } catch (error) {
      logger.error('清空内容去重向量失败:', error);
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
export const contentDedupStorage = new ContentDedupStorage();

// 导出便捷函数
export async function initContentDedupStorage(): Promise<void> {
  await contentDedupStorage.initialize();
}

export async function addPostVector(
  id: string,
  embedding: number[],
  metadata: ContentVectorMetadata
): Promise<void> {
  if (!contentDedupStorage.isInitialized) {
    await contentDedupStorage.initialize();
  }
  return contentDedupStorage.addPostVector(id, embedding, metadata);
}

export async function searchSimilarContent(
  queryEmbedding: number[],
  nResults?: number
): Promise<SimilaritySearchResult[]> {
  if (!contentDedupStorage.isInitialized) {
    await contentDedupStorage.initialize();
  }
  return contentDedupStorage.searchSimilar(queryEmbedding, nResults);
}
