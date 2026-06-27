import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('missed-call-storage');

export interface MissedCallRecord {
  id?: number;
  phoneNumber: string;
  receivedAt: Date;
  createdAt?: Date;
}

class MissedCallStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['missed_calls']);
      if (rows.length === 0) {
        logger.warn('missed_calls 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('未接电话记录存储初始化完成');
    } catch (error) {
      logger.error('未接电话记录存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS missed_calls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone_number VARCHAR(50) NOT NULL COMMENT '电话号码',
        received_at DATETIME NOT NULL COMMENT '接收时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
        INDEX idx_phone_number (phone_number),
        INDEX idx_received_at (received_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='未接电话记录表'
    `);
    logger.info('✅ missed_calls 表创建成功');
  }

  async addMissedCall(record: MissedCallRecord): Promise<number> {
    try {
      const result = await this.query<any>(
        `INSERT INTO missed_calls (phone_number, received_at) VALUES (?, ?)`,
        [record.phoneNumber, record.receivedAt]
      );
      
      const insertId = result.insertId;
      logger.info(`未接电话记录已添加，ID: ${insertId}`);
      
      // 清理超过 100 条的旧记录（按接收时间排序，保留最新的 100 条）
      await this.cleanupOldRecords();
      
      return insertId;
    } catch (error) {
      logger.error('添加未接电话记录失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async cleanupOldRecords(): Promise<void> {
    try {
      // 删除超过 100 条的旧记录，保留最新的 100 条（按 received_at 降序排序）
      await this.query(`
        DELETE FROM missed_calls 
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id FROM missed_calls 
            ORDER BY received_at DESC 
            LIMIT 100
          ) AS recent_records
        )
      `);
      logger.info('已清理超过 100 条的旧未接电话记录');
    } catch (error) {
      logger.error('清理旧未接电话记录失败:', error instanceof Error ? error.message : String(error));
      // 清理失败不影响主流程，仅记录日志
    }
  }

  async getMissedCallsList(options?: {
    phoneNumber?: string;
    limit?: number;
    offset?: number;
  }): Promise<MissedCallRecord[]> {
    try {
      let sql = 'SELECT id, phone_number, received_at, created_at FROM missed_calls';
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
        receivedAt: row.received_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('查询未接电话记录失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getMissedCallsCount(phoneNumber?: string): Promise<number> {
    try {
      let sql = 'SELECT COUNT(*) as count FROM missed_calls';
      const params: any[] = [];

      if (phoneNumber) {
        sql += ' WHERE phone_number = ?';
        params.push(phoneNumber);
      }

      const rows = await this.query<any[]>(sql, params);
      return rows[0]?.count ?? 0;
    } catch (error) {
      logger.error('查询未接电话记录数量失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: MissedCallStorage | null = null;
export function getMissedCallStorage(): MissedCallStorage {
  if (!instance) instance = new MissedCallStorage();
  return instance;
}
export const missedCallStorage = getMissedCallStorage();
