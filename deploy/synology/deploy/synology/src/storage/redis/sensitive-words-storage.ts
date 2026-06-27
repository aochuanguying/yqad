import { getRedisClient, formatKey } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('sensitive-words-storage');

/**
 * 敏感词库存储
 * 
 * 使用 Redis Set 存储敏感词
 * Key 格式：{prefix}sensitive:words
 */
export class SensitiveWordsStorage {
  private useRedis: boolean = true;
  private memoryStore: Set<string> = new Set();
  private subscriberClient: any = null;

  /**
   * 添加敏感词
   */
  async addWord(word: string): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('sensitive:words');
        await client.sAdd(key, word);
        logger.debug(`添加敏感词：${word}`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryStore.add(word);
    logger.debug(`[内存] 添加敏感词：${word}`);
  }

  /**
   * 移除敏感词
   */
  async removeWord(word: string): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('sensitive:words');
        await client.sRem(key, word);
        logger.debug(`移除敏感词：${word}`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryStore.delete(word);
    logger.debug(`[内存] 移除敏感词：${word}`);
  }

  /**
   * 检查是否包含敏感词
   */
  async contains(word: string): Promise<boolean> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('sensitive:words');
        const result = await client.sIsMember(key, word);
        return result === 1;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return this.memoryStore.has(word);
  }

  /**
   * 获取所有敏感词
   */
  async getAllWords(): Promise<string[]> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('sensitive:words');
        return await client.sMembers(key);
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return Array.from(this.memoryStore);
  }

  /**
   * 批量导入敏感词（使用 Pipeline）
   */
  async importWords(words: string[]): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey('sensitive:words');
        
        const pipeline = client.multi();
        for (const word of words) {
          pipeline.sAdd(key, word);
        }
        
        await pipeline.exec();
        logger.info(`批量导入 ${words.length} 个敏感词`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    for (const word of words) {
      this.memoryStore.add(word);
    }
    logger.info(`[内存] 批量导入 ${words.length} 个敏感词`);
  }

  /**
   * 初始化 Pub/Sub 热更新监听
   */
  async initPubSubListener(): Promise<void> {
    try {
      if (!this.useRedis) {
        return;
      }

      const { createClient } = await import('redis');
      const config = (await import('../../utils/redis-config-loader')).getRedisConfig();
      
      this.subscriberClient = createClient({
        socket: {
          host: config.host,
          port: config.port,
        },
        database: config.db,
      });

      await this.subscriberClient.connect();
      
      const channel = formatKey('sensitive:words:update');
      
      this.subscriberClient.subscribe(channel, (message: string) => {
        logger.info(`收到敏感词库更新通知：${message}`);
        // 可以选择重新加载词库
      });
      
      logger.info('✅ 敏感词库 Pub/Sub 监听已初始化');
    } catch (error) {
      logger.error('敏感词库 Pub/Sub 初始化失败:', error);
    }
  }

  /**
   * 发布词库更新通知
   */
  async reloadWordLibrary(): Promise<void> {
    try {
      if (this.useRedis && this.subscriberClient) {
        const client = getRedisClient();
        const channel = formatKey('sensitive:words:update');
        await client.publish(channel, `词库已更新：${new Date().toISOString()}`);
        logger.info('已发布敏感词库更新通知');
        return;
      }
    } catch (error) {
      logger.error('发布敏感词库更新通知失败:', error);
    }
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
export const sensitiveWordsStorage = new SensitiveWordsStorage();
