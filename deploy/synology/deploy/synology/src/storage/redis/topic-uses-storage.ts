import { getRedisClient, formatKey } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('topic-uses-storage');

/**
 * 主题可用次数存储
 * 
 * 使用 Redis String 存储主题剩余可用次数
 * Key 格式：{prefix}topic:uses:{topicId}
 * TTL: 7 天
 */
export class TopicUsesStorage {
  private readonly TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天
  private useRedis: boolean = true;
  private memoryStore: Map<string, number> = new Map();

  /**
   * 设置主题可用次数
   */
  async setUses(topicId: string, uses: number): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`topic:uses:${topicId}`);
        await client.set(key, uses.toString());
        await client.expire(key, this.TTL_SECONDS);
        logger.debug(`设置主题 ${topicId} 可用次数：${uses}`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryStore.set(topicId, uses);
    logger.debug(`[内存] 设置主题 ${topicId} 可用次数：${uses}`);
  }

  /**
   * 获取主题可用次数
   */
  async getUses(topicId: string): Promise<number> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`topic:uses:${topicId}`);
        const value = await client.get(key);
        
        if (value === null) {
          return 0;
        }
        
        return parseInt(value, 10);
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return this.memoryStore.get(topicId) || 0;
  }

  /**
   * 增加主题可用次数
   */
  async incrementUses(topicId: string, delta: number = 1): Promise<number> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`topic:uses:${topicId}`);
        const newValue = await client.incrBy(key, delta);
        
        // 设置过期时间（如果不存在）
        const ttl = await client.ttl(key);
        if (ttl === -1) {
          await client.expire(key, this.TTL_SECONDS);
        }
        
        logger.debug(`增加主题 ${topicId} 可用次数：+${delta}，当前：${newValue}`);
        return newValue;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    const currentValue = this.memoryStore.get(topicId) || 0;
    const newValue = currentValue + delta;
    this.memoryStore.set(topicId, newValue);
    logger.debug(`[内存] 增加主题 ${topicId} 可用次数：+${delta}，当前：${newValue}`);
    return newValue;
  }

  /**
   * 减少主题可用次数（确保非负）
   */
  async decrementUses(topicId: string, delta: number = 1): Promise<number> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`topic:uses:${topicId}`);
        
        // 先获取当前值
        const currentValue = await client.get(key);
        const currentNum = currentValue ? parseInt(currentValue, 10) : 0;
        
        // 确保不会减到负数
        if (currentNum < delta) {
          logger.warn(`主题 ${topicId} 可用次数不足：当前${currentNum}，尝试减少${delta}`);
          return 0;
        }
        
        const newValue = await client.incrBy(key, -delta);
        logger.debug(`减少主题 ${topicId} 可用次数：-${delta}，当前：${newValue}`);
        return newValue;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    const currentValue = this.memoryStore.get(topicId) || 0;
    const newValue = Math.max(0, currentValue - delta);
    this.memoryStore.set(topicId, newValue);
    logger.debug(`[内存] 减少主题 ${topicId} 可用次数：-${delta}，当前：${newValue}`);
    return newValue;
  }

  /**
   * 删除主题可用次数
   */
  async deleteUses(topicId: string): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`topic:uses:${topicId}`);
        await client.del(key);
        logger.debug(`删除主题 ${topicId} 可用次数`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryStore.delete(topicId);
    logger.debug(`[内存] 删除主题 ${topicId} 可用次数`);
  }

  /**
   * 检查主题是否有可用次数
   */
  async hasUses(topicId: string): Promise<boolean> {
    const uses = await this.getUses(topicId);
    return uses > 0;
  }

  /**
   * 重置为 Redis 模式（当 Redis 恢复时调用）
   */
  resetToRedis(): void {
    this.useRedis = true;
    logger.info('已重置为 Redis 存储模式');
  }
}

// 导出单例
export const topicUsesStorage = new TopicUsesStorage();
