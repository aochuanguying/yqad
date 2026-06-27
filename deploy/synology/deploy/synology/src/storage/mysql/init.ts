import { getLogger } from '../../utils/logger';
import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';

const logger = getLogger('mysql-init');

/**
 * 初始化 MySQL 存储（类似 Redis 的初始化方式）
 * 从配置文件读取配置，创建连接池
 */
export async function initializeMySQLStorage(): Promise<void> {
  try {
    logger.info('🚀 开始初始化 MySQL 存储系统...');
    
    const manager = MySQLConnectionManager.getInstance();
    await manager.initialize();
    
    logger.info('✅ MySQL 存储系统初始化完成');
  } catch (error: any) {
    logger.error('❌ MySQL 存储系统初始化失败:', error);
    throw error;
  }
}

/**
 * 获取 MySQL 连接管理器
 */
export function getMySQLStorage() {
  return MySQLConnectionManager.getInstance();
}

/**
 * 优雅关闭 MySQL 连接
 */
export async function disconnectMySQL(): Promise<void> {
  const manager = MySQLConnectionManager.getInstance();
  await manager.shutdown();
}
