/**
 * 敏感词变体识别 - ChromaDB
 * 
 * 功能：
 * 1. 存储敏感词的向量表示
 * 2. 识别同义词、变体词
 * 3. 语义层面的敏感内容检测
 * 4. 对抗规避行为
 * 
 * 使用场景：
 * - 敏感词变体识别
 * - 同义词检测
 * - 对抗规避行为识别
 */

import { Collection } from 'chromadb';
import { getChromaCollection } from '../../utils/chroma-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('sensitive-variant-storage');

/**
 * 敏感词向量元数据
 */
export interface SensitiveWordVectorMetadata {
  /** 敏感词原文 */
  word_text: string;
  /** 敏感词分类 */
  category?: string;
  /** 严重程度 (1-5) */
  severity?: number;
  /** 替换词 */
  replacement?: string;
  /** 创建时间戳 */
  created_at?: number;
  [key: string]: any;
}

/**
 * 变体识别结果
 */
export interface VariantDetectionResult {
  /** 是否检测到变体 */
  isVariant: boolean;
  /** 最高相似度 */
  maxSimilarity: number;
  /** 匹配的敏感词 */
  matchedWord?: string;
  /** 匹配的敏感词 ID */
  matchedWordId?: string;
  /** 分类 */
  category?: string;
  /** 严重程度 */
  severity?: number;
}

/**
 * 敏感词变体存储类
 */
class SensitiveVariantStorage {
  private collectionName = 'prod_sensitive_variants'; // 使用下划线前缀，与 chroma-connection-manager 一致
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
      logger.debug('SensitiveVariantStorage 初始化成功');
    } catch (error) {
      logger.error('SensitiveVariantStorage 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.collection) {
      throw new Error('SensitiveVariantStorage 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 添加敏感词向量
   * @param id 敏感词 ID
   * @param embedding 向量数组
   * @param metadata 元数据
   */
  async addSensitiveWordVector(
    id: string,
    embedding: number[],
    metadata: SensitiveWordVectorMetadata
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.add({
        ids: [`sensitive_${id}`],
        embeddings: [embedding],
        metadatas: [metadata],
      });

      logger.debug(`添加敏感词向量：sensitive_${id}`);
    } catch (error) {
      logger.error(`添加敏感词向量失败：sensitive_${id}`, error);
      throw error;
    }
  }

  /**
   * 批量添加敏感词向量
   * @param ids 敏感词 ID 数组
   * @param embeddings 向量数组
   * @param metadatas 元数据数组
   */
  async addSensitiveWordVectors(
    ids: string[],
    embeddings: number[][],
    metadatas: SensitiveWordVectorMetadata[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        // 添加 sensitive_ 前缀
        const prefixedIds = batchIds.map(id => `sensitive_${id}`);

        await this.collection!.add({
          ids: prefixedIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        logger.debug(`批量添加敏感词向量：${i + batchIds.length}/${ids.length}`);
      }

      logger.info(`批量添加 ${ids.length} 个敏感词向量成功`);
    } catch (error) {
      logger.error('批量添加敏感词向量失败:', error);
      throw error;
    }
  }

  /**
   * 更新敏感词向量
   * @param id 敏感词 ID
   * @param embedding 新的向量
   * @param metadata 新的元数据（可选）
   */
  async updateSensitiveWordVector(
    id: string,
    embedding: number[],
    metadata?: Partial<SensitiveWordVectorMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const updateData: any = {
        ids: [`sensitive_${id}`],
        embeddings: [embedding],
      };

      if (metadata) {
        updateData.metadatas = [metadata];
      }

      await this.collection!.update(updateData);

      logger.debug(`更新敏感词向量：sensitive_${id}`);
    } catch (error) {
      logger.error(`更新敏感词向量失败：sensitive_${id}`, error);
      throw error;
    }
  }

  /**
   * 删除敏感词向量
   * @param id 敏感词 ID
   */
  async deleteSensitiveWordVector(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.collection!.delete({
        ids: [`sensitive_${id}`],
      });

      logger.debug(`删除敏感词向量：sensitive_${id}`);
    } catch (error) {
      logger.error(`删除敏感词向量失败：sensitive_${id}`, error);
      throw error;
    }
  }

  /**
   * 检测变体
   * @param text 待检测文本
   * @param queryEmbedding 查询向量
   * @param nResults 返回匹配数量（默认 3）
   * @param minSimilarity 最小相似度阈值（默认 0.85）
   * @returns 变体识别结果
   */
  async detectVariant(
    text: string,
    queryEmbedding: number[],
    nResults: number = 3,
    minSimilarity: number = 0.85
  ): Promise<VariantDetectionResult> {
    this.ensureInitialized();

    try {
      const results = await this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ['metadatas', 'distances'],
      });

      // 转换结果格式并过滤
      if (results.ids && results.ids.length > 0 && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const distance = results.distances?.[0]?.[i] || 0;
          const metadata = results.metadatas?.[0]?.[i] as SensitiveWordVectorMetadata;
          
          // ChromaDB 返回的是距离，需要转换为相似度
          const similarity = 1 - distance;
          
          // 过滤低相似度
          if (similarity >= minSimilarity) {
            logger.debug(
              `检测到敏感词变体："${text}" -> "${metadata?.word_text}" ` +
              `(相似度：${similarity.toFixed(3)}, 分类：${metadata?.category})`
            );
            
            return {
              isVariant: true,
              maxSimilarity: similarity,
              matchedWord: metadata?.word_text,
              matchedWordId: id.replace(/^sensitive_/, ''),
              category: metadata?.category,
              severity: metadata?.severity,
            };
          }
        }
      }

      return {
        isVariant: false,
        maxSimilarity: 0,
      };
    } catch (error) {
      logger.error('检测敏感词变体失败:', error);
      return {
        isVariant: false,
        maxSimilarity: 0,
      };
    }
  }

  /**
   * 批量检测文本中的敏感变体
   * @param texts 文本数组
   * @param embeddings 向量数组
   * @param minSimilarity 最小相似度阈值（默认 0.85）
   * @returns 变体识别结果数组
   */
  async batchDetectVariants(
    texts: string[],
    embeddings: number[][],
    minSimilarity: number = 0.85
  ): Promise<Array<{
    text: string;
    result: VariantDetectionResult;
  }>> {
    this.ensureInitialized();

    const results: Array<{ text: string; result: VariantDetectionResult }> = [];

    try {
      for (let i = 0; i < texts.length; i++) {
        const result = await this.detectVariant(texts[i], embeddings[i], 3, minSimilarity);
        results.push({
          text: texts[i],
          result,
        });
      }

      logger.info(`批量检测 ${texts.length} 个文本，发现 ${results.filter(r => r.result.isVariant).length} 个变体`);
    } catch (error) {
      logger.error('批量检测敏感词变体失败:', error);
    }

    return results;
  }

  /**
   * 获取向量数量
   */
  async count(): Promise<number> {
    this.ensureInitialized();

    try {
      // 使用 ChromaDB 的 count() API，避免 SQLite 变量超限问题
      const count = await this.collection!.count();
      return count;
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
      // 分批删除，避免 SQLite 变量超限
      const batchSize = 100;
      let deletedCount = 0;
      
      while (true) {
        // 每次获取一批 ID
        const batch = await this.collection!.get({
          limit: batchSize,
          include: [], // 只获取 IDs
        });
        
        if (!batch.ids || batch.ids.length === 0) {
          break; // 没有更多数据
        }
        
        // 删除这一批
        await this.collection!.delete({
          ids: batch.ids,
        });
        
        deletedCount += batch.ids.length;
        logger.debug(`已删除 ${deletedCount} 个向量`);
        
        // 如果获取的数量小于批次大小，说明已经删除完毕
        if (batch.ids.length < batchSize) {
          break;
        }
      }
      
      logger.info(`已清空所有敏感词变体向量，共删除 ${deletedCount} 个`);
    } catch (error) {
      logger.error('清空敏感词变体向量失败:', error);
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
export const sensitiveVariantStorage = new SensitiveVariantStorage();

// 导出便捷函数
export async function initSensitiveVariantStorage(): Promise<void> {
  await sensitiveVariantStorage.initialize();
}

export async function addSensitiveWordVector(
  id: string,
  embedding: number[],
  metadata: SensitiveWordVectorMetadata
): Promise<void> {
  if (!sensitiveVariantStorage.isInitialized) {
    await sensitiveVariantStorage.initialize();
  }
  return sensitiveVariantStorage.addSensitiveWordVector(id, embedding, metadata);
}

export async function detectSensitiveVariant(
  text: string,
  queryEmbedding: number[],
  nResults?: number,
  minSimilarity?: number
): Promise<VariantDetectionResult> {
  if (!sensitiveVariantStorage.isInitialized) {
    await sensitiveVariantStorage.initialize();
  }
  return sensitiveVariantStorage.detectVariant(text, queryEmbedding, nResults, minSimilarity);
}
