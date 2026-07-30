import mysql from 'mysql2/promise';
import { getConfig } from '../config/default';

export interface CookieConfig {
  id: number;
  platform: string;
  label: string;
  cookie: string;
  accessSecret: string;
  enabled: boolean;
  priority: number;
  weight: number;
  useCount: number;
  lastUsedAt: Date | null;
  cookieVersion: number;
  lastRefreshAt: Date | null;
  nextRefreshAt: Date | null;
  refreshLogs: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CookieConfigListItem {
  id: number;
  platform: string;
  label: string;
  cookieLength: number;
  cookiePreview: string;
  accessSecret: string;
  enabled: boolean;
  priority: number;
  weight: number;
  useCount: number;
  lastUsedAt: Date | null;
  cookieVersion: number;
  lastRefreshAt: Date | null;
  nextRefreshAt: Date | null;
  recentLogs: any[];
}

export interface CookieStatus {
  hasCookie: boolean;
  cookie?: string;
  version: number;
  lastRefreshTime: Date | null;
  nextRefreshTime: Date | null;
  recentLogs: any[];
}

export class CookieConfigStorage {
  private pool: mysql.Pool | null = null;

  private getPool(): mysql.Pool {
    if (!this.pool) {
      const config = getConfig();
      this.pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        connectionLimit: 5,
      });
    }
    return this.pool;
  }

  // ============================================================
  // CRUD
  // ============================================================

  async getAllByPlatform(platform: string): Promise<CookieConfigListItem[]> {
    const conn = this.getPool();
    const [rows] = await conn.query(
      `SELECT id, platform, label, cookie, access_secret, enabled, priority, weight,
              use_count, last_used_at, cookie_version, last_refresh_at, next_refresh_at, refresh_logs,
              created_at, updated_at
       FROM cookie_configs WHERE platform = ? AND enabled = 1 ORDER BY priority DESC, id ASC`,
      [platform]
    ) as any;

    return rows.map((row: any) => ({
      id: row.id,
      platform: row.platform,
      label: row.label || '',
      cookieLength: (row.cookie || '').length,
      cookiePreview: (row.cookie || '').length > 50 ? (row.cookie || '').substring(0, 50) + '...' : (row.cookie || ''),
      accessSecret: row.access_secret || '',
      enabled: !!row.enabled,
      priority: row.priority || 0,
      weight: row.weight || 10,
      useCount: row.use_count || 0,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      cookieVersion: row.cookie_version || 0,
      lastRefreshAt: row.last_refresh_at ? new Date(row.last_refresh_at) : null,
      nextRefreshAt: row.next_refresh_at ? new Date(row.next_refresh_at) : null,
      recentLogs: this.parseLogs(row.refresh_logs),
    }));
  }

  async getById(id: number): Promise<CookieConfig | null> {
    const conn = this.getPool();
    const [rows] = await conn.query(
      'SELECT * FROM cookie_configs WHERE id = ?',
      [id]
    ) as any;
    if (!rows || rows.length === 0) return null;
    return this.rowToConfig(rows[0]);
  }

  async create(data: {
    platform: string;
    label?: string;
    cookie?: string;
    accessSecret?: string;
    priority?: number;
    weight?: number;
  }): Promise<number> {
    const conn = this.getPool();
    const [result] = await conn.query(
      `INSERT INTO cookie_configs (platform, label, cookie, access_secret, priority, weight)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.platform, data.label || '', data.cookie || '', data.accessSecret || '', data.priority || 0, data.weight || 10]
    ) as any;
    return result.insertId;
  }

  async update(id: number, data: {
    label?: string;
    cookie?: string;
    accessSecret?: string;
    enabled?: boolean;
    priority?: number;
    weight?: number;
  }): Promise<boolean> {
    const conn = this.getPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (data.label !== undefined) { fields.push('label = ?'); values.push(data.label); }
    if (data.cookie !== undefined) { fields.push('cookie = ?'); values.push(data.cookie); }
    if (data.accessSecret !== undefined) { fields.push('access_secret = ?'); values.push(data.accessSecret); }
    if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }
    if (data.weight !== undefined) { fields.push('weight = ?'); values.push(data.weight); }

    if (fields.length === 0) return false;

    values.push(id);
    await conn.query(
      `UPDATE cookie_configs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return true;
  }

  async softDelete(id: number): Promise<boolean> {
    const conn = this.getPool();
    await conn.query('UPDATE cookie_configs SET enabled = 0 WHERE id = ?', [id]);
    return true;
  }

  // ============================================================
  // Cookie 状态
  // ============================================================

  async getStatus(id: number): Promise<CookieStatus | null> {
    const config = await this.getById(id);
    if (!config) return null;

    return {
      hasCookie: !!config.cookie && config.cookie.length > 0,
      cookie: config.cookie,
      version: config.cookieVersion,
      lastRefreshTime: config.lastRefreshAt,
      nextRefreshTime: config.nextRefreshAt,
      recentLogs: config.refreshLogs,
    };
  }

  async saveCookie(id: number, cookie: string, source: 'auto' | 'manual' = 'auto'): Promise<boolean> {
    const conn = this.getPool();
    const logEntry = {
      refresh_time: new Date().toISOString(),
      duration_ms: 0,
      status: 'success',
      source,
    };

    await conn.query(
      `UPDATE cookie_configs
       SET cookie = ?,
           cookie_version = IFNULL(cookie_version, 0) + 1,
           last_refresh_at = NOW(),
           next_refresh_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
           refresh_logs = JSON_ARRAY_APPEND(
             IFNULL(refresh_logs, JSON_ARRAY()),
             '$',
             JSON_OBJECT('refresh_time', ?, 'duration_ms', ?, 'status', ?, 'source', ?)
           )
       WHERE id = ?`,
      [cookie, logEntry.refresh_time, logEntry.duration_ms, logEntry.status, logEntry.source, id]
    );

    // 只保留最近 30 条
    await conn.query(
      `UPDATE cookie_configs
       SET refresh_logs = JSON_REMOVE(
         refresh_logs,
         CONCAT('$[', GREATEST(JSON_LENGTH(refresh_logs) - 30, 0), ']')
       )
       WHERE id = ? AND JSON_LENGTH(refresh_logs) > 30`,
      [id]
    );

    return true;
  }

  async updateRefreshLog(id: number, durationMs: number, status: 'success' | 'failed', errorMessage?: string): Promise<void> {
    const conn = this.getPool();
    const [rows] = await conn.query(
      'SELECT refresh_logs FROM cookie_configs WHERE id = ?', [id]
    ) as any;

    const logs = this.parseLogs(rows?.[0]?.refresh_logs);
    if (logs.length > 0) {
      logs[logs.length - 1] = {
        refresh_time: new Date().toISOString(),
        duration_ms: durationMs,
        status,
        error_message: errorMessage,
        source: 'auto',
      };
      if (logs.length > 30) logs.splice(0, logs.length - 30);
      await conn.query(
        'UPDATE cookie_configs SET refresh_logs = ? WHERE id = ?',
        [JSON.stringify(logs), id]
      );
    }
  }

  // ============================================================
  // 测试连接
  // ============================================================

  async testZhihu(accessSecret: string): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const url = `https://developer.zhihu.com/api/v1/content/zhihu_search?Query=%E5%A5%A5%E8%BF%AA&Count=10`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessSecret}`,
          'X-Request-Timestamp': timestamp.toString(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data: any = await response.json();
      if (data.Code && data.Code !== 0) {
        return { success: false, error: `知乎 API 错误：${data.Message || '未知错误'} (Code: ${data.Code})` };
      }

      return { success: true, resultCount: data.Data?.Items?.length || 0 };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async testXiaohongshu(cookie: string): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      // 简单解析 a1 值
      const a1Match = cookie.match(/a1=([^;]+)/);
      if (!a1Match) {
        return { success: false, error: '无法从 Cookie 中提取 a1 值' };
      }

      // 直接调用搜索 API
      const response = await fetch('https://edith.xiaohongshu.com/api/sns/web/v1/search/notes?keyword=test&page_size=1', {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.xiaohongshu.com/',
        },
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data: any = await response.json();
      if (!data.success) {
        return { success: false, error: data.msg || 'API 返回失败' };
      }

      return { success: true, resultCount: data.data?.items?.length || 0 };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ============================================================
  // 批量获取 Cookie 用于池加载
  // ============================================================

  async getAllEnabledForPool(): Promise<Array<{ id: number; platform: string; cookie: string; weight: number; useCount: number; lastUsedAt: Date | null }>> {
    const conn = this.getPool();
    const [rows] = await conn.query(
      `SELECT id, platform, cookie, weight, use_count, last_used_at
       FROM cookie_configs WHERE enabled = 1 AND cookie IS NOT NULL AND cookie != ''`
    ) as any;

    return rows.map((row: any) => ({
      id: row.id,
      platform: row.platform,
      cookie: row.cookie,
      weight: row.weight || 10,
      useCount: row.use_count || 0,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    }));
  }

  async incrementUseCount(id: number): Promise<void> {
    const conn = this.getPool();
    await conn.query('UPDATE cookie_configs SET use_count = use_count + 1, last_used_at = NOW() WHERE id = ?', [id]);
  }

  // ============================================================
  // Helpers
  // ============================================================

  private rowToConfig(row: any): CookieConfig {
    return {
      id: row.id,
      platform: row.platform,
      label: row.label || '',
      cookie: row.cookie || '',
      accessSecret: row.access_secret || '',
      enabled: !!row.enabled,
      priority: row.priority || 0,
      weight: row.weight || 10,
      useCount: row.use_count || 0,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      cookieVersion: row.cookie_version || 0,
      lastRefreshAt: row.last_refresh_at ? new Date(row.last_refresh_at) : null,
      nextRefreshAt: row.next_refresh_at ? new Date(row.next_refresh_at) : null,
      refreshLogs: this.parseLogs(row.refresh_logs),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private parseLogs(data: any): any[] {
    if (!data) return [];
    try {
      if (typeof data === 'string') {
        if (data.startsWith('[object ')) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
      if (Array.isArray(data)) return data;
      return [];
    } catch {
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export const cookieConfigStorage = new CookieConfigStorage();
