import Redis from 'ioredis';
import { getConfig } from '../config/default';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const config = getConfig();
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });
    redis.on('error', (err) => {
      console.warn('[cache] Redis 错误:', err.message);
    });
    redis.connect().catch((err) => {
      console.error('[cache] Redis 连接失败:', err.message);
    });
  }
  return redis;
}

export interface CacheOptions {
  ttl?: number;       // 秒，默认 600（10 分钟）
  noCache?: boolean;  // 跳过缓存
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await getRedis().get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number = 600): Promise<void> {
  try {
    await getRedis().setex(key, ttl, JSON.stringify(value));
  } catch (err: any) {
    console.warn('[cache] 写入缓存失败:', err.message);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch {
    // ignore
  }
}

export function buildCacheKey(platform: string, action: string, params: Record<string, any>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `search:${platform}:${action}:${sorted}`;
}

export async function closeCache(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
