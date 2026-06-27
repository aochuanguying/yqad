import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('featured-posting-storage');

export interface FeaturedPostingConfig {
  enabled: boolean;
  minContentChars: number;
  minImages: number;
  maxImages: number;
  recommendedImages: number;
  maxGenerateRetries: number;
  maxImageUploadRetries: number;
}

class FeaturedPostingStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['featured_posting_config']);
      if (rows.length === 0) {
        logger.warn('featured_posting_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('精选发帖配置存储初始化完成');
    } catch (error) {
      logger.error('精选发帖配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS featured_posting_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        min_content_chars INT DEFAULT 250,
        min_images INT DEFAULT 4,
        max_images INT DEFAULT 9,
        max_generate_retries INT DEFAULT 2,
        max_image_upload_retries INT DEFAULT 2,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ featured_posting_config 表创建成功');
    await this.query(`
      INSERT INTO featured_posting_config (enabled, min_content_chars, min_images, max_images, max_generate_retries, max_image_upload_retries)
      SELECT 1, 250, 4, 9, 2, 2 WHERE NOT EXISTS (SELECT 1 FROM featured_posting_config)
    `);
    logger.info('✅ 默认精选发帖配置数据插入成功');
  }

  async getConfig(): Promise<FeaturedPostingConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, min_content_chars, min_images, max_images, recommended_images, max_generate_retries, max_image_upload_retries FROM featured_posting_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        minContentChars: row.min_content_chars,
        minImages: row.min_images,
        maxImages: row.max_images,
        recommendedImages: row.recommended_images || 6,
        maxGenerateRetries: row.max_generate_retries,
        maxImageUploadRetries: row.max_image_upload_retries,
      };
    } catch (error) {
      logger.error('获取精选发帖配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: FeaturedPostingConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM featured_posting_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO featured_posting_config (enabled, min_content_chars, min_images, max_images, max_generate_retries, max_image_upload_retries)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.minContentChars, config.minImages, config.maxImages, config.maxGenerateRetries, config.maxImageUploadRetries]
        );
        logger.info('精选发帖配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE featured_posting_config 
           SET enabled = ?, min_content_chars = ?, min_images = ?, max_images = ?, max_generate_retries = ?, max_image_upload_retries = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.minContentChars, config.minImages, config.maxImages, config.maxGenerateRetries, config.maxImageUploadRetries, rows[0].id]
        );
        logger.info('精选发帖配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存精选发帖配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: FeaturedPostingStorage | null = null;
export function getFeaturedPostingStorage(): FeaturedPostingStorage {
  if (!instance) instance = new FeaturedPostingStorage();
  return instance;
}
export const featuredPostingStorage = getFeaturedPostingStorage();
