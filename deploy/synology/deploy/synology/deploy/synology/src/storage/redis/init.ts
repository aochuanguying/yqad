import { getLogger } from '../../utils/logger';
import {
  redisConnectionManager,
  getRedisConfig,
  validateConfig,
  validateEnvironment,
  testRedisConnection,
} from './index';

const logger = getLogger('redis-init');

/**
 * 初始化 Redis 存储系统
 * 
 * 在应用启动时调用，完成以下任务：
 * 1. 验证环境变量
 * 2. 加载 Redis 配置
 * 3. 验证配置
 * 4. 初始化 Redis 连接
 * 5. 测试连接
 */
export async function initializeRedisStorage(): Promise<void> {
  try {
    logger.info('🚀 开始初始化 Redis 存储系统...');

    // 1. 验证环境变量
    validateEnvironment();

    // 2. 加载 Redis 配置
    const config = getRedisConfig();

    // 3. 验证配置
    validateConfig(config);

    // 4. 初始化 Redis 连接
    await redisConnectionManager.initialize(config);

    // 5. 测试连接
    await testRedisConnection();

    logger.info('✅ Redis 存储系统初始化完成');
  } catch (error) {
    logger.error('❌ Redis 存储系统初始化失败:', error);
    logger.warn('应用将继续运行，但将使用内存/文件存储作为降级方案');
    throw error; // 重新抛出错误，让调用者决定是否继续
  }
}

/**
 * 优雅关闭 Redis 连接
 */
export async function shutdownRedisStorage(): Promise<void> {
  try {
    logger.info('正在关闭 Redis 存储系统...');
    await redisConnectionManager.disconnect();
    logger.info('✅ Redis 存储系统已关闭');
  } catch (error) {
    logger.error('Redis 存储系统关闭失败:', error);
  }
}
