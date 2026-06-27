import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getLogger } from './logger';
import { RedisConfig } from './redis-connection-manager';

const logger = getLogger('redis-config-loader');

export interface RedisConfigFile {
  redis: {
    test: RedisConfig;
    production: RedisConfig;
  };
}

/**
 * 加载 Redis 配置文件
 */
export function loadRedisConfigFile(): RedisConfigFile {
  const configPath = path.join(__dirname, '../../config/default.yaml');
  
  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(fileContent) as RedisConfigFile;
    
    if (!config.redis) {
      throw new Error('配置文件中缺少 redis 配置');
    }
    
    return config;
  } catch (error) {
    logger.error('加载 Redis 配置文件失败:', error);
    throw error;
  }
}

/**
 * 验证环境变量
 */
export function validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'test';
  
  logger.info(`当前环境：${nodeEnv}`);
  
  // 验证 REDIS_DB 范围
  if (process.env.REDIS_DB) {
    const db = parseInt(process.env.REDIS_DB, 10);
    if (isNaN(db) || db < 0 || db > 15) {
      throw new Error(`REDIS_DB 必须是 0-15 之间的数字，当前值：${process.env.REDIS_DB}`);
    }
    logger.info(`使用环境变量 REDIS_DB: ${db}`);
  }
}

/**
 * 获取 Redis 配置（支持环境变量覆盖）
 */
export function getRedisConfig(): RedisConfig {
  const nodeEnv = process.env.NODE_ENV || 'test';
  const configFile = loadRedisConfigFile();
  
  // 根据环境选择配置
  let baseConfig: RedisConfig;
  
  if (nodeEnv === 'production') {
    baseConfig = configFile.redis.production;
    logger.info('使用生产环境 Redis 配置');
  } else {
    baseConfig = configFile.redis.test;
    logger.info('使用测试环境 Redis 配置');
  }
  
  // 环境变量覆盖（可选）
  const config: RedisConfig = {
    host: process.env.REDIS_HOST || baseConfig.host,
    port: parseInt(process.env.REDIS_PORT || baseConfig.port.toString(), 10),
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : baseConfig.db,
    keyPrefix: baseConfig.keyPrefix,
  };
  
  logger.info(`Redis 配置：host=${config.host}:${config.port}, db=${config.db}, prefix=${config.keyPrefix}`);
  
  return config;
}

/**
 * 验证配置
 */
export function validateConfig(config: RedisConfig): void {
  if (!config.host) {
    throw new Error('Redis host 不能为空');
  }
  
  if (!config.port || config.port <= 0 || config.port > 65535) {
    throw new Error(`Redis port 必须在 1-65535 范围内，当前值：${config.port}`);
  }
  
  if (config.db < 0 || config.db > 15) {
    throw new Error(`Redis db 必须在 0-15 范围内，当前值：${config.db}`);
  }
  
  if (!config.keyPrefix) {
    throw new Error('Redis keyPrefix 不能为空');
  }
  
  logger.info('✅ Redis 配置验证通过');
}

/**
 * 启动时 Redis 连接测试
 */
export async function testRedisConnection(): Promise<void> {
  const { redisConnectionManager, healthCheck } = await import('./redis-connection-manager');
  
  logger.info('正在测试 Redis 连接...');
  
  try {
    const result = await healthCheck();
    
    if (result.connected) {
      logger.info(`✅ Redis 连接测试成功 (延迟：${result.latencyMs}ms)`);
    } else {
      throw new Error('Redis 连接失败');
    }
  } catch (error) {
    logger.error('❌ Redis 连接测试失败:', error);
    throw error;
  }
}
