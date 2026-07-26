import { MySQLConnectionManager } from './mysql-connection-manager';

/**
 * 获取 MySQL 数据库实例
 * @returns MySQLConnectionManager 实例
 */
export function getDatabase() {
  return MySQLConnectionManager.getInstance();
}
