/**
 * 专业 Embedding 向量化工具
 * 
 * 功能：
 * 1. 使用 OpenAI Embedding API 生成高质量向量
 * 2. 支持批量生成向量
 * 3. 支持多种 Embedding 模型
 * 4. 错误处理和降级方案
 * 
 * 依赖：
 * npm install openai
 */

import { OpenAI } from 'openai';
import { getLogger } from './logger';

const logger = getLogger('embedding-vectorizer');

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
  /** API Key */
  apiKey: string;
  /** API Base URL */
  baseURL?: string;
  /** 模型名称 */
  model?: string;
  /** 向量维度 */
  dimension?: number;
}

/**
 * Embedding 向量化器类
 */
export class EmbeddingVectorizer {
  private openai: OpenAI | null = null;
  private model: string;
  private dimension: number;
  private config?: Partial<EmbeddingConfig>;

  /**
   * 构造函数
   */
  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = config;
    this.model = config?.model || 'text-embedding-3-small';
    this.dimension = config?.dimension || 1536;

    const apiKey = config?.apiKey || process.env.AI_PROVIDER_1_API_KEY || '';
    if (apiKey) {
      const baseURL = config?.baseURL || process.env.AI_PROVIDER_1_BASE_URL || 'https://api.openai.com/v1';
      this.openai = new OpenAI({ apiKey, baseURL });
      logger.info(`EmbeddingVectorizer 初始化完成：${this.model} (${this.dimension}维)`);
    } else {
      logger.warn('EmbeddingVectorizer 未配置 API Key，将在首次调用时尝试延迟初始化');
    }
  }

  /**
   * 检查并延迟初始化
   */
  private ensureInitialized(): void {
    if (this.openai) return;

    const apiKey = this.config?.apiKey || process.env.AI_PROVIDER_1_API_KEY || '';
    if (!apiKey) {
      throw new Error('EmbeddingVectorizer 未配置 API Key，无法初始化');
    }
    const baseURL = this.config?.baseURL || process.env.AI_PROVIDER_1_BASE_URL || 'https://api.openai.com/v1';
    this.openai = new OpenAI({ apiKey, baseURL });
    logger.info(`EmbeddingVectorizer 延迟初始化完成：${this.model} (${this.dimension}维)`);
  }

  /**
   * 生成单个文本的向量
   * @param text 输入文本
   * @returns 向量数组
   */
  async generateEmbedding(text: string): Promise<number[]> {
    this.ensureInitialized();

    try {
      if (!text || text.trim().length === 0) {
        logger.warn('输入文本为空，返回零向量');
        return new Array(this.dimension).fill(0);
      }

      const response = await (this.openai as OpenAI).embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding = response.data?.[0]?.embedding;
      
      if (!embedding) {
        logger.warn('API 返回的向量为空，返回零向量');
        return new Array(this.dimension).fill(0);
      }
      
      logger.debug(`生成向量：${embedding.length}维，文本长度：${text.length}`);
      
      return embedding;
    } catch (error) {
      logger.error('生成向量失败:', error);
      
      // 降级方案：返回零向量
      if (error instanceof Error) {
        logger.warn(`使用降级方案：返回零向量（错误：${error.message}）`);
      }
      
      return new Array(this.dimension).fill(0);
    }
  }

  /**
   * 批量生成向量
   * @param texts 文本数组
   * @param batchSize 每批数量（默认 10）
   * @returns 向量数组
   */
  async batchGenerateEmbeddings(texts: string[], batchSize: number = 10): Promise<number[][]> {
    this.ensureInitialized();

    const results: number[][] = [];
    const total = texts.length;

    logger.info(`批量生成向量：${total}条文本，批次大小：${batchSize}`);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const response = await (this.openai as OpenAI).embeddings.create({
          model: this.model,
          input: batch,
        });

        const batchEmbeddings = response.data?.map(d => d.embedding) || [];
        results.push(...batchEmbeddings);

        logger.debug(`批量生成：${Math.min(i + batchSize, total)}/${total}`);
      } catch (error) {
        logger.error(`批量生成失败（批次 ${i}-${i + batchSize}）:`, error);
        
        // 降级方案：为零向量
        const fallbackEmbeddings = batch.map(() => new Array(this.dimension).fill(0));
        results.push(...fallbackEmbeddings);
      }
    }

    logger.info(`批量生成完成：${results.length}/${total}`);
    
    return results;
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): { model: string; dimension: number } {
    return {
      model: this.model,
      dimension: this.dimension,
    };
  }

  /**
   * 估算向量生成成本（每 1000 tokens 的价格）
   * 参考价格：text-embedding-3-small: $0.02 / 1M tokens
   */
  estimateCost(texts: string[]): { tokens: number; costUSD: number } {
    // 估算 tokens 数（中文约 1.5 字/token，英文约 4 字符/token）
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    const estimatedTokens = totalChars / 4; // 保守估计
    
    // 价格（USD）
    const pricePerMillionTokens = 0.02;
    const costUSD = (estimatedTokens / 1000000) * pricePerMillionTokens;
    
    return {
      tokens: Math.round(estimatedTokens),
      costUSD: Number(costUSD.toFixed(6)),
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
export const embeddingVectorizer = new CachedEmbeddingVectorizer();

// 导出便捷函数
export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddingVectorizer.generateEmbedding(text);
}

export async function batchGenerateEmbeddings(texts: string[], batchSize?: number): Promise<number[][]> {
  return embeddingVectorizer.batchGenerateEmbeddings(texts, batchSize);
}
