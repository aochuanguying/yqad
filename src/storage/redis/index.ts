/**
 * Redis 存储层索引
 * 
 * 提供统一的 Redis 存储接口，包括：
 * - 主题可用次数存储
 * - 敏感词库存储
 * - API Token 存储
 * - 任务缓存存储
 */

export {
  // Redis 连接管理
  RedisConnectionManager,
  redisConnectionManager,
  getRedisClient,
  healthCheck,
  disconnectRedis,
  formatKey,
  RedisConfig,
  HealthCheckResult,
} from '../../utils/redis-connection-manager';

export {
  // Redis 配置加载
  loadRedisConfigFile,
  getRedisConfig,
  validateConfig,
  validateEnvironment,
  testRedisConnection,
} from '../../utils/redis-config-loader';

export {
  // 主题可用次数存储
  TopicUsesStorage,
  topicUsesStorage,
} from './topic-uses-storage';

export {
  // 敏感词库存储
  SensitiveWordsStorage,
  sensitiveWordsStorage,
} from './sensitive-words-storage';

export {
  // API Token 存储
  ApiTokenStorage,
  apiTokenStorage,
  TokenOptions,
} from './api-token-storage';

export {
  // 登录 Token 存储
  AuthTokenStorage,
  authTokenStorage,
} from './auth-token-storage';

export {
  // 任务缓存存储
  TaskCacheStorage,
  taskCacheStorage,
} from './task-cache-storage';

export {
  // 车辆 Token 存储
  VehicleTokenStorage,
  getVehicleTokenStorage,
} from './vehicle-token-storage';

export {
  // 图片缓存存储
  ImageCacheStorage,
  getImageCacheStorage,
  type ImageCacheData,
} from './image-cache-storage';

export {
  // 互联网参考配置缓存
  InternetReferenceCache,
  internetReferenceCache,
  type CacheStatistics,
} from './internet-reference-cache';
