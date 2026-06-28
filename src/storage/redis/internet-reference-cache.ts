/**
 * 互联网参考配置 Redis 缓存存储
 * 
 * 功能：
 * 1. 缓存平台配置（5 分钟过期）
 * 2. 缓存搜索词配置
 * 3. 支持手动清除缓存
 * 4. 监控缓存命中率
 */

import { getRedisClient, formatKey } from './index';
import { getLogger } from '../../utils/logger';
import { PlatformConfig, InternetReferenceConfig } from '../mysql/internet-reference-storage';

const logger = getLogger('internet-reference-cache');

/**
 * 缓存统计信息
 */
export interface CacheStatistics {
  hitCount: number;       // 命中次数
  missCount: number;      // 未命中次数
  hitRate: number;        // 命中率（%）
  cacheSize: number;      // 缓存条目数
  avgLatencyMs: number;   // 平均延迟（毫秒）
}

/**
 * 缓存键常量
 */
const CACHE_KEYS = {
  PLATFORM_CONFIG: 'internet_ref:platform_config',           // 所有平台配置
  PLATFORM_PRIORITY: 'internet_ref:platform_priority',       // 平台优先级
  SEARCH_KEYWORDS: 'internet_ref:search_keywords',           // 搜索词配置
  STATISTICS: 'internet_ref:cache_stats',                    // 缓存统计
};

/**
 * 缓存过期时间（秒）
 */
const CACHE_TTL = {
  PLATFORM_CONFIG: 300,      // 5 分钟
  PLATFORM_PRIORITY: 300,    // 5 分钟
  SEARCH_KEYWORDS: 300,      // 5 分钟
};

class InternetReferenceCache {
  private hitCount = 0;
  private missCount = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  /**
   * 任务 6.1: 获取平台配置（带缓存）
   */
  async getAllPlatformConfigs(
    fallbackFetcher: () => Promise<PlatformConfig[]>
  ): Promise<PlatformConfig[]> {
    const startTime = Date.now();
    const cacheKey = formatKey(CACHE_KEYS.PLATFORM_CONFIG);
    
    try {
      // 尝试从 Redis 获取
      const cached = await getRedisClient().get(cacheKey);
      
      if (cached) {
        this.recordHit();
        logger.debug('平台配置缓存命中');
        return JSON.parse(cached) as PlatformConfig[];
      }
      
      // 缓存未命中，使用回退方法获取
      this.recordMiss();
      logger.debug('平台配置缓存未命中，从数据库获取');
      
      const configs = await fallbackFetcher();
      
      // 写入缓存
      await this.setCache(cacheKey, configs, CACHE_TTL.PLATFORM_CONFIG);
      
      return configs;
    } catch (error) {
      logger.warn('获取平台配置失败，使用回退方法:', error instanceof Error ? error.message : String(error));
      // 降级：直接使用回退方法
      return await fallbackFetcher();
    } finally {
      this.recordLatency(Date.now() - startTime);
    }
  }

  /**
   * 获取平台优先级（带缓存）
   */
  async getPlatformPriorities(
    fallbackFetcher: () => Promise<Map<string, number>>
  ): Promise<Map<string, number>> {
    const startTime = Date.now();
    const cacheKey = formatKey(CACHE_KEYS.PLATFORM_PRIORITY);
    
    try {
      // 尝试从 Redis 获取
      const cached = await getRedisClient().get(cacheKey);
      
      if (cached) {
        this.recordHit();
        logger.debug('平台优先级缓存命中');
        return new Map<string, number>(JSON.parse(cached));
      }
      
      // 缓存未命中，使用回退方法获取
      this.recordMiss();
      logger.debug('平台优先级缓存未命中，从数据库获取');
      
      const priorities = await fallbackFetcher();
      
      // 写入缓存
      await this.setCache(cacheKey, Array.from(priorities.entries()), CACHE_TTL.PLATFORM_PRIORITY);
      
      return priorities;
    } catch (error) {
      logger.warn('获取平台优先级失败，使用回退方法:', error instanceof Error ? error.message : String(error));
      return await fallbackFetcher();
    } finally {
      this.recordLatency(Date.now() - startTime);
    }
  }

  /**
   * 获取搜索词配置（带缓存）
   */
  async getSearchKeywords(
    platform: string,
    fallbackFetcher: (platform: string) => Promise<InternetReferenceConfig | null>
  ): Promise<InternetReferenceConfig | null> {
    const startTime = Date.now();
    const cacheKey = formatKey(`${CACHE_KEYS.SEARCH_KEYWORDS}:${platform}`);
    
    try {
      // 尝试从 Redis 获取
      const cached = await getRedisClient().get(cacheKey);
      
      if (cached) {
        this.recordHit();
        logger.debug(`平台 ${platform} 搜索词缓存命中`);
        return JSON.parse(cached) as InternetReferenceConfig;
      }
      
      // 缓存未命中，使用回退方法获取
      this.recordMiss();
      logger.debug(`平台 ${platform} 搜索词缓存未命中，从数据库获取`);
      
      const config = await fallbackFetcher(platform);
      
      // 写入缓存（如果配置存在）
      if (config) {
        await this.setCache(cacheKey, config, CACHE_TTL.SEARCH_KEYWORDS);
      }
      
      return config;
    } catch (error) {
      logger.warn(`获取平台 ${platform} 搜索词配置失败，使用回退方法:`, error instanceof Error ? error.message : String(error));
      return await fallbackFetcher(platform);
    } finally {
      this.recordLatency(Date.now() - startTime);
    }
  }

  /**
   * 任务 6.2: 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      const client = getRedisClient();
      const pattern = formatKey('internet_ref:*');
      
      // 删除所有互联网参考相关缓存
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        logger.info(`已清除 ${keys.length} 个缓存键`);
      }
      
      // 重置统计
      this.hitCount = 0;
      this.missCount = 0;
      this.totalLatencyMs = 0;
      this.requestCount = 0;
      
      logger.info('互联网参考配置缓存已清空');
    } catch (error) {
      logger.error('清除缓存失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 清除指定平台的缓存
   */
  async clearPlatformCache(platform: string): Promise<void> {
    try {
      const client = getRedisClient();
      const keys = [
        formatKey(CACHE_KEYS.PLATFORM_CONFIG),
        formatKey(CACHE_KEYS.PLATFORM_PRIORITY),
        formatKey(`${CACHE_KEYS.SEARCH_KEYWORDS}:${platform}`),
      ];
      
      await client.del(keys);
      logger.info(`平台 ${platform} 缓存已清除`);
    } catch (error) {
      logger.error('清除平台缓存失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 任务 6.3: 配置更新时自动清除缓存
   */
  async invalidateOnUpdate(platform: string): Promise<void> {
    logger.info(`配置更新，清除平台 ${platform} 缓存`);
    await this.clearPlatformCache(platform);
  }

  /**
   * 任务 6.4: 获取缓存统计信息
   */
  async getStatistics(): Promise<CacheStatistics> {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;
    const avgLatency = this.requestCount > 0 ? this.totalLatencyMs / this.requestCount : 0;
    
    // 获取缓存大小
    let cacheSize = 0;
    try {
      const client = getRedisClient();
      const pattern = formatKey('internet_ref:*');
      const keys = await client.keys(pattern);
      cacheSize = keys.length;
    } catch (error) {
      logger.warn('获取缓存大小失败:', error instanceof Error ? error.message : String(error));
    }
    
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: parseFloat(hitRate.toFixed(2)),
      cacheSize,
      avgLatencyMs: parseFloat(avgLatency.toFixed(2)),
    };
  }

  /**
   * 监控告警：命中率低于阈值时告警
   */
  async checkHitRateAlarm(threshold: number = 50): Promise<boolean> {
    const stats = await this.getStatistics();
    
    if (stats.hitRate < threshold) {
      logger.warn(`⚠️ 缓存命中率告警：${stats.hitRate}% < ${threshold}%`);
      return true;  // 需要告警
    }
    
    return false;  // 正常
  }

  /**
   * 监控告警：缓存延迟过高时告警
   */
  async checkLatencyAlarm(thresholdMs: number = 100): Promise<boolean> {
    const stats = await this.getStatistics();
    
    if (stats.avgLatencyMs > thresholdMs) {
      logger.warn(`⚠️ 缓存延迟告警：${stats.avgLatencyMs}ms > ${thresholdMs}ms`);
      return true;  // 需要告警
    }
    
    return false;  // 正常
  }

  // ========== 私有辅助方法 ==========

  /**
   * 写入缓存（带过期时间）
   */
  private async setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      
      await client.setEx(key, ttlSeconds, serialized);
      logger.debug(`缓存已设置：${key}, TTL=${ttlSeconds}s`);
    } catch (error) {
      logger.warn('写入缓存失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 记录缓存命中
   */
  private recordHit(): void {
    this.hitCount++;
  }

  /**
   * 记录缓存未命中
   */
  private recordMiss(): void {
    this.missCount++;
  }

  /**
   * 记录请求延迟
   */
  private recordLatency(latencyMs: number): void {
    this.totalLatencyMs += latencyMs;
    this.requestCount++;
  }
}

// 导出单例
export const internetReferenceCache = new InternetReferenceCache();
export { InternetReferenceCache };
