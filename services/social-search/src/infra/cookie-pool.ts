import { cookieConfigStorage } from './cookie-config-storage';

export interface CookieRecord {
  id: number;
  platform: string;
  cookie: string;
  weight: number;
  lastUsedAt: number; // timestamp
  useCount: number;
}

/**
 * Cookie 池管理（v2）
 * - 从 cookie_configs 表多记录加载
 * - 加权均衡选择：score = weight / (minutesSinceLastUse + 1)
 * - 失效标记自动降级
 * - 每 5 分钟自动刷新
 */
export class CookiePool {
  private pools: Map<string, CookieRecord[]> = new Map();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {
    await this.refresh();
    this.refreshInterval = setInterval(() => this.refresh(), 5 * 60 * 1000);
    console.log('[cookie-pool] Cookie 池已初始化（v2: 多配置 + 加权均衡）');
  }

  async refresh(): Promise<void> {
    try {
      const records = await cookieConfigStorage.getAllEnabledForPool();
      this.pools.clear();

      for (const row of records) {
        const platform = row.platform.toLowerCase();
        if (!this.pools.has(platform)) {
          this.pools.set(platform, []);
        }
        this.pools.get(platform)!.push({
          id: row.id,
          platform,
          cookie: row.cookie,
          weight: row.weight,
          lastUsedAt: row.lastUsedAt ? row.lastUsedAt.getTime() : 0,
          useCount: row.useCount || 0,
        });
      }

      const platforms = [...this.pools.keys()];
      const counts = platforms.map(p => `${p}:${this.pools.get(p)!.length}`);
      console.log(`[cookie-pool] 刷新完成: ${counts.join(', ') || '空'}`);
    } catch (err: any) {
      console.error('[cookie-pool] 刷新失败:', err.message);
    }
  }

  /**
   * 获取指定平台的 Cookie
   * 策略：weighted_score = weight / (minutes_since_last_use + 1)
   * - 权重越高越优先
   * - 越久没用越优先（反爬：避免同一账号频繁使用）
   */
  get(platform: string): string | null {
    const pool = this.pools.get(platform.toLowerCase());
    if (!pool || pool.length === 0) return null;

    const now = Date.now();
    let bestRecord: CookieRecord | null = null;
    let bestScore = -1;

    for (const record of pool) {
      const minutesSinceLastUse = record.lastUsedAt === 0
        ? 9999 // 从未用过的记录获得极高优先级
        : (now - record.lastUsedAt) / 60000;
      const score = record.weight / (minutesSinceLastUse + 1);

      if (score > bestScore) {
        bestScore = score;
        bestRecord = record;
      }
    }

    if (!bestRecord) return null;

    bestRecord.lastUsedAt = now;
    bestRecord.useCount++;

    console.log(`[cookie-pool] 使用 Cookie: ${platform} #${bestRecord.id}, useCount: ${bestRecord.useCount}`);

    // 异步更新数据库统计数据（不阻塞主流程）
    cookieConfigStorage.incrementUseCount(bestRecord.id)
      .then(() => {
        console.log(`[cookie-pool] 数据库更新成功：${platform} #${bestRecord.id}`);
      })
      .catch(err => {
        console.error(`[cookie-pool] 数据库更新失败：${platform} #${bestRecord.id}`, err.message);
      });

    return bestRecord.cookie;
  }

  /**
   * 标记 Cookie 失效，从池中移除
   */
  markInvalid(platform: string, cookie: string): void {
    const pool = this.pools.get(platform.toLowerCase());
    if (!pool) return;

    const index = pool.findIndex(r => r.cookie === cookie);
    if (index !== -1) {
      const removed = pool.splice(index, 1)[0];
      console.log(`[cookie-pool] 标记失效: ${platform} #${removed.id}`);

      // 同时禁用数据库记录
      cookieConfigStorage.update(removed.id, { enabled: false }).catch(() => {});
    }
  }

  /**
   * 获取平台 Access Secret（知乎专用，取池中第一条有效的 access_secret）
   * 简化处理：取启用配置中第一条有 access_secret 的记录
   */
  async getAccessSecret(platform: string): Promise<string> {
    const configs = await cookieConfigStorage.getAllByPlatform(platform);
    for (const c of configs) {
      if (c.accessSecret) return c.accessSecret;
    }
    return '';
  }

  hasAvailable(platform: string): boolean {
    const pool = this.pools.get(platform.toLowerCase());
    return !!pool && pool.length > 0;
  }

  getStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    for (const [platform, pool] of this.pools) {
      status[platform] = pool.length;
    }
    return status;
  }

  async close(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export const cookiePool = new CookiePool();
