import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('content-limits-storage');

export interface ContentLimitsConfig {
  comment: {
    min: number;
    max: number;
  };
  post: {
    min: number;
    max: number;
  };
}

class ContentLimitsStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['content_limits_config']);
      if (rows.length === 0) {
        logger.warn('content_limits_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('内容限制配置存储初始化完成');
    } catch (error) {
      logger.error('内容限制配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS content_limits_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comment_min INT DEFAULT 5,
        comment_max INT DEFAULT 20,
        post_min INT DEFAULT 100,
        post_max INT DEFAULT 480,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ content_limits_config 表创建成功');
    await this.query(`
      INSERT INTO content_limits_config (comment_min, comment_max, post_min, post_max)
      SELECT 5, 20, 100, 480 WHERE NOT EXISTS (SELECT 1 FROM content_limits_config)
    `);
    logger.info('✅ 默认内容限制配置数据插入成功');
  }

  async getConfig(): Promise<ContentLimitsConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT comment_min, comment_max, post_min, post_max FROM content_limits_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        comment: { min: row.comment_min, max: row.comment_max },
        post: { min: row.post_min, max: row.post_max },
      };
    } catch (error) {
      logger.error('获取内容限制配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: ContentLimitsConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM content_limits_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO content_limits_config (comment_min, comment_max, post_min, post_max) VALUES (?, ?, ?, ?)`,
          [config.comment.min, config.comment.max, config.post.min, config.post.max]
        );
        logger.info('内容限制配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE content_limits_config SET comment_min = ?, comment_max = ?, post_min = ?, post_max = ? WHERE id = ?`,
          [config.comment.min, config.comment.max, config.post.min, config.post.max, rows[0].id]
        );
        logger.info('内容限制配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存内容限制配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: ContentLimitsStorage | null = null;
export function getContentLimitsStorage(): ContentLimitsStorage {
  if (!instance) instance = new ContentLimitsStorage();
  return instance;
}
export const contentLimitsStorage = getContentLimitsStorage();
