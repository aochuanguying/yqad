import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('post-config-storage');

export interface PostConfig {
  enabled: boolean;
  mode?: 'scheduled' | 'api';
  dailyLimit: number;
  avoidRepeatDays: number;
}

/**
 * 发帖配置 MySQL 存储
 */
class PostConfigStorage extends BaseDAO {
  private initialized = false;

  /**
   * 初始化：检查并创建表
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 检查表是否存在
      const rows = await this.query<any[]>('SHOW TABLES LIKE ?', ['post_config']);

      if (rows.length === 0) {
        logger.warn('post_config 表不存在，将自动创建');
        await this.createTable();
      }

      this.initialized = true;
      logger.info('发帖配置存储初始化完成');
    } catch (error) {
      logger.error('发帖配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 创建表
   */
  private async createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS post_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        mode VARCHAR(50) DEFAULT 'mock',
        daily_limit INT DEFAULT 1,
        avoid_repeat_days INT DEFAULT 7,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.query(sql);
    logger.info('✅ post_config 表创建成功');

    // 插入默认数据
    const insertSql = `
      INSERT INTO post_config (enabled, mode, daily_limit, avoid_repeat_days)
      SELECT 1, 'mock', 1, 7
      WHERE NOT EXISTS (SELECT 1 FROM post_config)
    `;
    await this.query(insertSql);
    logger.info('✅ 默认发帖配置数据插入成功');
  }

  /**
   * 获取发帖配置
   */
  async getConfig(): Promise<PostConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, mode, daily_limit, avoid_repeat_days FROM post_config LIMIT 1'
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        mode: row.mode,
        dailyLimit: row.daily_limit,
        avoidRepeatDays: row.avoid_repeat_days,
      };
    } catch (error) {
      logger.error('获取发帖配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 保存发帖配置
   */
  async saveConfig(config: PostConfig): Promise<void> {
    try {
      // 检查是否存在记录
      const rows = await this.query<any[]>('SELECT id FROM post_config LIMIT 1');

      if (rows.length === 0) {
        // 插入新记录
        await this.query(
          `INSERT INTO post_config (enabled, mode, daily_limit, avoid_repeat_days)
           VALUES (?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.mode, config.dailyLimit, config.avoidRepeatDays]
        );
        logger.info('发帖配置已保存（新增）');
      } else {
        // 更新现有记录
        await this.query(
          `UPDATE post_config 
           SET enabled = ?, mode = ?, daily_limit = ?, avoid_repeat_days = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.mode, config.dailyLimit, config.avoidRepeatDays, rows[0].id]
        );
        logger.info('发帖配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存发帖配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// 单例模式
let instance: PostConfigStorage | null = null;

export function getPostConfigStorage(): PostConfigStorage {
  if (!instance) {
    instance = new PostConfigStorage();
  }
  return instance;
}

export const postConfigStorage = getPostConfigStorage();
