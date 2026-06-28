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
  private mysql: any = null;

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
   * 初始化 MySQL 客户端（延迟加载）
   */
  private async getMySQL(): Promise<any> {
    if (!this.mysql) {
      logger.info('开始加载 mysql2/promise...');
      try {
        this.mysql = await import('mysql2/promise');
        logger.info('✓ mysql2/promise 加载成功');
      } catch (e) {
        logger.error('✗ mysql2/promise 加载失败:', e instanceof Error ? e.message : String(e));
        logger.error('  Stack:', e instanceof Error ? e.stack : 'N/A');
        throw e;
      }
    }
    return this.mysql;
  }

  /**
   * 从数据库加载配置
   */
  private async loadConfigFromDatabase(): Promise<{ apiKey: string; baseURL: string } | null> {
    logger.info('开始从数据库加载 Embedding 配置...');
    
    // 从配置文件加载数据库配置
    const config = await import('../utils/config').then(m => m.loadConfig());
    const mysqlConfig = config.mysql.production;
    
    logger.info(`数据库配置：host=${mysqlConfig.host}, user=${mysqlConfig.user}, database=${mysqlConfig.database}`);
    
    let conn: any = null;
    try {
      const mysql = await this.getMySQL();
      logger.info('创建数据库连接...');
      conn = await mysql.createConnection({
        host: mysqlConfig.host,
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        database: mysqlConfig.database,
      });
      logger.info('✓ 数据库连接成功');
      
      // 优先从 embedding_config 表加载
      logger.info('查询 embedding_config 表...');
      const [configRows] = await conn.query('SELECT api_key, base_url, model, dimension FROM embedding_config WHERE enabled = 1 LIMIT 1');
      logger.info(`embedding_config 查询结果：${Array.isArray(configRows) ? configRows.length : 'N/A'} 条`);
      if (Array.isArray(configRows) && configRows.length > 0) {
        const config = configRows[0];
        logger.info('✓ 从 embedding_config 表加载配置成功');
        logger.info(`  API Key: ${config.api_key ? config.api_key.substring(0, 10) + '...' : 'null'}`);
        logger.info(`  Base URL: ${config.base_url}`);
        if (config.model) this.model = config.model;
        if (config.dimension) this.dimension = config.dimension;
        await conn.end();
        return {
          apiKey: config.api_key,
          baseURL: config.base_url || 'https://api.openai.com/v1',
        };
      }
      
      // 降级：从 ai_providers 加载
      logger.info('embedding_config 无配置，尝试从 ai_providers 加载...');
      const [providers] = await conn.query('SELECT api_key, base_url FROM ai_providers WHERE is_enabled = 1 OR name = "deepseek" LIMIT 1');
      logger.info(`ai_providers 查询结果：${Array.isArray(providers) ? providers.length : 'N/A'} 条`);
      if (Array.isArray(providers) && providers.length > 0) {
        logger.info('✓ 从 ai_providers 表加载配置成功');
        logger.info(`  API Key: ${providers[0].api_key ? providers[0].api_key.substring(0, 10) + '...' : 'null'}`);
        await conn.end();
        return {
          apiKey: providers[0].api_key,
          baseURL: providers[0].base_url || 'https://api.openai.com/v1',
        };
      }
      
      logger.warn('数据库中无 AI Provider 配置');
      await conn.end();
    } catch (e) {
      logger.error('✗ 从数据库加载配置失败:');
      logger.error(`  错误类型：${e instanceof Error ? e.constructor.name : typeof e}`);
      logger.error(`  错误消息：${e instanceof Error ? e.message : String(e)}`);
      logger.error(`  堆栈：${e instanceof Error ? e.stack : 'N/A'}`);
      if (conn) {
        try {
          await conn.end();
        } catch (closeError) {
          logger.error('关闭数据库连接失败:', closeError instanceof Error ? closeError.message : String(closeError));
        }
      }
    }
    
    return null;
  }

  /**
   * 检查并延迟初始化
   */
  private async ensureInitializedAsync(): Promise<void> {
    if (this.openai) return;

    // 优先使用传入配置，其次环境变量，最后从数据库加载
    let apiKey = this.config?.apiKey || process.env.AI_PROVIDER_1_API_KEY || '';
    let baseURL = this.config?.baseURL || process.env.AI_PROVIDER_1_BASE_URL || 'https://api.openai.com/v1';
    
    // 如果还是没有 API Key，尝试从数据库加载
    if (!apiKey) {
      const dbConfig = await this.loadConfigFromDatabase();
      if (dbConfig) {
        apiKey = dbConfig.apiKey;
        baseURL = dbConfig.baseURL;
      }
    }
    
    if (!apiKey) {
      throw new Error('EmbeddingVectorizer 未配置 API Key，无法初始化');
    }
    
    // 确保 baseURL 不包含末尾的 /v1，因为 SDK 会自动添加
    const cleanBaseURL = baseURL.replace(/\/v1\/?$/, '');
    logger.info(`使用 API 配置：baseURL=${cleanBaseURL}, model=${this.model}`);
    this.openai = new OpenAI({ apiKey, baseURL: cleanBaseURL });
    logger.info(`EmbeddingVectorizer 延迟初始化完成：${this.model} (${this.dimension}维)`);
  }

  private ensureInitialized(): void {
    if (this.openai) return;
    
    // 同步检查
    const apiKey = this.config?.apiKey || process.env.AI_PROVIDER_1_API_KEY || '';
    if (apiKey) {
      const baseURL = this.config?.baseURL || process.env.AI_PROVIDER_1_BASE_URL || 'https://api.openai.com/v1';
      this.openai = new OpenAI({ apiKey, baseURL });
      logger.info(`EmbeddingVectorizer 初始化完成：${this.model} (${this.dimension}维)`);
      return;
    }
    
    // 异步加载
    this.ensureInitializedAsync().catch(err => {
      logger.error('EmbeddingVectorizer 初始化失败:', err instanceof Error ? err.message : String(err));
    });
  }

  /**
   * 生成单个文本的向量
   * @param text 输入文本
   * @returns 向量数组
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // 等待初始化完成
    await this.ensureInitializedAsync();

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
   * 检查 API 是否支持 embedding
   */
  private async testEmbeddingSupport(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      logger.warn('Embedding API 不支持或配置错误，将使用零向量降级方案');
      return false;
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

// 导出单例（带缓存）- 异步初始化
let _embeddingVectorizerInstance: CachedEmbeddingVectorizer | null = null;

export function getEmbeddingVectorizer(): CachedEmbeddingVectorizer {
  if (!_embeddingVectorizerInstance) {
    _embeddingVectorizerInstance = new CachedEmbeddingVectorizer();
  }
  return _embeddingVectorizerInstance;
}

// 便捷函数 - 使用 getEmbeddingVectorizer()
export async function generateEmbedding(text: string): Promise<number[]> {
  return getEmbeddingVectorizer().generateEmbedding(text);
}

export async function batchGenerateEmbeddings(texts: string[], batchSize?: number): Promise<number[][]> {
  return getEmbeddingVectorizer().batchGenerateEmbeddings(texts, batchSize);
}

// 兼容旧代码（废弃）
export const embeddingVectorizer = getEmbeddingVectorizer();

// 导出便捷函数
export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddingVectorizer.generateEmbedding(text);
}

export async function batchGenerateEmbeddings(texts: string[], batchSize?: number): Promise<number[][]> {
  return embeddingVectorizer.batchGenerateEmbeddings(texts, batchSize);
}
