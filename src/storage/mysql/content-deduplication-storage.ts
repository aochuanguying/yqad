import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('content-deduplication-storage');

export interface ContentDeduplicationConfig {
  enabled: boolean;
  checkDays: number;
  similarityThreshold: number;
  titleWeight: number;
  retainDays: number;
}

class ContentDeduplicationStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['content_deduplication_config']);
      if (rows.length === 0) {
        logger.warn('content_deduplication_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('内容去重配置存储初始化完成');
    } catch (error) {
      logger.error('内容去重配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS content_deduplication_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        check_days INT DEFAULT 14,
        similarity_threshold DECIMAL(3,2) DEFAULT 0.70,
        title_weight DECIMAL(3,2) DEFAULT 0.40,
        retain_days INT DEFAULT 30,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ content_deduplication_config 表创建成功');
    await this.query(`
      INSERT INTO content_deduplication_config (enabled, check_days, similarity_threshold, title_weight, retain_days)
      SELECT 1, 14, 0.70, 0.40, 30 WHERE NOT EXISTS (SELECT 1 FROM content_deduplication_config)
    `);
    logger.info('✅ 默认内容去重配置数据插入成功');
  }

  async getConfig(): Promise<ContentDeduplicationConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, check_days, similarity_threshold, title_weight, retain_days FROM content_deduplication_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        checkDays: row.check_days,
        similarityThreshold: parseFloat(row.similarity_threshold),
        titleWeight: parseFloat(row.title_weight),
        retainDays: row.retain_days,
      };
    } catch (error) {
      logger.error('获取内容去重配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: ContentDeduplicationConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM content_deduplication_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO content_deduplication_config (enabled, check_days, similarity_threshold, title_weight, retain_days)
           VALUES (?, ?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.checkDays, config.similarityThreshold, config.titleWeight, config.retainDays]
        );
        logger.info('内容去重配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE content_deduplication_config 
           SET enabled = ?, check_days = ?, similarity_threshold = ?, title_weight = ?, retain_days = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.checkDays, config.similarityThreshold, config.titleWeight, config.retainDays, rows[0].id]
        );
        logger.info('内容去重配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存内容去重配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: ContentDeduplicationStorage | null = null;
export function getContentDeduplicationStorage(): ContentDeduplicationStorage {
  if (!instance) instance = new ContentDeduplicationStorage();
  return instance;
}
export const contentDeduplicationStorage = getContentDeduplicationStorage();
