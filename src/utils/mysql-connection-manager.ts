import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { getLogger } from './logger';
import { loadConfig } from './config';

const logger = getLogger('mysql-connection-manager');

/**
 * MySQL 连接管理器
 * 简化版本 - 直接创建连接池，不复杂的配置
 */

export class MySQLConnectionManager {
  private pool: Pool | null = null;
  private connected: boolean = false;

  private static instance: MySQLConnectionManager | null = null;

  private constructor() {}

  static getInstance(): MySQLConnectionManager {
    if (!MySQLConnectionManager.instance) {
      MySQLConnectionManager.instance = new MySQLConnectionManager();
    }
    return MySQLConnectionManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.connected) {
      logger.info('MySQL 已连接，跳过初始化');
      return;
    }

    try {
      logger.info('正在连接 MySQL 数据库...');
      
      // 从配置文件读取 MySQL 连接信息
      const config = loadConfig();
      const mysqlConfig = (config as any).mysql;
      const env = process.env.NODE_ENV === 'production' ? 'production' : 'test';
      const dbConfig = mysqlConfig?.[env] || mysqlConfig || {};

      const host = dbConfig.host;
      const port = dbConfig.port || 3306;
      const user = dbConfig.user;
      const password = dbConfig.password;
      const database = dbConfig.database;

      if (!host || !user || !password || !database) {
        throw new Error(
          `MySQL 连接信息不完整（环境: ${env}），请在 config/default.yaml 或 config/local.yaml 中配置 mysql.${env} 字段`
        );
      }

      this.pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        connectionLimit: dbConfig.connectionLimit || 5,
        waitForConnections: true,
        connectTimeout: dbConfig.connectTimeout || 10000,
        timezone: '+08:00',
      });

      // 测试连接
      await this.testConnection();
      this.connected = true;
      
      logger.info(`✅ MySQL 数据库连接成功 (${host}:${port}/${database})`);
    } catch (error: any) {
      logger.error(`❌ MySQL 连接失败：${error.message}`);
      this.connected = false;
      this.pool = null;
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.pool) throw new Error('连接池未创建');
    
    const conn = await this.pool.getConnection();
    try {
      await conn.ping();
      logger.debug('MySQL 连接测试成功');
    } finally {
      conn.release();
    }
  }

  async getConnection(): Promise<PoolConnection> {
    if (!this.pool || !this.connected) {
      throw new Error('MySQL 未连接');
    }
    return await this.pool.getConnection();
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    if (!this.pool || !this.connected) {
      throw new Error('MySQL 未连接');
    }
    const [rows] = await this.pool.execute(sql, params);
    return rows as T;
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    if (!this.pool || !this.connected) {
      throw new Error('MySQL 未连接');
    }
    const [result] = await this.pool.execute(sql, params);
    return result;
  }

  async executeInTransaction<T>(callback: (conn: PoolConnection) => Promise<T>): Promise<T> {
    if (!this.pool || !this.connected) {
      throw new Error('MySQL 未连接');
    }
    
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  isHealthy(): boolean {
    return this.connected && !!this.pool;
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      logger.info('MySQL 连接已关闭');
    }
  }
}

// 导出便捷函数
export const getMySQLConnectionManager = MySQLConnectionManager.getInstance;

export const initializeMySQL = async (): Promise<MySQLConnectionManager> => {
  const manager = MySQLConnectionManager.getInstance();
  await manager.initialize();
  return manager;
};

export const getMySQLIfExists = (): MySQLConnectionManager | null => {
  // 私有属性无法访问，直接返回 null
  // 实际上这个方法不需要了，因为都用 getInstance
  return null;
};

export default MySQLConnectionManager;
