import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('comment-config-storage');

export interface CommentConfig {
  enabled: boolean;
  dailyLimit: number;
  delayMin: number;
  delayMax: number;
  maxFetchPages: number;
}

/**
 * 评论配置 MySQL 存储
 */
class CommentConfigStorage extends BaseDAO {
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
      const rows = await this.query<any[]>('SHOW TABLES LIKE ?', ['comment_config']);

      if (rows.length === 0) {
        logger.warn('comment_config 表不存在，将自动创建');
        await this.createTable();
      }

      this.initialized = true;
      logger.info('评论配置存储初始化完成');
    } catch (error) {
      logger.error('评论配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 创建表
   */
  private async createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS comment_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 0,
        daily_limit INT DEFAULT 3,
        delay_min INT DEFAULT 60,
        delay_max INT DEFAULT 180,
        max_fetch_pages INT DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.query(sql);
    logger.info('✅ comment_config 表创建成功');

    // 插入默认数据
    const insertSql = `
      INSERT INTO comment_config (enabled, daily_limit, delay_min, delay_max, max_fetch_pages)
      SELECT 0, 3, 60, 180, 5
      WHERE NOT EXISTS (SELECT 1 FROM comment_config)
    `;
    await this.query(insertSql);
    logger.info('✅ 默认评论配置数据插入成功');
  }

  /**
   * 获取评论配置
   */
  async getConfig(): Promise<CommentConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, daily_limit, delay_min, delay_max, max_fetch_pages FROM comment_config LIMIT 1'
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        dailyLimit: row.daily_limit,
        delayMin: row.delay_min,
        delayMax: row.delay_max,
        maxFetchPages: row.max_fetch_pages,
      };
    } catch (error) {
      logger.error('获取评论配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 保存评论配置
   */
  async saveConfig(config: CommentConfig): Promise<void> {
    try {
      // 检查是否存在记录
      const rows = await this.query<any[]>('SELECT id FROM comment_config LIMIT 1');

      if (rows.length === 0) {
        // 插入新记录
        await this.query(
          `INSERT INTO comment_config (enabled, daily_limit, delay_min, delay_max, max_fetch_pages)
           VALUES (?, ?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.dailyLimit, config.delayMin, config.delayMax, config.maxFetchPages]
        );
        logger.info('评论配置已保存（新增）');
      } else {
        // 更新现有记录
        await this.query(
          `UPDATE comment_config 
           SET enabled = ?, daily_limit = ?, delay_min = ?, delay_max = ?, max_fetch_pages = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.dailyLimit, config.delayMin, config.delayMax, config.maxFetchPages, rows[0].id]
        );
        logger.info('评论配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存评论配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// 单例模式
let instance: CommentConfigStorage | null = null;

export function getCommentConfigStorage(): CommentConfigStorage {
  if (!instance) {
    instance = new CommentConfigStorage();
  }
  return instance;
}

export const commentConfigStorage = getCommentConfigStorage();
