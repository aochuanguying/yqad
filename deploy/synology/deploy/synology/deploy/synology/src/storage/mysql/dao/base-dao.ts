import { Connection, Pool } from 'mysql2/promise';
import { getMySQLConnectionManager } from '../../../utils/mysql-connection-manager';

/**
 * DAO 基类
 * 提供通用的 CRUD 操作和数据库访问辅助方法
 */
export abstract class BaseDAO {
  protected pool: Pool;

  constructor() {
    const manager = getMySQLConnectionManager();
    this.pool = (manager as any).pool || null;
  }

  protected async getPool(): Promise<Pool> {
    if (!this.pool) {
      const manager = getMySQLConnectionManager();
      if (!manager.isHealthy()) {
        throw new Error('MySQL 未连接');
      }
      this.pool = (manager as any).pool;
    }
    return this.pool!;
  }

  /**
   * 执行 SQL 查询
   */
  protected async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const pool = await this.getPool();
    try {
      const p = params || [];
      // 使用 query 而不是 execute，避免参数类型问题
      const [rows] = await pool.query(sql, p);
      return rows as T;
    } catch (error: any) {
      console.error('[DAO query] SQL 执行失败:', error.message);
      console.error('[DAO query] SQL:', sql);
      console.error('[DAO query] 参数:', params);
      throw error;
    }
  }

  /**
   * 执行事务
   */
  protected async executeInTransaction<T>(
    callback: (connection: Connection) => Promise<T>
  ): Promise<T> {
    const pool = await this.getPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 插入记录并返回插入 ID
   */
  protected async insert(sql: string, params?: any[]): Promise<string> {
    const pool = await this.getPool();
    const [result] = await pool.query(sql, params);
    const insertResult: any = result;
    return insertResult.insertId?.toString() || null;
  }

  /**
   * 更新记录
   */
  protected async update(sql: string, params?: any[]): Promise<number> {
    const pool = await this.getPool();
    const [result]: any = await pool.query(sql, params);
    return result.affectedRows || 0;
  }

  /**
   * 删除记录
   */
  protected async delete(sql: string, params?: any[]): Promise<number> {
    const pool = await this.getPool();
    const [result]: any = await pool.query(sql, params);
    return result.affectedRows || 0;
  }

  /**
   * 查询单条记录
   */
  protected async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T[]>(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  /**
   * 查询多条记录
   */
  protected async queryMany<T = any>(sql: string, params?: any[], limit?: number): Promise<T[]> {
    let querySql = sql;
    if (limit) {
      querySql = `${sql} LIMIT ?`;
      const newParams = params ? [...params, limit] : [limit];
      return await this.query<T[]>(querySql, newParams);
    }
    return await this.query<T[]>(querySql, params);
  }

  /**
   * 分页查询
   */
  protected async queryPaginated<T = any>(
    sql: string,
    params: any[],
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // 确保 page 和 pageSize 是整数
    const pageNum = Math.max(1, Math.floor(Number(page) || 1));
    const pageSizeNum = Math.max(1, Math.floor(Number(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;
    
    // 调试日志
    console.log('[DAO 分页查询] SQL:', sql);
    console.log('[DAO 分页查询] 原始 params:', params);
    console.log('[DAO 分页查询] page:', page, '=>', pageNum);
    console.log('[DAO 分页查询] pageSize:', pageSize, '=>', pageSizeNum);
    console.log('[DAO 分页查询] offset:', offset);
    console.log('[DAO 分页查询] 最终 paginatedParams:', [...params, pageSizeNum, offset]);
    
    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as count_table`;
    const countResult = await this.queryOne<{ total: number }>(countSql, params);
    const total = countResult?.total || 0;

    // 查询数据
    const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
    // 确保参数是整数，mysql2 需要整数类型
    const limitParam = parseInt(pageSizeNum.toString(), 10);
    const offsetParam = parseInt(offset.toString(), 10);
    const paginatedParams = [...params, limitParam, offsetParam];
    console.log('[DAO 分页查询] 最终 paginatedParams:', paginatedParams, '类型:', paginatedParams.map(v => typeof v));
    const data = await this.query<T[]>(paginatedSql, paginatedParams);

    return {
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    };
  }

  /**
   * 构建 WHERE 子句
   */
  protected buildWhereClause(
    conditions: { column: string; operator: string; value: any }[],
    logic: 'AND' | 'OR' = 'AND'
  ): { whereClause: string; params: any[] } {
    if (!conditions || conditions.length === 0) {
      return { whereClause: '', params: [] };
    }

    const whereParts: string[] = [];
    const params: any[] = [];

    for (const condition of conditions) {
      whereParts.push(`${condition.column} ${condition.operator} ?`);
      params.push(condition.value);
    }

    const whereClause = `WHERE ${whereParts.join(` ${logic} `)}`;
    return { whereClause, params };
  }

  /**
   * 构建 ORDER BY 子句
   */
  protected buildOrderByClause(
    orderBy: { column: string; direction: 'ASC' | 'DESC' }[]
  ): string {
    if (!orderBy || orderBy.length === 0) {
      return '';
    }

    const orderParts = orderBy.map(
      (item) => `${item.column} ${item.direction}`
    );
    return `ORDER BY ${orderParts.join(', ')}`;
  }
}
