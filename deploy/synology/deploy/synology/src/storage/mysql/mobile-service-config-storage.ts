import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('mobile-service-config-storage');

export interface MobileServiceConfig {
  apiUrl: string;
  apiToken: string;
}

class MobileServiceConfigStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['mobile_service_config']);
      if (rows.length === 0) {
        logger.warn('mobile_service_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('手机服务配置存储初始化完成');
    } catch (error) {
      logger.error('手机服务配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS mobile_service_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        api_url VARCHAR(500) DEFAULT NULL,
        api_token VARCHAR(500) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ mobile_service_config 表创建成功');
    // 插入默认空配置
    await this.query(`
      INSERT INTO mobile_service_config (api_url, api_token)
      SELECT NULL, NULL
      WHERE NOT EXISTS (SELECT 1 FROM mobile_service_config)
    `);
    logger.info('✅ 默认手机服务配置数据插入成功');
  }

  async getConfig(): Promise<MobileServiceConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT api_url, api_token FROM mobile_service_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        apiUrl: row.api_url || '',
        apiToken: row.api_token || '',
      };
    } catch (error) {
      logger.error('获取手机服务配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: MobileServiceConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM mobile_service_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO mobile_service_config (api_url, api_token) VALUES (?, ?)`,
          [config.apiUrl, config.apiToken]
        );
        logger.info('手机服务配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE mobile_service_config SET api_url = ?, api_token = ? WHERE id = ?`,
          [config.apiUrl, config.apiToken, rows[0].id]
        );
        logger.info('手机服务配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存手机服务配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: MobileServiceConfigStorage | null = null;
export function getMobileServiceConfigStorage(): MobileServiceConfigStorage {
  if (!instance) instance = new MobileServiceConfigStorage();
  return instance;
}
export const mobileServiceConfigStorage = getMobileServiceConfigStorage();
