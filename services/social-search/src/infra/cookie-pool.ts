import mysql from 'mysql2/promise';
import { getConfig } from '../config/default';

export interface CookieRecord {
  id: number;
  platform: string;
  cookie: string;
  status: string;
  lastUsedAt: number;
  useCount: number;
}

/**
 * Cookie 池管理
 * 从 MySQL 加载，LRU 轮转，有效性标记，定时刷新
 */
export class CookiePool {
  private pools: Map<string, CookieRecord[]> = new Map();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private connection: mysql.Pool | null = null;

  async init(): Promise<void> {
    const config = getConfig();
    this.connection = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      connectionLimit: 5,
    });

    await this.refresh();

    // 每 5 分钟刷新一次
    this.refreshInterval = setInterval(() => this.refresh(), 5 * 60 * 1000);
    console.log('[cookie-pool] Cookie 池已初始化');
  }

  /**
   * 从数据库刷新 Cookie 池
   * Cookie 存储在 network_post_config 表的 zhihu_cookie 和 xiaohongshu_cookie 列
   */
  async refresh(): Promise<void> {
    if (!this.connection) return;

    try {
      const [rows] = await this.connection.query(
        'SELECT zhihu_cookie, xiaohongshu_cookie FROM network_post_config WHERE enabled = 1 LIMIT 1'
      );

      const records = rows as any[];
      this.pools.clear();

      if (records.length > 0) {
        const row = records[0];
        if (row.zhihu_cookie) {
          this.pools.set('zhihu', [{
            id: 1,
            platform: 'zhihu',
            cookie: row.zhihu_cookie,
            status: 'valid',
            lastUsedAt: 0,
            useCount: 0,
          }]);
        }
        if (row.xiaohongshu_cookie) {
          this.pools.set('xiaohongshu', [{
            id: 2,
            platform: 'xiaohongshu',
            cookie: row.xiaohongshu_cookie,
            status: 'valid',
            lastUsedAt: 0,
            useCount: 0,
          }]);
        }
      }

      const platforms = [...this.pools.keys()];
      const counts = platforms.map(p => `${p}:${this.pools.get(p)!.length}`);
      console.log(`[cookie-pool] 刷新完成: ${counts.join(', ') || '空'}`);
    } catch (err: any) {
      console.error('[cookie-pool] 刷新失败:', err.message);
    }
  }

  /**
   * 获取指定平台的 Cookie（LRU：选择最近最久未使用的）
   */
  get(platform: string): string | null {
    const pool = this.pools.get(platform.toLowerCase());
    if (!pool || pool.length === 0) return null;

    // 按 lastUsedAt 升序排列，选最久没用的
    pool.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    const record = pool[0];
    record.lastUsedAt = Date.now();
    record.useCount++;
    return record.cookie;
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
    }
  }

  /**
   * 检查指定平台是否有可用 Cookie
   */
  hasAvailable(platform: string): boolean {
    const pool = this.pools.get(platform.toLowerCase());
    return !!pool && pool.length > 0;
  }

  /**
   * 获取池状态
   */
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
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}

export const cookiePool = new CookiePool();
