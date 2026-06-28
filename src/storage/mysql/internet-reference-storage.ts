import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';
import { internetReferenceCache } from '../redis/internet-reference-cache';

const logger = getLogger('internet-reference-storage');

export interface InternetReferenceConfig {
  enabled: boolean;
  searchKeywords: string[];
  maxResults: number;
  timeout: number;
  rateLimitPerHour: number;
  platform: string;
  watermarkRemoval: {
    enabled: boolean;
    timeout: number;
    maxRetries: number;
    batchSize: number;
  };
}

export interface PlatformConfig {
  platformName: string;
  platformDisplay: string;
  priority: number;
  rateLimitPerHour: number;
  successRate: number;
  enabled: boolean;
}

class InternetReferenceStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['internet_reference_config']);
      if (rows.length === 0) {
        logger.warn('internet_reference_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('互联网参考配置存储初始化完成');
    } catch (error) {
      logger.error('互联网参考配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS internet_reference_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        search_keywords VARCHAR(500) DEFAULT NULL,
        max_results INT DEFAULT 5,
        timeout INT DEFAULT 90000,
        rate_limit_per_hour INT DEFAULT 10,
        platform VARCHAR(50) DEFAULT 'xiaohongshu',
        watermark_removal_enabled TINYINT(1) DEFAULT 1,
        watermark_removal_timeout INT DEFAULT 30000,
        watermark_removal_max_retries INT DEFAULT 2,
        watermark_removal_batch_size INT DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ internet_reference_config 表创建成功');
    await this.query(`
      INSERT INTO internet_reference_config (
        enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform,
        watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size
      )
      SELECT 1, '奥迪，奥迪 Q5L，奥迪用车，自驾游，露营', 5, 90000, 10, 'xiaohongshu', 1, 30000, 2, 5
      WHERE NOT EXISTS (SELECT 1 FROM internet_reference_config)
    `);
    logger.info('✅ 默认互联网参考配置数据插入成功');
  }

  async getConfig(): Promise<InternetReferenceConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform, watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size FROM internet_reference_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        searchKeywords: row.search_keywords ? row.search_keywords.split(',') : [],
        maxResults: row.max_results,
        timeout: row.timeout,
        rateLimitPerHour: row.rate_limit_per_hour,
        platform: row.platform,
        watermarkRemoval: {
          enabled: row.watermark_removal_enabled === 1,
          timeout: row.watermark_removal_timeout,
          maxRetries: row.watermark_removal_max_retries,
          batchSize: row.watermark_removal_batch_size,
        },
      };
    } catch (error) {
      logger.error('获取互联网参考配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: InternetReferenceConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM internet_reference_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO internet_reference_config (
            enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform,
            watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            config.enabled ? 1 : 0,
            config.searchKeywords.join(','),
            config.maxResults,
            config.timeout,
            config.rateLimitPerHour,
            config.platform,
            config.watermarkRemoval.enabled ? 1 : 0,
            config.watermarkRemoval.timeout,
            config.watermarkRemoval.maxRetries,
            config.watermarkRemoval.batchSize,
          ]
        );
        logger.info('互联网参考配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE internet_reference_config 
           SET enabled = ?, search_keywords = ?, max_results = ?, timeout = ?, rate_limit_per_hour = ?, platform = ?,
               watermark_removal_enabled = ?, watermark_removal_timeout = ?, watermark_removal_max_retries = ?, watermark_removal_batch_size = ?
           WHERE id = ?`,
          [
            config.enabled ? 1 : 0,
            config.searchKeywords.join(','),
            config.maxResults,
            config.timeout,
            config.rateLimitPerHour,
            config.platform,
            config.watermarkRemoval.enabled ? 1 : 0,
            config.watermarkRemoval.timeout,
            config.watermarkRemoval.maxRetries,
            config.watermarkRemoval.batchSize,
            rows[0].id,
          ]
        );
        logger.info('互联网参考配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存互联网参考配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 任务 1.5: 获取分平台配置（带 Redis 缓存）
  async getConfigByPlatform(platform: string): Promise<InternetReferenceConfig | null> {
    // 使用缓存包装器
    return await internetReferenceCache.getSearchKeywords(platform, async (p) => {
      // 回退方法：从数据库获取
      try {
        // 优先查询指定平台配置
        let rows = await this.query<any[]>(
          'SELECT enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform, watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size FROM internet_reference_config WHERE platform = ? LIMIT 1',
          [p]
        );
        
        // 如果没有找到，尝试查询通用配置（platform='all'）
        if (rows.length === 0 && p !== 'all') {
          rows = await this.query<any[]>(
            'SELECT enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform, watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size FROM internet_reference_config WHERE platform = ? OR platform = ? LIMIT 1',
            ['all', p]
          );
        }
        
        if (rows.length === 0) return null;
        
        const row = rows[0];
        return {
          enabled: row.enabled === 1,
          searchKeywords: row.search_keywords ? row.search_keywords.split(',') : [],
          maxResults: row.max_results,
          timeout: row.timeout,
          rateLimitPerHour: row.rate_limit_per_hour,
          platform: row.platform,
          watermarkRemoval: {
            enabled: row.watermark_removal_enabled === 1,
            timeout: row.watermark_removal_timeout,
            maxRetries: row.watermark_removal_max_retries,
            batchSize: row.watermark_removal_batch_size,
          },
        };
      } catch (error) {
        logger.error('获取分平台配置失败（数据库）:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    });
  }

  // 任务 1.6: 更新平台优先级（带缓存清除）
  async updatePlatformPriority(platform: string, priority: number): Promise<void> {
    try {
      // 校验优先级范围
      if (priority < 1 || priority > 10) {
        throw new Error('优先级必须在 1-10 范围内');
      }
      
      await this.query(
        'UPDATE internet_reference_platforms SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE platform_name = ?',
        [priority, platform]
      );
      
      // 任务 6.3: 配置更新时自动清除缓存
      await internetReferenceCache.invalidateOnUpdate(platform);
      
      logger.info(`平台 ${platform} 优先级已更新为 ${priority}，缓存已清除`);
    } catch (error) {
      logger.error('更新平台优先级失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 任务 1.7: 记录成功率
  async recordSuccess(platform: string, success: boolean): Promise<void> {
    try {
      // 查询当前成功率
      const rows = await this.query<any[]>(
        'SELECT success_rate FROM internet_reference_platforms WHERE platform_name = ?',
        [platform]
      );
      
      if (rows.length === 0) {
        // 如果平台不存在，插入新记录
        await this.query(
          `INSERT INTO internet_reference_platforms (platform_name, platform_display, success_rate, enabled)
           VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE success_rate = ?`,
          [platform, platform, success ? 100.0 : 0.0, success ? 100.0 : 0.0]
        );
      } else {
        // 使用移动平均更新成功率（权重：新数据 10%，历史数据 90%）
        const currentRate = parseFloat(rows[0].success_rate);
        const newRate = success ? 100.0 : 0.0;
        const updatedRate = currentRate * 0.9 + newRate * 0.1;
        
        await this.query(
          'UPDATE internet_reference_platforms SET success_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE platform_name = ?',
          [updatedRate, platform]
        );
      }
      
      logger.debug(`平台 ${platform} 成功率已记录：${success ? '成功' : '失败'}`);
    } catch (error) {
      logger.error('记录平台成功率失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 获取所有平台配置（带 Redis 缓存）
  async getAllPlatformConfigs(): Promise<PlatformConfig[]> {
    // 使用缓存包装器
    return await internetReferenceCache.getAllPlatformConfigs(async () => {
      // 回退方法：从数据库获取
      try {
        const rows = await this.query<any[]>(
          'SELECT platform_name, platform_display, priority, rate_limit_per_hour, success_rate, enabled FROM internet_reference_platforms ORDER BY priority DESC'
        );
        
        return rows.map(row => ({
          platformName: row.platform_name,
          platformDisplay: row.platform_display,
          priority: row.priority,
          rateLimitPerHour: row.rate_limit_per_hour,
          successRate: parseFloat(row.success_rate),
          enabled: row.enabled === 1,
        }));
      } catch (error) {
        logger.error('获取所有平台配置失败（数据库）:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    });
  }

  // 获取平台优先级（带 Redis 缓存）
  async getPlatformPriorities(): Promise<Map<string, number>> {
    // 使用缓存包装器
    return await internetReferenceCache.getPlatformPriorities(async () => {
      // 回退方法：从数据库获取
      try {
        const rows = await this.query<any[]>(
          'SELECT platform_name, priority FROM internet_reference_platforms ORDER BY priority DESC'
        );
        
        const priorities = new Map<string, number>();
        for (const row of rows) {
          priorities.set(row.platform_name, row.priority);
        }
        
        return priorities;
      } catch (error) {
        logger.error('获取平台优先级失败（数据库）:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    });
  }
}

let instance: InternetReferenceStorage | null = null;
export function getInternetReferenceStorage(): InternetReferenceStorage {
  if (!instance) instance = new InternetReferenceStorage();
  return instance;
}
export const internetReferenceStorage = getInternetReferenceStorage();
