/**
 * 专业 Embedding 向量化工具
 * 
 * 功能：
 * 1. 返回零向量（不再调用 AI 模型 API）
 * 2. 支持批量生成零向量
 * 3. 兼容 ChromaDB 向量存储功能
 * 
 * 注意：当前所有 AI 模型都不支持向量化，使用零向量降级方案
 */

import { getLogger } from './logger';

const logger = getLogger('embedding-vectorizer');

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
  /** 向量维度（默认 1536） */
  dimension?: number;
}

/**
 * Embedding 向量化器类
 */
export class EmbeddingVectorizer {
  private dimension: number;
  private initialized = false;

  /**
   * 构造函数
   */
  constructor(config?: Partial<EmbeddingConfig>) {
    this.dimension = config?.dimension || 1536;
    this.initialized = true;
    logger.info(`EmbeddingVectorizer 初始化完成（零向量模式）：${this.dimension}维`);
  }

  /**
   * 生成单个文本的向量（返回零向量）
   * @param text 输入文本
   * @returns 零向量数组
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      logger.debug('输入文本为空，返回零向量');
    }
    // 返回零向量
    return new Array(this.dimension).fill(0);
  }

  /**
   * 批量生成向量（返回零向量数组）
   * @param texts 文本数组
   * @param batchSize 每批数量
   * @returns 零向量数组
   */
  async batchGenerateEmbeddings(texts: string[], batchSize: number = 10): Promise<number[][]> {
    logger.debug(`批量生成零向量：${texts.length}条文本`);
    return texts.map(() => new Array(this.dimension).fill(0));
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): { model: string; dimension: number } {
    return {
      model: 'zero-vector',
      dimension: this.dimension,
    };
  }

  /**
   * 估算向量生成成本（零向量免费）
   */
  estimateCost(texts: string[]): { tokens: number; costUSD: number } {
    return {
      tokens: 0,
      costUSD: 0,
    };
  }
}

/**
 * 缓存装饰器
 */
class CachedEmbeddingVectorizer extends EmbeddingVectorizer {
  private cache: Map<string, number[]> = new Map();
  private cacheTTL: Map<string, number> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 3600000, config?: Partial<EmbeddingConfig>) {
    super(config);
    this.ttlMs = ttlMs;
    
    // 定期清理过期缓存
    setInterval(() => this.cleanupCache(), 60000);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.hashText(text);
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const expiry = this.cacheTTL.get(cacheKey);
      if (expiry && Date.now() < expiry) {
        return this.cache.get(cacheKey)!;
      }
    }
    
    // 生成并缓存
    const embedding = await super.generateEmbedding(text);
    this.cache.set(cacheKey, embedding);
    this.cacheTTL.set(cacheKey, Date.now() + this.ttlMs);
    
    return embedding;
  }

  private hashText(text: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text).digest('hex');
  }

  private cleanupCache(): void {
    const now = Date.now();
    let deleted = 0;
    
    for (const [key, expiry] of this.cacheTTL.entries()) {
      if (now >= expiry) {
        this.cacheTTL.delete(key);
        this.cache.delete(key);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      logger.debug(`清理缓存：${deleted}条`);
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

// 导出单例（带缓存）
let _embeddingVectorizerInstance: CachedEmbeddingVectorizer | null = null;

export function getEmbeddingVectorizer(): CachedEmbeddingVectorizer {
  if (!_embeddingVectorizerInstance) {
    _embeddingVectorizerInstance = new CachedEmbeddingVectorizer();
  }
  return _embeddingVectorizerInstance;
}

// 便捷函数
export async function generateEmbedding(text: string): Promise<number[]> {
  return getEmbeddingVectorizer().generateEmbedding(text);
}

export async function batchGenerateEmbeddings(texts: string[], batchSize?: number): Promise<number[][]> {
  return getEmbeddingVectorizer().batchGenerateEmbeddings(texts, batchSize);
}

// 兼容旧代码（废弃）
export const embeddingVectorizer = getEmbeddingVectorizer();
