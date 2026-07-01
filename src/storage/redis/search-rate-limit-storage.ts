/**
 * 搜索频率限制 Redis 存储
 * 
 * 功能：
 * 1. 记录每个平台每小时的查询次数
 * 2. 记录查询历史（用于统计）
 * 3. 支持频率限制检查
 */

import { RedisConnectionManager } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('search-rate-limit-storage');

/**
 * 平台查询统计
 */
export interface PlatformQueryStats {
  platform: string;
  queryCount: number;      // 当前小时查询次数
  lastQueryTime: number;   // 最后查询时间戳
  hourStart: number;       // 小时开始时间戳
}

/**
 * 搜索频率限制存储类
 */
class SearchRateLimitStorage {
  private redisClient = RedisConnectionManager.getInstance();
  private readonly KEY_PREFIX = 'search:rate_limit:';
  private readonly STATS_KEY_PREFIX = 'search:stats:';

  /**
   * 获取平台当前小时的查询次数
   */
  async getQueryCount(platform: string): Promise<number> {
    try {
      const redis = this.redisClient.getClient();
      const key = `${this.KEY_PREFIX}${platform}:${this.getCurrentHour()}`;
      const count = await redis.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error(`获取平台 ${platform} 查询次数失败：${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * 增加平台查询次数
   */
  async incrementQueryCount(platform: string): Promise<number> {
    try {
      const redis = this.redisClient.getClient();
      const key = `${this.KEY_PREFIX}${platform}:${this.getCurrentHour()}`;
      const newCount = await redis.incr(key);
      
      // 设置过期时间（1 小时）
      await redis.expire(key, 3600);
      
      // 同时记录详细统计
      await this.recordQueryStats(platform);
      
      logger.debug(`平台 ${platform} 查询次数 +1，当前：${newCount}`);
      return newCount;
    } catch (error) {
      logger.error(`增加平台 ${platform} 查询次数失败：${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * 记录查询统计（用于历史分析）
   */
  private async recordQueryStats(platform: string): Promise<void> {
    try {
      const redis = this.redisClient.getClient();
      const key = `${this.STATS_KEY_PREFIX}${platform}:${Date.now()}`;
      const stats: PlatformQueryStats = {
        platform,
        queryCount: 1,
        lastQueryTime: Date.now(),
        hourStart: this.getCurrentHour(),
      };
      
      await redis.setEx(key, 86400, JSON.stringify(stats)); // 保留 24 小时
    } catch (error) {
      logger.warn(`记录查询统计失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查是否超过频率限制
   */
  async isRateLimitExceeded(platform: string, limit: number): Promise<boolean> {
    const count = await this.getQueryCount(platform);
    return count >= limit;
  }

  /**
   * 获取所有平台的查询统计
   */
  async getAllPlatformStats(): Promise<Map<string, PlatformQueryStats>> {
    try {
      const stats = new Map<string, PlatformQueryStats>();
      const platforms = ['xiaohongshu', 'weibo', 'zhihu', 'autohome'];
      
      for (const platform of platforms) {
        const count = await this.getQueryCount(platform);
        if (count > 0) {
          stats.set(platform, {
            platform,
            queryCount: count,
            lastQueryTime: Date.now(),
            hourStart: this.getCurrentHour(),
          });
        }
      }
      
      return stats;
    } catch (error) {
      logger.error(`获取所有平台统计失败：${error instanceof Error ? error.message : String(error)}`);
      return new Map();
    }
  }

  /**
   * 重置平台查询次数（用于测试）
   */
  async resetQueryCount(platform: string): Promise<void> {
    try {
      const redis = this.redisClient.getClient();
      const key = `${this.KEY_PREFIX}${platform}:${this.getCurrentHour()}`;
      await redis.del(key);
      logger.info(`平台 ${platform} 查询次数已重置`);
    } catch (error) {
      logger.error(`重置平台 ${platform} 查询次数失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取当前小时的时间戳
   */
  private getCurrentHour(): number {
    const now = new Date();
    return Math.floor(now.getTime() / 3600000) * 3600000;
  }

  /**
   * 清理过期数据（定期调用）
   */
  async cleanup(): Promise<void> {
    try {
      // Redis 会自动过期，这里可以添加监控逻辑
      logger.debug('搜索频率限制数据清理完成（Redis 自动过期）');
    } catch (error) {
      logger.warn(`清理过期数据失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例
export const searchRateLimitStorage = new SearchRateLimitStorage();
