/**
 * 专业 Embedding 向量化工具
 *
 * 功能：
 * 1. 调用本地 embedding 服务（OpenAI 兼容 /v1/embeddings，bge-m3，1024 维）生成真实语义向量
 * 2. 支持批量向量化
 * 3. 兼容 ChromaDB 向量存储
 *
 * 降级策略：服务不可用时抛出错误，由上层（如内容去重）走文本相似度兜底，
 * 禁止返回零向量——零向量会导致所有内容相似度恒为 1.000 的误判。
 */

import { getLogger } from './logger';
import { loadConfig } from './config';

const logger = getLogger('embedding-vectorizer');

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
  /** 向量维度（默认 1024，对应 bge-m3） */
  dimension?: number;
  /** embedding 服务地址（OpenAI 兼容 /v1/embeddings） */
  url?: string;
  /** 模型名 */
  model?: string;
  /** 单次请求超时（毫秒） */
  timeout?: number;
}

/**
 * 解析 embedding 服务配置：环境变量优先，其次 config，最后默认值
 */
function resolveEmbeddingConfig(config?: Partial<EmbeddingConfig>): Required<EmbeddingConfig> {
  let fileCfg: any = {};
  try {
    fileCfg = loadConfig().embedding || {};
  } catch {
    // 忽略配置加载失败，使用默认值
  }
  return {
    url: process.env.EMBEDDING_URL || config?.url || fileCfg.url || 'http://192.168.50.10:8100/v1/embeddings',
    model: process.env.EMBEDDING_MODEL || config?.model || fileCfg.model || 'bge-m3',
    dimension: config?.dimension || fileCfg.dimension || 1024,
    timeout: config?.timeout || fileCfg.timeout || 30000,
  };
}

/**
 * Embedding 向量化器类
 */
export class EmbeddingVectorizer {
  private dimension: number;
  private url: string;
  private model: string;
  private timeout: number;
  private initialized = false;

  /**
   * 构造函数
   */
  constructor(config?: Partial<EmbeddingConfig>) {
    const resolved = resolveEmbeddingConfig(config);
    this.dimension = resolved.dimension;
    this.url = resolved.url;
    this.model = resolved.model;
    this.timeout = resolved.timeout;
    this.initialized = true;
    logger.info(`EmbeddingVectorizer 初始化完成：model=${this.model}, ${this.dimension}维, url=${this.url}`);
  }

  /**
   * 调用 embedding 服务（OpenAI 兼容），返回向量数组
   * @param input 单条文本或文本数组
   */
  private async callService(input: string | string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`embedding 服务返回 ${resp.status}: ${body.slice(0, 200)}`);
      }
      const json: any = await resp.json();
      const data = json?.data;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('embedding 服务返回结果为空');
      }
      // 按 index 排序，确保与输入顺序一致
      const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return sorted.map((d: any) => d.embedding as number[]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 带一次重试的服务调用
   */
  private async callServiceWithRetry(input: string | string[]): Promise<number[][]> {
    try {
      return await this.callService(input);
    } catch (error) {
      logger.warn(`embedding 服务调用失败，重试一次：${error instanceof Error ? error.message : String(error)}`);
      return await this.callService(input);
    }
  }

  /**
   * 生成单个文本的真实语义向量
   * @param text 输入文本
   * @returns 向量数组
   * @throws 服务不可用时抛出错误，交由上层降级处理（禁止返回零向量）
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // 空文本：确定性返回零向量，避免向服务发无意义请求，也不抛异常
    if (!text || text.trim().length === 0) {
      logger.debug('输入文本为空，返回零向量占位');
      return new Array(this.dimension).fill(0);
    }
    const vectors = await this.callServiceWithRetry(text);
    return vectors[0];
  }

  /**
   * 批量生成真实语义向量
   * @param texts 文本数组
   * @param batchSize 每批数量
   * @returns 向量数组
   * @throws 服务不可用时抛出错误，交由上层降级处理
   */
  async batchGenerateEmbeddings(texts: string[], batchSize: number = 10): Promise<number[][]> {
    if (texts.length === 0) return [];
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      // 空文本占位，非空文本走服务；保持顺序对齐
      const nonEmptyIdx: number[] = [];
      const nonEmpty: string[] = [];
      batch.forEach((t, idx) => {
        if (t && t.trim().length > 0) {
          nonEmptyIdx.push(idx);
          nonEmpty.push(t);
        }
      });
      const batchResult: number[][] = batch.map(() => new Array(this.dimension).fill(0));
      if (nonEmpty.length > 0) {
        const vectors = await this.callServiceWithRetry(nonEmpty);
        nonEmptyIdx.forEach((origIdx, k) => {
          batchResult[origIdx] = vectors[k];
        });
      }
      results.push(...batchResult);
      logger.debug(`批量向量化：${Math.min(i + batchSize, texts.length)}/${texts.length}`);
    }
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
