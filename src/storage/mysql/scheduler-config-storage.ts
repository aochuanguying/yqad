import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('scheduler-config-storage');

export interface SchedulerConfig {
  comment: {
    cron: string;
    randomOffsetMin: number;
    randomOffsetMax: number;
  };
  /**
   * @deprecated 发帖任务已移除，所有发帖由外部 autojs 脚本通过 API 触发
   * 此配置字段保留但不再使用，未来版本将删除
   */
  post?: {
    cron: string;
    randomOffsetMin: number;
    randomOffsetMax: number;
  };
  materialProcessing: {
    intervalMinutes: number;
    enabled: boolean;
  };
  cookieRefresh: {
    enabled: boolean;
    cron: string;
    autoEnabled: boolean; // 到期自动刷新（提前 1 小时）
    randomOffsetMin?: number; // 最小随机偏移（分钟）
    randomOffsetMax?: number; // 最大随机偏移（分钟）
  };
}

class SchedulerConfigStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['scheduler_config']);
      if (rows.length === 0) {
        logger.warn('scheduler_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('调度器配置存储初始化完成');
    } catch (error) {
      logger.error('调度器配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS scheduler_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comment_cron VARCHAR(50) DEFAULT '0 10 * * *',
        comment_random_offset_min INT DEFAULT 0,
        comment_random_offset_max INT DEFAULT 600,
        post_cron VARCHAR(50) DEFAULT '0 12 * * *',
        post_random_offset_min INT DEFAULT 0,
        post_random_offset_max INT DEFAULT 360,
        material_processing_interval_minutes INT DEFAULT 45,
        material_processing_enabled TINYINT(1) DEFAULT 1,
        cookie_refresh_enabled TINYINT(1) DEFAULT 0,
        cookie_refresh_cron VARCHAR(50) DEFAULT '0 2 * * *',
        cookie_refresh_auto_enabled TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ scheduler_config 表创建成功');
    await this.query(`
      INSERT INTO scheduler_config (
        comment_cron, comment_random_offset_min, comment_random_offset_max,
        post_cron, post_random_offset_min, post_random_offset_max,
        material_processing_interval_minutes, material_processing_enabled,
        cookie_refresh_enabled, cookie_refresh_cron, cookie_refresh_auto_enabled
      )
      SELECT '0 10 * * *', 0, 600, '0 12 * * *', 0, 360, 45, 1, 0, '0 2 * * *', 1
      WHERE NOT EXISTS (SELECT 1 FROM scheduler_config)
    `);
    logger.info('✅ 默认调度器配置数据插入成功');
  }

  async getConfig(): Promise<SchedulerConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT comment_cron, comment_random_offset_min, comment_random_offset_max, post_cron, post_random_offset_min, post_random_offset_max, material_processing_interval_minutes, material_processing_enabled, cookie_refresh_enabled, cookie_refresh_cron, cookie_refresh_auto_enabled FROM scheduler_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        comment: {
          cron: row.comment_cron,
          randomOffsetMin: row.comment_random_offset_min,
          randomOffsetMax: row.comment_random_offset_max,
        },
        post: {
          cron: row.post_cron,
          randomOffsetMin: row.post_random_offset_min,
          randomOffsetMax: row.post_random_offset_max,
        },
        materialProcessing: {
          intervalMinutes: row.material_processing_interval_minutes,
          enabled: row.material_processing_enabled === 1,
        },
        cookieRefresh: {
          enabled: row.cookie_refresh_enabled === 1,
          cron: row.cookie_refresh_cron,
          autoEnabled: row.cookie_refresh_auto_enabled === 1,
        },
      };
    } catch (error) {
      logger.error('获取调度器配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: SchedulerConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM scheduler_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO scheduler_config (
            comment_cron, comment_random_offset_min, comment_random_offset_max,
            material_processing_interval_minutes, material_processing_enabled,
            cookie_refresh_enabled, cookie_refresh_cron, cookie_refresh_auto_enabled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            config.comment.cron, config.comment.randomOffsetMin, config.comment.randomOffsetMax,
            config.materialProcessing.intervalMinutes, config.materialProcessing.enabled ? 1 : 0,
            config.cookieRefresh.enabled ? 1 : 0, config.cookieRefresh.cron, config.cookieRefresh.autoEnabled ? 1 : 0
          ]
        );
        logger.info('调度器配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE scheduler_config 
           SET comment_cron = ?, comment_random_offset_min = ?, comment_random_offset_max = ?,
               material_processing_interval_minutes = ?, material_processing_enabled = ?,
               cookie_refresh_enabled = ?, cookie_refresh_cron = ?, cookie_refresh_auto_enabled = ?
           WHERE id = ?`,
          [
            config.comment.cron, config.comment.randomOffsetMin, config.comment.randomOffsetMax,
            config.materialProcessing.intervalMinutes, config.materialProcessing.enabled ? 1 : 0,
            config.cookieRefresh.enabled ? 1 : 0, config.cookieRefresh.cron, config.cookieRefresh.autoEnabled ? 1 : 0,
            rows[0].id
          ]
        );
        logger.info('调度器配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存调度器配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: SchedulerConfigStorage | null = null;
export function getSchedulerConfigStorage(): SchedulerConfigStorage {
  if (!instance) instance = new SchedulerConfigStorage();
  return instance;
}
export const schedulerConfigStorage = getSchedulerConfigStorage();
