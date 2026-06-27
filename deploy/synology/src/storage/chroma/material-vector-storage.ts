/**
 * 素材向量存储 - ChromaDB
 * 
 * 功能：
 * 1. 存储素材的向量表示
 * 2. 支持相似度搜索
 * 3. 支持向量更新和删除
 * 4. 支持批量操作
 * 
 * 使用场景：
 * - 根据图片内容搜索相似素材
 * - 基于文本描述推荐素材
 * - 素材去重
 */

import { Collection } from 'chromadb';
import { getChromaCollection } from '../../utils/chroma-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('material-vector-storage');

/**
 * 素材向量元数据
 */
export interface MaterialVectorMetadata {
  /** 素材文件路径 */
  file_path: string;
  /** 素材文件名称 */
  file_name?: string;
  /** 素材类型 */
  file_type?: 'image' | 'text' | 'video';
  /** 素材描述 */
  description?: string;
  /** 素材标签 */
  tags?: string[];
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
  metadata: MaterialVectorMetadata;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  /** 返回结果数量 */
  nResults?: number;
  /** 过滤条件 */
  where?: Record<string, any>;
  /** 包含元数据 */
  includeMetadata?: boolean;
}

/**
 * 获取带环境前缀的 Collection 名称
 */
function getPrefixedCollectionName(baseName: string): string {
  const env = process.env.NODE_ENV || 'development';
  const prefix = env === 'production' ? 'prod:' : 'dev:';
  return `${prefix}${baseName}`;
}

/**
 * 素材向量存储类
 */
class MaterialVectorStorage {
  private collectionName = getPrefixedCollectionName('materials');
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
      logger.debug('MaterialVectorStorage 初始化成功');
    } catch (error) {
      logger.error('MaterialVectorStorage 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.collection) {
      throw new Error('MaterialVectorStorage 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 添加素材向量
   * @param id 向量 ID（通常是 material_{id}）
   * @param embedding 向量数组
   * @param metadata 元数据
   */
  async addVector(
    id: string,
    embedding: number[],
    metadata: MaterialVectorMetadata
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.add({
        ids: [id],
        embeddings: [embedding],
        metadatas: [metadata],
      });

      logger.debug(`添加素材向量：${id}`);
    } catch (error) {
      logger.error(`添加素材向量失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 批量添加素材向量
   * @param ids 向量 ID 数组
   * @param embeddings 向量数组
   * @param metadatas 元数据数组
   */
  async addVectors(
    ids: string[],
    embeddings: number[][],
    metadatas: MaterialVectorMetadata[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        await this.collection!.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        logger.debug(`批量添加��材向量：${i + batchIds.length}/${ids.length}`);
      }

      logger.info(`批量添加 ${ids.length} 个素材向量成功`);
    } catch (error) {
      logger.error('批量添加素材向量失败:', error);
      throw error;
    }
  }

  /**
   * 更新素材向量
   * @param id 向量 ID
   * @param embedding 新的向量
   * @param metadata 新的元数据（可选）
   */
  async updateVector(
    id: string,
    embedding: number[],
    metadata?: Partial<MaterialVectorMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const updateData: any = {
        ids: [id],
        embeddings: [embedding],
      };

      if (metadata) {
        updateData.metadatas = [metadata];
      }

      await this.collection!.update(updateData);

      logger.debug(`更新素材向量：${id}`);
    } catch (error) {
      logger.error(`更新素材向量失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 删除素材向量
   * @param id 向量 ID
   */
  async deleteVector(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.delete({
        ids: [id],
      });

      logger.debug(`删除素材向量：${id}`);
    } catch (error) {
      logger.error(`删除素材向量失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 批量删除素材向量
   * @param ids 向量 ID 数组
   */
  async deleteVectors(ids: string[]): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.delete({
        ids,
      });

      logger.info(`批量删除 ${ids.length} 个素材向量成功`);
    } catch (error) {
      logger.error('批量删除素材向量失败:', error);
      throw error;
    }
  }

  /**
   * 相似度搜索
   * @param queryEmbedding 查询向量
   * @param options 查询选项
   * @returns 相似度搜索结果
   */
  async searchSimilar(
    queryEmbedding: number[],
    options?: QueryOptions
  ): Promise<SimilaritySearchResult[]> {
    this.ensureInitialized();

    const nResults = options?.nResults || 10;

    try {
      const results = await this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        where: options?.where,
        include: ['metadatas', 'distances'],
      });

      // 转换结果格式
      const searchResults: SimilaritySearchResult[] = [];
      
      if (results.ids && results.ids.length > 0 && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const distance = results.distances?.[0]?.[i] || 0;
          const metadata = results.metadatas?.[0]?.[i] as MaterialVectorMetadata;
          
          // ChromaDB 返回的是距离，需要转换为相似度（cosine 距离 = 1 - 相似度）
          const similarity = 1 - distance;

          searchResults.push({
            id,
            similarity,
            metadata: metadata || {} as MaterialVectorMetadata,
          });
        }
      }

      logger.debug(`相似度搜索：找到 ${searchResults.length} 个结果`);
      
      return searchResults;
    } catch (error) {
      logger.error('相似度搜索失败:', error);
      throw error;
    }
  }

  /**
   * 根据文件路径搜索
   * @param filePath 文件路径
   * @returns 向量 ID（如果存在）
   */
  async findByFilePath(filePath: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      const results = await this.collection!.get({
        where: {
          file_path: filePath,
        },
        limit: 1,
      });

      if (results.ids && results.ids.length > 0) {
        return results.ids[0];
      }

      return null;
    } catch (error) {
      logger.error(`根据文件��径搜索失败：${filePath}`, error);
      return null;
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
      // ChromaDB 不支持直接清空，需要删除所有 ID
      const collection = await this.collection!.get();
      if (collection.ids && collection.ids.length > 0) {
        await this.collection!.delete({
          ids: collection.ids,
        });
        logger.info('已清空所有素材向量');
      }
    } catch (error) {
      logger.error('清空素材向量失败:', error);
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
export const materialVectorStorage = new MaterialVectorStorage();

// 导出便捷函数
export async function initMaterialVectorStorage(): Promise<void> {
  await materialVectorStorage.initialize();
}

export async function addMaterialVector(
  id: string,
  embedding: number[],
  metadata: MaterialVectorMetadata
): Promise<void> {
  if (!materialVectorStorage.isInitialized) {
    await materialVectorStorage.initialize();
  }
  return materialVectorStorage.addVector(id, embedding, metadata);
}

export async function searchMaterialBySimilarity(
  queryEmbedding: number[],
  options?: QueryOptions
): Promise<SimilaritySearchResult[]> {
  if (!materialVectorStorage.isInitialized) {
    await materialVectorStorage.initialize();
  }
  return materialVectorStorage.searchSimilar(queryEmbedding, options);
}
