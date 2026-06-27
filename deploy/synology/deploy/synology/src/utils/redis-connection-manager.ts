import { createClient, RedisClientType } from 'redis';
import { getLogger } from './logger';

const logger = getLogger('redis-connection-manager');

export interface RedisConfig {
  host: string;
  port: number;
  db: number;
  keyPrefix: string;
}

export interface HealthCheckResult {
  connected: boolean;
  latencyMs: number;
}

export class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private client: RedisClientType | null = null;
  private config: RedisConfig | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 3;
  private readonly reconnectDelayMs: number = 1000;

  private constructor() {}

  public static getInstance(): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager();
    }
    return RedisConnectionManager.instance;
  }

  /**
   * 初始化 Redis 连接
   */
  public async initialize(config: RedisConfig): Promise<void> {
    this.config = config;

    try {
      this.client = createClient({
        socket: {
          host: config.host,
          port: config.port,
          reconnectStrategy: (retries: number) => {
            if (retries > this.maxReconnectAttempts) {
              logger.error(`Redis 重连失败，已达到最大尝试次数：${retries}`);
              return new Error('Redis 重连失败');
            }
            logger.info(`Redis 重连中... 尝试次数：${retries}`);
            return this.reconnectDelayMs;
          },
        },
        database: config.db,
      });

      this.client.on('error', (err) => {
        logger.error('Redis 错误:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('✅ Redis 连接成功');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('end', () => {
        logger.warn('Redis 连接关闭');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info(`✅ Redis 初始化完成 (host: ${config.host}:${config.port}, db: ${config.db})`);
    } catch (error) {
      logger.error('❌ Redis 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取 Redis 客户端
   */
  public getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis 未初始化');
    }
    return this.client;
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    if (!this.client || !this.isConnected) {
      return { connected: false, latencyMs: 0 };
    }

    try {
      const startTime = Date.now();
      await this.client.ping();
      const latencyMs = Date.now() - startTime;

      return {
        connected: true,
        latencyMs,
      };
    } catch (error) {
      logger.error('Redis 健康检查失败:', error);
      return {
        connected: false,
        latencyMs: 0,
      };
    }
  }

  /**
   * 优雅关闭连接
   */
  public async disconnect(timeoutMs: number = 5000): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      logger.info('正在关闭 Redis 连接...');

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Redis 关闭超时')), timeoutMs);
      });

      const quitPromise = this.client.quit();

      await Promise.race([quitPromise, timeoutPromise]);
      logger.info('✅ Redis 连接已关闭');
    } catch (error) {
      logger.error('Redis 关闭失败:', error);
      // 强制关闭
      try {
        await this.client.disconnect();
        logger.info('✅ Redis 连接已强制关闭');
      } catch (forceError) {
        logger.error('Redis 强制关闭失败:', forceError);
      }
    } finally {
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * 处理键前缀
   */
  public formatKey(key: string): string {
    if (!this.config) {
      throw new Error('Redis 配置未初始化');
    }
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * 检查是否已连接
   */
  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * 获取配置
   */
  public getConfig(): RedisConfig | null {
    return this.config;
  }
}

// 导出单例
export const redisConnectionManager = RedisConnectionManager.getInstance();

// 辅助函数
export function getRedisClient(): RedisClientType {
  return redisConnectionManager.getClient();
}

export async function healthCheck(): Promise<HealthCheckResult> {
  return redisConnectionManager.healthCheck();
}

export async function disconnectRedis(): Promise<void> {
  return redisConnectionManager.disconnect();
}

export function formatKey(key: string): string {
  return redisConnectionManager.formatKey(key);
}
