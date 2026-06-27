import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('telecom-api-storage');

export interface TelecomApiConfig {
  enabled: boolean;
  alertPhone: string;
}

class TelecomApiStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['telecom_api_config']);
      if (rows.length === 0) {
        logger.warn('telecom_api_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('电信 API 配置存储初始化完成');
    } catch (error) {
      logger.error('电信 API 配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS telecom_api_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        alert_phone VARCHAR(20) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ telecom_api_config 表创建成功');
    await this.query(`
      INSERT INTO telecom_api_config (enabled, alert_phone)
      SELECT 1, '18953272532'
      WHERE NOT EXISTS (SELECT 1 FROM telecom_api_config)
    `);
    logger.info('✅ 默认电信 API 配置数据插入成功');
  }

  async getConfig(): Promise<TelecomApiConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, alert_phone FROM telecom_api_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        alertPhone: row.alert_phone,
      };
    } catch (error) {
      logger.error('获取电信 API 配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: TelecomApiConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM telecom_api_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO telecom_api_config (enabled, alert_phone) VALUES (?, ?)`,
          [config.enabled ? 1 : 0, config.alertPhone]
        );
        logger.info('电信 API 配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE telecom_api_config SET enabled = ?, alert_phone = ? WHERE id = ?`,
          [config.enabled ? 1 : 0, config.alertPhone, rows[0].id]
        );
        logger.info('电信 API 配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存电信 API 配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: TelecomApiStorage | null = null;
export function getTelecomApiStorage(): TelecomApiStorage {
  if (!instance) instance = new TelecomApiStorage();
  return instance;
}
export const telecomApiStorage = getTelecomApiStorage();
