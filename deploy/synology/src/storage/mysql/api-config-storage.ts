import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('api-config-storage');

export interface ApiConfig {
  mode: 'mock' | 'real';
  baseUrl: string;
  timeout: number;
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
        mode VARCHAR(50) NOT NULL DEFAULT 'mock',
        base_url VARCHAR(500) NOT NULL,
        timeout INT DEFAULT 10000,
        device_id VARCHAR(200) DEFAULT NULL,
        nick_name VARCHAR(100) DEFAULT NULL,
        ip_region VARCHAR(100) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.query(sql);
    logger.info('✅ api_config 表创建成功');

    // 插入默认数据
    const insertSql = `
      INSERT INTO api_config (mode, base_url, timeout, device_id, nick_name, ip_region)
      SELECT 'real', 'https://audi2c.faw-vw.com', 10000, 
             'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1',
             '王大锤', '山东省'
      WHERE NOT EXISTS (SELECT 1 FROM api_config)
    `;
    await this.query(insertSql);
    logger.info('✅ 默认 API 配置数据插入成功');
  }

  /**
   * 获取 API 配置
   */
  async getConfig(): Promise<ApiConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT mode, base_url, timeout, device_id, nick_name, ip_region FROM api_config LIMIT 1'
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        mode: row.mode,
        baseUrl: row.base_url,
        timeout: row.timeout,
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
          `INSERT INTO api_config (mode, base_url, timeout, device_id, nick_name, ip_region)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [config.mode, config.baseUrl, config.timeout, config.deviceId, config.nickName, config.ipRegion]
        );
        logger.info('API 配置已保存（新增）');
      } else {
        // 更新现有记录
        await this.query(
          `UPDATE api_config 
           SET mode = ?, base_url = ?, timeout = ?, device_id = ?, nick_name = ?, ip_region = ?
           WHERE id = ?`,
          [config.mode, config.baseUrl, config.timeout, config.deviceId, config.nickName, config.ipRegion, rows[0].id]
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
