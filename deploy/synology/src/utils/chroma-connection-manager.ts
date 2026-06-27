/**
 * ChromaDB 连接管理器
 * 
 * 功能：
 * 1. 管理 ChromaDB 客户端连接
 * 2. 支持本地开发和生产环境配置
 * 3. 提供连接健康检查
 * 4. 支持自动创建 Collections
 * 
 * 环境配置：
 * - 本地开发：使用宿主机 IP (10.6.0.5:8000)
 * - 生产环境：使用 Docker 容器名 (chromadb:8000)
 */

import { ChromaClient, Collection } from 'chromadb';
import { getLogger } from './logger';

const logger = getLogger('chroma-connection');

/**
 * ChromaDB 配置接口
 */
export interface ChromaConfig {
  /** ChromaDB 访问 URL */
  url: string;
  /** 是否自动创建 Collections */
  autoCreateCollections?: boolean;
}

/**
 * Collection 配置
 */
export interface CollectionConfig {
  /** Collection 名称 */
  name: string;
  /** Collection 描述 */
  description: string;
  /** 向量维度 */
  dimension: number;
  /** 距离函数 */
  distanceFunction?: 'cosine' | 'l2' | 'ip';
}

/**
 * 获取环境前缀
 */
function getEnvironmentPrefix(): string {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  return isProduction ? 'prod:' : 'dev:';
}

/**
 * ChromaDB 连接管理器类
 */
class ChromaConnectionManager {
  private client: ChromaClient | null = null;
  private config: ChromaConfig | null = null;
  private collections: Map<string, Collection> = new Map();
  private isConnected: boolean = false;

  /**
   * 初始化 ChromaDB 连接
   */
  async initialize(config?: Partial<ChromaConfig>): Promise<ChromaClient> {
    if (this.client && this.isConnected) {
      logger.debug('ChromaDB 已连接，返回现有客户端');
      return this.client;
    }

    try {
      // 构建配置
      this.config = this.buildConfig(config);
      
      logger.info(`初始化 ChromaDB 连接：${this.config.url}`);
      
      // 创建客户端
      this.client = new ChromaClient({
        path: this.config.url,
      });

      // 测试连接
      await this.testConnection();
      
      // 自动创建 Collections
      if (this.config.autoCreateCollections !== false) {
        await this.createDefaultCollections();
      }

      this.isConnected = true;
      logger.info('✅ ChromaDB 连接成功');
      
      return this.client;
    } catch (error) {
      logger.error('❌ ChromaDB 初始化失败:', error);
      throw new Error(`ChromaDB 连接失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 构建配置
   */
  private buildConfig(config?: Partial<ChromaConfig>): ChromaConfig {
    // 优先使用传入的配置
    if (config?.url) {
      return {
        url: config.url,
        autoCreateCollections: config.autoCreateCollections ?? true,
      };
    }

    // 使用环境变量
    const url = process.env.CHROMADB_URL;
    
    if (!url) {
      // 根据环境推断默认值
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const defaultUrl = isDevelopment 
        ? 'http://192.168.50.50:8000'  // 本地开发
        : 'http://192.168.50.50:8000';        // 生产环境
      
      logger.warn(`未配置 CHROMADB_URL，使用默认值：${defaultUrl}`);
      return {
        url: defaultUrl,
        autoCreateCollections: true,
      };
    }

    return {
      url,
      autoCreateCollections: config?.autoCreateCollections ?? true,
    };
  }

  /**
   * 测试连接
   */
  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('ChromaDB 客户端未初始化');
    }

    try {
      const collections = await this.client.listCollections();
      logger.debug(`ChromaDB 连接测试成功，现有 ${collections.length} 个 Collections`);
    } catch (error) {
      throw new Error(`ChromaDB 连接测试失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取带环境前缀的 Collection 名称
   */
  private getPrefixedCollectionName(baseName: string): string {
    const prefix = getEnvironmentPrefix();
    return `${prefix}${baseName}`;
  }

  /**
   * 创建默认 Collections
   */
  private async createDefaultCollections(): Promise<void> {
    if (!this.client) {
      throw new Error('ChromaDB 客户端未初始化');
    }

    const envPrefix = getEnvironmentPrefix();
    logger.info(`当前环境：${process.env.NODE_ENV || 'development'}，Collection 前缀：${envPrefix}`);

    const defaultCollections: CollectionConfig[] = [
      {
        name: this.getPrefixedCollectionName('materials'),
        description: 'Material embeddings for similarity search and recommendation',
        dimension: 1536, // 使用 OpenAI Embedding 维度
        distanceFunction: 'cosine',
      },
      {
        name: this.getPrefixedCollectionName('content_dedup'),
        description: 'Post content embeddings for duplication detection',
        dimension: 1536,
        distanceFunction: 'cosine',
      },
      {
        name: this.getPrefixedCollectionName('topic_recommend'),
        description: 'Topic embeddings for recommendation system',
        dimension: 1536,
        distanceFunction: 'cosine',
      },
      {
        name: this.getPrefixedCollectionName('sensitive_variants'),
        description: 'Sensitive word variants for semantic detection',
        dimension: 1536,
        distanceFunction: 'cosine',
      },
      {
        name: this.getPrefixedCollectionName('comment_sentiment'),
        description: 'Comment sentiment analysis and clustering',
        dimension: 1536,
        distanceFunction: 'cosine',
      },
    ];

    for (const collectionConfig of defaultCollections) {
      try {
        // 尝试获取现有 Collection
        try {
          const existing = await this.client.getCollection({ name: collectionConfig.name });
          logger.debug(`Collection "${collectionConfig.name}" 已存在`);
          this.collections.set(collectionConfig.name, existing);
          continue;
        } catch (error) {
          // Collection 不存在，继续创建
        }

        // 创建 Collection
        const collection = await this.client.createCollection({
          name: collectionConfig.name,
          metadata: {
            description: collectionConfig.description,
            dimension: collectionConfig.dimension,
            distance_function: collectionConfig.distanceFunction || 'cosine',
          },
        });

        this.collections.set(collectionConfig.name, collection);
        logger.info(`✅ Collection "${collectionConfig.name}" 创建成功`);
      } catch (error) {
        logger.error(`创建 Collection "${collectionConfig.name}" 失败:`, error);
        // 不抛出异常，继续创建其他 Collections
      }
    }
  }

  /**
   * 获取 ChromaDB 客户端
   */
  getClient(): ChromaClient {
    if (!this.client || !this.isConnected) {
      throw new Error('ChromaDB 未初始化，请先调用 initialize()');
    }
    return this.client;
  }

  /**
   * 获取 Collection
   */
  async getCollection(name: string): Promise<Collection> {
    if (!this.client || !this.isConnected) {
      throw new Error('ChromaDB 未初始化');
    }

    // 检查缓存
    const cached = this.collections.get(name);
    if (cached) {
      return cached;
    }

    // 获取 Collection
    try {
      const collection = await this.client.getCollection({ name });
      this.collections.set(name, collection);
      return collection;
    } catch (error) {
      throw new Error(`获取 Collection "${name}" 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有 Collections
   */
  async getCollections(): Promise<Map<string, Collection>> {
    if (!this.client || !this.isConnected) {
      throw new Error('ChromaDB 未初始化');
    }

    // 刷新 Collections 列表
    const collections = await this.client.listCollections();
    this.collections.clear();
    
    for (const collection of collections) {
      this.collections.set(collection.name, collection);
    }

    return this.collections;
  }

  /**
   * 检查 Collection 是否存在
   */
  async collectionExists(name: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.getCollection({ name });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const collections = await this.client.listCollections();
      logger.debug(`ChromaDB 健康检查通过，${collections.length} 个 Collections`);
      return true;
    } catch (error) {
      logger.error('ChromaDB 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.client) {
      logger.info('关闭 ChromaDB 连接');
      this.collections.clear();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * 重置连接（用于重新连接）
   */
  async reset(): Promise<void> {
    await this.close();
    this.config = null;
  }
}

// 导出单例
export const chromaConnectionManager = new ChromaConnectionManager();

// 导出便捷函数
export async function initChromaDB(config?: Partial<ChromaConfig>): Promise<ChromaClient> {
  return chromaConnectionManager.initialize(config);
}

export function getChromaClient(): ChromaClient {
  return chromaConnectionManager.getClient();
}

export async function getChromaCollection(name: string): Promise<Collection> {
  return chromaConnectionManager.getCollection(name);
}

export async function checkChromaHealth(): Promise<boolean> {
  return chromaConnectionManager.healthCheck();
}
