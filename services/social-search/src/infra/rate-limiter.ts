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
        if (times > 5) return null; // 停止重连
        return Math.min(times * 500, 3000);
      },
    });
    redis.on('error', (err) => {
      console.warn('[rate-limiter] Redis 错误:', err.message);
    });
    redis.connect().catch(() => {});
  }
  return redis;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // 秒
}

/**
 * 滑动窗口频率限制器
 * @param key 限流键（如 platform:zhihu 或 apikey:xxx）
 * @param maxRequests 窗口内最大请求数
 * @param windowMs 窗口时长（毫秒）
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  try {
    const r = getRedis();
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    // 移除窗口外的记录
    await r.zremrangebyscore(redisKey, 0, windowStart);

    // 获取当前窗口内的请求数
    const count = await r.zcard(redisKey);

    if (count >= maxRequests) {
      // 获取最早的请求时间，计算需要等待多久
      const oldest = await r.zrange(redisKey, 0, 0, 'WITHSCORES');
      const retryAfter = oldest.length >= 2
        ? Math.ceil((parseInt(oldest[1]) + windowMs - now) / 1000)
        : Math.ceil(windowMs / 1000);

      return { allowed: false, remaining: 0, retryAfter };
    }

    // 记录本次请求
    await r.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);
    await r.expire(redisKey, Math.ceil(windowMs / 1000));

    return { allowed: true, remaining: maxRequests - count - 1 };
  } catch {
    // Redis 不可用时降级放行
    return { allowed: true, remaining: 999 };
  }
}

/**
 * 请求间隔随机化（模拟人类行为）
 */
export function randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}
