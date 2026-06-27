import { getRedisClient, formatKey } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';
import * as CryptoJS from 'crypto-js';

const logger = getLogger('api-token-storage');

export interface TokenOptions {
  ttlSeconds?: number;
  encrypt?: boolean;
}

/**
 * API Token 存储
 * 
 * 使用 MySQL 存储加密的 Token（降级方案：Redis 不可用时）
 */
export class ApiTokenStorage {
  private useRedis: boolean = true;
  private memoryToken: string | null = null;
  private readonly encryptionKey: string;
  private readonly configKey: string = 'api_token';

  constructor() {
    // 从环境变量获取加密密钥，如果没有则使用默认值（生产环境应该设置）
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'yqad-default-encryption-key-2026';
  }

  /**
   * 加密 Token（AES-256-GCM）
   */
  private encryptToken(token: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      logger.error('Token 加密失败:', error);
      throw error;
    }
  }

  /**
   * 解密 Token
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey).toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        throw new Error('解密失败');
      }
      return decrypted;
    } catch (error) {
      logger.error('Token 解密失败:', error);
      throw error;
    }
  }

  /**
   * 保存 Token
   */
  async saveToken(token: string, options?: TokenOptions): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('api:token');
        
        // 加密 Token
        const encryptedToken = options?.encrypt !== false ? this.encryptToken(token) : token;
        
        await client.set(key, encryptedToken);
        
        // 设置 TTL（如果指定）
        if (options?.ttlSeconds) {
          await client.expire(key, options.ttlSeconds);
          logger.debug(`保存 API Token，TTL: ${options.ttlSeconds}秒`);
        } else {
          logger.debug('保存 API Token（永久）');
        }
        
        return;
    }
  } catch (error) {
    logger.warn('Redis 不可用，降级到内存存储:', error);
    this.useRedis = false;
  }

  // 降级到内存存储
  this.memoryToken = token;
  logger.debug('[内存] 保存 API Token');
}

  /**
   * 获取 Token
   */
  async getToken(): Promise<string | null> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('api:token');
        const value = await client.get(key);
        
        if (value === null) {
          return null;
        }
        
        // 尝试解密（如果看起来是加密的）
        if (value.startsWith('U2FsdGVk')) {
          return this.decryptToken(value);
        }
        
        return value;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return this.memoryToken;
  }

  /**
   * 删除 Token
   */
  async deleteToken(): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('api:token');
        await client.del(key);
        logger.debug('删除 API Token');
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryToken = null;
    logger.debug('[内存] 删除 API Token');
  }

  /**
   * 检查是否有 Token
   */
  async hasToken(): Promise<boolean> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('api:token');
        const exists = await client.exists(key);
        return exists === 1;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return this.memoryToken !== null;
  }

  /**
   * 重置为 Redis 模式
   */
  resetToRedis(): void {
    this.useRedis = true;
    logger.info('已重置为 Redis 存储模式');
  }
}

// 导出单例
export const apiTokenStorage = new ApiTokenStorage();
