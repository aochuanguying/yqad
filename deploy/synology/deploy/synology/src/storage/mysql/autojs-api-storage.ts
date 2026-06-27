import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('autojs-api-storage');

export interface AutoJsApiConfig {
  enabled: boolean;
  baseUrl: string;
  apiToken: string;
  postScript: string;
}

class AutoJsApiStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['autojs_api_config']);
      if (rows.length === 0) {
        logger.warn('autojs_api_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('AutoJS API 配置存储初始化完成');
    } catch (error) {
      logger.error('AutoJS API 配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS autojs_api_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        base_url VARCHAR(500) DEFAULT NULL,
        api_token VARCHAR(500) DEFAULT NULL,
        post_script VARCHAR(100) DEFAULT 'audi_post.js',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ autojs_api_config 表创建成功');
    await this.query(`
      INSERT INTO autojs_api_config (enabled, base_url, api_token, post_script)
      SELECT 1, 'http://10.6.0.2:8899', 'api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2', 'audi_post.js'
      WHERE NOT EXISTS (SELECT 1 FROM autojs_api_config)
    `);
    logger.info('✅ 默认 AutoJS API 配置数据插入成功');
  }

  async getConfig(): Promise<AutoJsApiConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, base_url, api_token, post_script FROM autojs_api_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        baseUrl: row.base_url,
        apiToken: row.api_token,
        postScript: row.post_script,
      };
    } catch (error) {
      logger.error('获取 AutoJS API 配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: AutoJsApiConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM autojs_api_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO autojs_api_config (enabled, base_url, api_token, post_script) VALUES (?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.baseUrl, config.apiToken, config.postScript]
        );
        logger.info('AutoJS API 配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE autojs_api_config SET enabled = ?, base_url = ?, api_token = ?, post_script = ? WHERE id = ?`,
          [config.enabled ? 1 : 0, config.baseUrl, config.apiToken, config.postScript, rows[0].id]
        );
        logger.info('AutoJS API 配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存 AutoJS API 配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: AutoJsApiStorage | null = null;
export function getAutoJsApiStorage(): AutoJsApiStorage {
  if (!instance) instance = new AutoJsApiStorage();
  return instance;
}
export const autojsApiStorage = getAutoJsApiStorage();
