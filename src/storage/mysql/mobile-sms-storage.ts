import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('mobile-sms-storage');

export interface MobileSmsRecord {
  id?: number;
  phoneNumber: string;
  content: string;
  receivedAt: Date;
  createdAt?: Date;
}

class MobileSmsStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['mobile_sms']);
      if (rows.length === 0) {
        logger.warn('mobile_sms 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('手机短信记录存储初始化完成');
    } catch (error) {
      logger.error('手机短信记录存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS mobile_sms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone_number VARCHAR(50) NOT NULL COMMENT '电话号码',
        content TEXT NOT NULL COMMENT '短信内容',
        received_at DATETIME NOT NULL COMMENT '接收时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
        INDEX idx_phone_number (phone_number),
        INDEX idx_received_at (received_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='手机短信记录表'
    `);
    logger.info('✅ mobile_sms 表创建成功');
  }

  async addSms(record: MobileSmsRecord): Promise<number> {
    try {
      const result = await this.query<any>(
        `INSERT INTO mobile_sms (phone_number, content, received_at) VALUES (?, ?, ?)`,
        [record.phoneNumber, record.content, record.receivedAt]
      );
      logger.info(`短信记录已添加，ID: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error('添加短信记录失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSmsList(options?: {
    phoneNumber?: string;
    limit?: number;
    offset?: number;
  }): Promise<MobileSmsRecord[]> {
    try {
      let sql = 'SELECT id, phone_number, content, received_at, created_at FROM mobile_sms';
      const params: any[] = [];

      if (options?.phoneNumber) {
        sql += ' WHERE phone_number = ?';
        params.push(options.phoneNumber);
      }

      sql += ' ORDER BY received_at DESC';

      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = await this.query<any[]>(sql, params);
      return rows.map((row: any) => ({
        id: row.id,
        phoneNumber: row.phone_number,
        content: row.content,
        receivedAt: row.received_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('查询短信记录失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSmsCount(phoneNumber?: string): Promise<number> {
    try {
      let sql = 'SELECT COUNT(*) as count FROM mobile_sms';
      const params: any[] = [];

      if (phoneNumber) {
        sql += ' WHERE phone_number = ?';
        params.push(phoneNumber);
      }

      const rows = await this.query<any[]>(sql, params);
      return rows[0]?.count ?? 0;
    } catch (error) {
      logger.error('查询短信记录数量失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: MobileSmsStorage | null = null;
export function getMobileSmsStorage(): MobileSmsStorage {
  if (!instance) instance = new MobileSmsStorage();
  return instance;
}
export const mobileSmsStorage = getMobileSmsStorage();
