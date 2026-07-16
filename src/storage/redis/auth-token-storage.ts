import { getRedisClient, formatKey } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';
import * as CryptoJS from 'crypto-js';

const logger = getLogger('auth-token-storage');

export interface TokenOptions {
  ttlSeconds?: number;
  encrypt?: boolean;
}

/**
 * 登录 Token 存储
 *
 * 使用独立的 Redis 键 auth:token，与 API Token（api:token）完全隔离。
 * 存储一汽奥迪 APP 的 JWT 登录 Token。
 */
export class AuthTokenStorage {
  private useRedis: boolean = true;
  private memoryToken: string | null = null;
  private readonly encryptionKey: string;
  private readonly configKey: string = 'auth_token';

  constructor() {
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'yqad-default-encryption-key-2026';
  }

  private encryptToken(token: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      logger.error('Token 加密失败:', error);
      throw error;
    }
  }

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

  async saveToken(token: string, options?: TokenOptions): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('auth:token');

        const encryptedToken = options?.encrypt !== false ? this.encryptToken(token) : token;

        await client.set(key, encryptedToken);

        if (options?.ttlSeconds) {
          await client.expire(key, options.ttlSeconds);
          logger.debug(`保存登录 Token，TTL: ${options.ttlSeconds}秒`);
        } else {
          logger.debug('保存登录 Token（永久）');
        }

        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    this.memoryToken = token;
    logger.debug('[内存] 保存登录 Token');
  }

  async getToken(): Promise<string | null> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('auth:token');
        const value = await client.get(key);

        if (value === null) {
          return null;
        }

        if (value.startsWith('U2FsdGVk')) {
          return this.decryptToken(value);
        }

        return value;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    return this.memoryToken;
  }

  async deleteToken(): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('auth:token');
        await client.del(key);
        logger.debug('删除登录 Token');
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    this.memoryToken = null;
    logger.debug('[内存] 删除登录 Token');
  }

  async hasToken(): Promise<boolean> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('auth:token');
        const exists = await client.exists(key);
        return exists === 1;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    return this.memoryToken !== null;
  }

  resetToRedis(): void {
    this.useRedis = true;
    logger.info('已重置为 Redis 存储模式');
  }
}

export const authTokenStorage = new AuthTokenStorage();
