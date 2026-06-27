import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('posting-interval-control-storage');

export interface PostingIntervalControlConfig {
  enabled: boolean;
  minIntervalDays: number;
  whitelist: string[];
  enableEmergencyOverride: boolean;
}

class PostingIntervalControlStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['posting_interval_control_config']);
      if (rows.length === 0) {
        logger.warn('posting_interval_control_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('发帖间隔控制配置存储初始化完成');
    } catch (error) {
      logger.error('发帖间隔控制配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS posting_interval_control_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        min_interval_days INT DEFAULT 5,
        whitelist VARCHAR(1000) DEFAULT NULL,
        enable_emergency_override TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ posting_interval_control_config 表创建成功');
    await this.query(`
      INSERT INTO posting_interval_control_config (enabled, min_interval_days, whitelist, enable_emergency_override)
      SELECT 1, 5, NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM posting_interval_control_config)
    `);
    logger.info('✅ 默认发帖间隔控制配置数据插入成功');
  }

  async getConfig(): Promise<PostingIntervalControlConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, min_interval_days, whitelist, enable_emergency_override FROM posting_interval_control_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        minIntervalDays: row.min_interval_days,
        whitelist: row.whitelist ? row.whitelist.split(',').filter((s: string) => s.trim()) : [],
        enableEmergencyOverride: row.enable_emergency_override === 1,
      };
    } catch (error) {
      logger.error('获取发帖间隔控制配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: PostingIntervalControlConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM posting_interval_control_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO posting_interval_control_config (enabled, min_interval_days, whitelist, enable_emergency_override)
           VALUES (?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.minIntervalDays, config.whitelist.length > 0 ? config.whitelist.join(',') : null, config.enableEmergencyOverride ? 1 : 0]
        );
        logger.info('发帖间隔控制配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE posting_interval_control_config 
           SET enabled = ?, min_interval_days = ?, whitelist = ?, enable_emergency_override = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.minIntervalDays, config.whitelist.length > 0 ? config.whitelist.join(',') : null, config.enableEmergencyOverride ? 1 : 0, rows[0].id]
        );
        logger.info('发帖间隔控制配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存发帖间隔控制配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: PostingIntervalControlStorage | null = null;
export function getPostingIntervalControlStorage(): PostingIntervalControlStorage {
  if (!instance) instance = new PostingIntervalControlStorage();
  return instance;
}
export const postingIntervalControlStorage = getPostingIntervalControlStorage();
