import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

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
}

let instance: InternetReferenceStorage | null = null;
export function getInternetReferenceStorage(): InternetReferenceStorage {
  if (!instance) instance = new InternetReferenceStorage();
  return instance;
}
export const internetReferenceStorage = getInternetReferenceStorage();
