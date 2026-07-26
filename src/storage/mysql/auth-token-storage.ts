import { getDatabase } from '../../utils/database';
import { getLogger } from '../../utils/logger';

const logger = getLogger('auth-token-db');

export interface AuthTokenRecord {
  id?: number;
  access_token: string;
  expires_at: Date;
  refreshed_at?: Date;
  refresh_source: 'telecom_api' | 'web_ui' | 'response_header';
}

/**
 * 登录 Token 数据库存储
 * 
 * 作为 Redis 存储的补充，提供持久化备份
 * - Redis 为主存储（快速访问）
 * - 数据库为备份存储（持久化）
 */
export class AuthTokenDatabaseStorage {
  private static instance: AuthTokenDatabaseStorage;
  
  private constructor() {}
  
  static getInstance(): AuthTokenDatabaseStorage {
    if (!AuthTokenDatabaseStorage.instance) {
      AuthTokenDatabaseStorage.instance = new AuthTokenDatabaseStorage();
    }
    return AuthTokenDatabaseStorage.instance;
  }

  /**
   * 保存 Token 到数据库
   * @param token Token 数据
   * @returns 是否保存成功
   */
  async saveToken(token: AuthTokenRecord): Promise<boolean> {
    try {
      const db = getDatabase();
      
      // 检查是否已有记录
      const existing = await this.getToken();
      
      if (existing) {
        // 更新现有记录
        const updateSql = `
          UPDATE auth_tokens 
          SET access_token = ?, 
              expires_at = ?, 
              refreshed_at = ?,
              refresh_source = ?
          WHERE id = ?
        `;
        
        await db.execute(updateSql, [
          token.access_token,
          token.expires_at,
          token.refreshed_at || new Date(),
          token.refresh_source,
          existing.id
        ]);
        
        logger.debug(`Token 已更新到数据库 (ID: ${existing.id})`);
      } else {
        // 插入新记录
        const insertSql = `
          INSERT INTO auth_tokens 
          (access_token, expires_at, refreshed_at, refresh_source)
          VALUES (?, ?, ?, ?)
        `;
        
        await db.execute(insertSql, [
          token.access_token,
          token.expires_at,
          new Date(),
          token.refresh_source
        ]);
        
        logger.debug('Token 已插入到数据库');
      }
      
      return true;
    } catch (error: any) {
      logger.error(`保存 Token 到数据库失败：${error.message}`);
      return false;
    }
  }

  /**
   * 从数据库获取 Token
   * @returns Token 记录，不存在时返回 null
   */
  async getToken(): Promise<AuthTokenRecord | null> {
    try {
      const db = getDatabase();
      const selectSql = `
        SELECT id, access_token, expires_at, refreshed_at, refresh_source
        FROM auth_tokens
        ORDER BY refreshed_at DESC
        LIMIT 1
      `;
      
      const result: any = await db.execute(selectSql);
      
      // mysql2 的 execute() 返回格式是 [rows]，但可能是对象数组
      // 如果 result 本身是数组且有元素，直接取第一个
      // 如果 result[0] 是对象，说明是单行结果
      let row: any = null;
      
      if (Array.isArray(result) && result.length > 0) {
        if (Array.isArray(result[0])) {
          // 嵌套数组 [[row1, row2]]
          row = result[0][0];
        } else if (typeof result[0] === 'object') {
          // 单行 [row1]
          row = result[0];
        }
      }
      
      if (row) {
        return {
          id: row.id,
          access_token: row.access_token,
          expires_at: new Date(row.expires_at),
          refreshed_at: new Date(row.refreshed_at),
          refresh_source: row.refresh_source,
        };
      }
      
      return null;
    } catch (error: any) {
      logger.error(`从数据库获取 Token 失败：${error.message}`);
      return null;
    }
  }

  /**
   * 删除数据库中的 Token
   * @returns 是否删除成功
   */
  async deleteToken(): Promise<boolean> {
    try {
      const db = getDatabase();
      const deleteSql = 'DELETE FROM auth_tokens';
      await db.execute(deleteSql);
      logger.debug('Token 已从数据库删除');
      return true;
    } catch (error: any) {
      logger.error(`删除数据库 Token 失败：${error.message}`);
      return false;
    }
  }

  /**
   * 检查数据库中是否有 Token
   * @returns 是否有 Token
   */
  async hasToken(): Promise<boolean> {
    try {
      const db = getDatabase();
      const selectSql = 'SELECT COUNT(*) as count FROM auth_tokens';
      const [rows]: any[] = await db.execute(selectSql);
      return rows && rows[0] && rows[0].count > 0;
    } catch (error: any) {
      logger.error(`检查数据库 Token 失败：${error.message}`);
      return false;
    }
  }
}

export const authTokenDatabaseStorage = AuthTokenDatabaseStorage.getInstance();
