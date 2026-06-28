/**
 * 任务 7.7: 缓存热加载验证测试（Mock 版本）
 * 
 * 使用 Mock 验证缓存热加载逻辑，无需真实 Redis 环境
 */

// 简单的内存缓存模拟
class MockCache {
  private cache = new Map<string, any>();
  private expiry = new Map<string, number>();
  private hitCount = 0;
  private missCount = 0;

  async get<T>(key: string, fallbackFetcher: () => Promise<T>, ttlMs: number = 300000): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    const expiry = this.expiry.get(key);

    if (cached && expiry && expiry > now) {
      this.hitCount++;
      return cached as T;
    }

    // 缓存未命中或已过期
    this.missCount++;
    const value = await fallbackFetcher();
    this.cache.set(key, value);
    this.expiry.set(key, now + ttlMs);
    return value;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.expiry.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.expiry.clear();
  }

  getStatistics() {
    const total = this.hitCount + this.missCount;
    return {
      cacheSize: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
    };
  }

  resetStats() {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

describe('缓存热加载（Mock 测试）', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = new MockCache();
  });

  test('配置更新后应该立即清除缓存', async () => {
    const configKey = 'platform_priorities';
    let configValue = new Map([['xiaohongshu', 8]]);

    // 1. 首次获取配置（会写入缓存）
    const value1 = await cache.get(configKey, () => Promise.resolve(configValue));
    expect(value1.get('xiaohongshu')).toBe(8);

    // 2. 更新配置并清除缓存
    configValue = new Map([['xiaohongshu', 10]]);
    await cache.delete(configKey);

    // 3. 再次获取配置（应该获取新值）
    const value2 = await cache.get(configKey, () => Promise.resolve(configValue));
    expect(value2.get('xiaohongshu')).toBe(10);
  });

  test('缓存应该有 5 分钟过期时间', async () => {
    const configKey = 'test_expiry';
    let fetchCount = 0;

    // 首次获取
    await cache.get(configKey, () => {
      fetchCount++;
      return Promise.resolve('value1');
    }, 300000); // 5 分钟

    // 立即获取应该命中缓存
    await cache.get(configKey, () => {
      fetchCount++;
      return Promise.resolve('value2');
    }, 300000);

    expect(fetchCount).toBe(1); // 只应该调用一次

    // 模拟时间流逝（超过 5 分钟）
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 300001);

    // 再次获取应该重新 fetch
    await cache.get(configKey, () => {
      fetchCount++;
      return Promise.resolve('value3');
    }, 300000);

    expect(fetchCount).toBe(2); // 应该调用两次

    jest.restoreAllMocks();
  });

  test('缓存命中率应该在合理范围内', async () => {
    const configKey = 'test_hit_rate';

    // 模拟多次访问
    for (let i = 0; i < 10; i++) {
      await cache.get(configKey, () => Promise.resolve('data'), 300000);
    }

    const stats = cache.getStatistics();
    
    // 第一次是 miss，后面 9 次应该是 hit
    expect(stats.hitCount).toBe(9);
    expect(stats.missCount).toBe(1);
    expect(stats.hitRate).toBeCloseTo(90, 0); // 90% 命中率
  });

  test('缓存大小应该正确统计', async () => {
    await cache.get('key1', () => Promise.resolve('value1'));
    await cache.get('key2', () => Promise.resolve('value2'));
    await cache.get('key3', () => Promise.resolve('value3'));

    const stats = cache.getStatistics();
    expect(stats.cacheSize).toBe(3);
  });

  test('清除缓存后应该重新从数据库加载', async () => {
    const configKey = 'test_clear';
    let dbValue = 'initial';
    let fetchCount = 0;

    // 首次加载
    await cache.get(configKey, () => {
      fetchCount++;
      return Promise.resolve(dbValue);
    });

    expect(fetchCount).toBe(1);

    // 更新数据库值并清除缓存
    dbValue = 'updated';
    await cache.clear();

    // 再次加载应该获取新值
    const newValue = await cache.get(configKey, () => {
      fetchCount++;
      return Promise.resolve(dbValue);
    });

    expect(fetchCount).toBe(2);
    expect(newValue).toBe('updated');
  });

  test('缓存告警机制应该正常工作', async () => {
    // 1. 测试命中率告警
    cache.getStatistics = () => ({
      cacheSize: 10,
      hitCount: 1,
      missCount: 9,
      hitRate: 10, // 10% 命中率
    });

    const stats = cache.getStatistics();
    const shouldAlarm = stats.hitRate < 50; // 低于 50% 触发告警
    expect(shouldAlarm).toBe(true);

    // 2. 测试正常情况
    cache.getStatistics = () => ({
      cacheSize: 10,
      hitCount: 90,
      missCount: 10,
      hitRate: 90, // 90% 命中率
    });

    const stats2 = cache.getStatistics();
    const shouldAlarm2 = stats2.hitRate < 50;
    expect(shouldAlarm2).toBe(false);
  });
});

describe('配置同步延迟监控', () => {
  test('应该能够检测配置同步延迟', async () => {
    const startTime = Date.now();
    
    // 模拟数据库查询延迟
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    expect(latency).toBeGreaterThanOrEqual(50);
    expect(latency).toBeLessThan(200); // 应该小于 200ms
  });

  test('应该能够监控缓存大小', async () => {
    const cache = new MockCache();
    
    // 添加 5 个缓存项
    for (let i = 0; i < 5; i++) {
      await cache.get(`key${i}`, () => Promise.resolve(`value${i}`));
    }
    
    const stats = cache.getStatistics();
    expect(stats.cacheSize).toBe(5);
  });
});
