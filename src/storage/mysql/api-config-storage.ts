import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('api-config-storage');

export interface ApiConfig {
  deviceId?: string;
  nickName?: string;
  ipRegion?: string;
}

/**
 * API 配置 MySQL 存储
 */
class APIConfigStorage extends BaseDAO {
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
      const rows = await this.query<any[]>('SHOW TABLES LIKE ?', ['api_config']);

      if (rows.length === 0) {
        logger.warn('api_config 表不存在，将自动创建');
        await this.createTable();
      }

      this.initialized = true;
      logger.info('API 配置存储初始化完成');
    } catch (error) {
      logger.error('API 配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 创建表
   */
  private async createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS api_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(200) DEFAULT NULL,
        nick_name VARCHAR(100) DEFAULT NULL,
        ip_region VARCHAR(100) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.query(sql);
    logger.info('✅ api_config 表创建成功');
  }

  /**
   * 获取 API 配置
   */
  async getConfig(): Promise<ApiConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT device_id, nick_name, ip_region FROM api_config LIMIT 1'
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        deviceId: row.device_id,
        nickName: row.nick_name,
        ipRegion: row.ip_region,
      };
    } catch (error) {
      logger.error('获取 API 配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 保存 API 配置
   */
  async saveConfig(config: ApiConfig): Promise<void> {
    try {
      // 检查是否存在记录
      const rows = await this.query<any[]>('SELECT id FROM api_config LIMIT 1');

      if (rows.length === 0) {
        // 插入新记录
        await this.query(
          `INSERT INTO api_config (device_id, nick_name, ip_region)
           VALUES (?, ?, ?)`,
          [config.deviceId, config.nickName, config.ipRegion]
        );
        logger.info('API 配置已保存（新增）');
      } else {
        // 更新现有记录
        await this.query(
          `UPDATE api_config 
           SET device_id = ?, nick_name = ?, ip_region = ?
           WHERE id = ?`,
          [config.deviceId, config.nickName, config.ipRegion, rows[0].id]
        );
        logger.info('API 配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存 API 配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// 单例模式
let instance: APIConfigStorage | null = null;

export function getAPIConfigStorage(): APIConfigStorage {
  if (!instance) {
    instance = new APIConfigStorage();
  }
  return instance;
}

export const apiConfigStorage = getAPIConfigStorage();
