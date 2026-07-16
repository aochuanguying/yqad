import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { getLogger } from '../../utils/logger';
import { parseCookieSimple } from '../../utils/cookie-parser';

const logger = getLogger('network-post-config-storage');

export interface NetworkPostConfig {
  // 知乎配置
  zhihuAccessSecret?: string;
  zhihuCookie?: string; // 知乎 Cookie（用于 Playwright）
  zhihuEnabled: boolean;
  
  // 小红书配置
  xiaohongshuCookie?: string;
  xiaohongshuEnabled: boolean;
  
  // 汽车之家配置
  autohomeCookie?: string;
  autohomeEnabled: boolean;
  autohomeSelectorWarning?: string; // 选择器失效警告
  
  // 通用配置
  maxResults: number;
  enabled: boolean;
  
  // Cookie 刷新相关字段（新增）
  cookieRefreshEnabled?: boolean;
  cookieRefreshCron?: string;
  cookieRefreshAutoEnabled?: boolean;
}

/**
 * Cookie 刷新结果
 */
export interface CookieRefreshResult {
  success: boolean;
  cookieVersion?: number;
  duration?: number;
  error?: string;
}

/**
 * Cookie 状态
 */
export interface CookieStatus {
  hasCookie: boolean;
  cookie?: string; // Cookie 字符串
  version: number;
  lastRefreshTime: Date | null;
  nextRefreshTime: Date | null;
  recentLogs: any[];
}

export class NetworkPostConfigStorage {
  private static instance: NetworkPostConfigStorage;
  private conn: MySQLConnectionManager;

  private constructor(conn: MySQLConnectionManager) {
    this.conn = conn;
  }

  public static getInstance(): NetworkPostConfigStorage {
    if (!NetworkPostConfigStorage.instance) {
      NetworkPostConfigStorage.instance = new NetworkPostConfigStorage(MySQLConnectionManager.getInstance());
    }
    return NetworkPostConfigStorage.instance;
  }

  /**
   * 获取配置
   */
  async getConfig(): Promise<NetworkPostConfig | null> {
    try {
      logger.info('=== 开始获取配置 ===');
      logger.info('this.conn 对象:', this.conn ? '存在' : 'null');
      logger.info('this.conn.connected:', (this.conn as any).connected);
      logger.info('this.conn.pool:', (this.conn as any).pool ? '存在' : 'null');
      
      const sql = 'SELECT * FROM network_post_config WHERE id = 1';
      logger.info('正在执行 SQL:', sql);
      
      const result = await this.conn.query(sql);
      logger.info('query() 返回的原始结果 type:', typeof result);
      logger.info('query() 返回的原始结果:', result);
      
      const rows = Array.isArray(result) ? result[0] : result;
      logger.info('解析后的 rows type:', typeof rows);
      logger.info('解析后的 rows:', rows);
      logger.info('rows.length:', Array.isArray(rows) ? rows.length : 'N/A');
      
      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        logger.warn('network_post_config 表中没有 id=1 的记录');
        return null;
      }

      const row = Array.isArray(rows) ? rows[0] : rows;
      logger.info('找到的配置行:', row);
      
      const config = {
        zhihuAccessSecret: row.zhihu_access_secret || '',
        zhihuCookie: row.zhihu_cookie || '',
        zhihuEnabled: !!row.zhihu_enabled,
        xiaohongshuCookie: row.xiaohongshu_cookie || '',
        xiaohongshuEnabled: !!row.xiaohongshu_enabled,
        autohomeCookie: row.autohome_cookie || '',
        autohomeEnabled: !!row.autohome_enabled,
        autohomeSelectorWarning: row.autohome_selector_warning || '',
        maxResults: row.max_results || 10,
        enabled: !!row.enabled,
        // Cookie 刷新相关字段
        cookieRefreshEnabled: !!row.cookie_refresh_enabled,
        cookieRefreshCron: row.cookie_refresh_cron || '',
        cookieRefreshAutoEnabled: !!row.cookie_refresh_auto_enabled,
      };
      
      logger.info('返回的配置:', config);
      return config;
    } catch (error) {
      logger.error('获取配置失败:', error);
      return null;
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(config: NetworkPostConfig): Promise<boolean> {
    try {
      await this.conn.execute(
        `INSERT INTO network_post_config (
          id, zhihu_access_secret, zhihu_cookie, zhihu_enabled, 
          xiaohongshu_cookie, xiaohongshu_enabled,
          autohome_cookie, autohome_enabled,
          max_results, enabled, updated_at
        ) VALUES (
          1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
        ) ON DUPLICATE KEY UPDATE
          zhihu_access_secret = VALUES(zhihu_access_secret),
          zhihu_cookie = VALUES(zhihu_cookie),
          zhihu_enabled = VALUES(zhihu_enabled),
          xiaohongshu_cookie = VALUES(xiaohongshu_cookie),
          xiaohongshu_enabled = VALUES(xiaohongshu_enabled),
          autohome_cookie = VALUES(autohome_cookie),
          autohome_enabled = VALUES(autohome_enabled),
          max_results = VALUES(max_results),
          enabled = VALUES(enabled),
          updated_at = NOW()
        `,
        [
          config.zhihuAccessSecret || '',
          config.zhihuCookie || '',
          config.zhihuEnabled ? 1 : 0,
          config.xiaohongshuCookie || '',
          config.xiaohongshuEnabled ? 1 : 0,
          config.autohomeCookie || '',
          config.autohomeEnabled ? 1 : 0,
          config.maxResults || 10,
          config.enabled ? 1 : 0,
        ]
      );
      return true;
    } catch (error) {
      logger.error('保存配置失败', error);
      return false;
    }
  }

  /**
   * 更新汽车之家选择器警告状态
   */
  async updateAutohomeSelectorWarning(warningMessage: string | null): Promise<boolean> {
    try {
      await this.conn.execute(
        `INSERT INTO network_post_config (id, autohome_selector_warning, updated_at) 
         VALUES (1, ?, NOW())
         ON DUPLICATE KEY UPDATE 
         autohome_selector_warning = VALUES(autohome_selector_warning),
         updated_at = NOW()`,
        [warningMessage || '']
      );
      return true;
    } catch (error) {
      logger.error('更新汽车之家选择器警告失败:', error);
      return false;
    }
  }

  /**
   * 获取汽车之家选择器警告状态
   */
  async getAutohomeSelectorWarning(): Promise<string | null> {
    try {
      const config = await this.getConfig();
      if (config) {
        return config.autohomeSelectorWarning || null;
      }
      return null;
    } catch (error) {
      logger.error('获取汽车之家选择器警告失败:', error);
      return null;
    }
  }

  /**
   * 测试知乎连接
   */
  async testZhihuConnection(accessSecret: string): Promise<{ success: boolean; resultCount?: number; error?: string }> {
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
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data: any = await response.json();
      const resultCount = data.Data?.Items?.length || 0;
      
      return {
        success: true,
        resultCount,
      };
    } catch (error) {
      logger.error('测试知乎连接失败:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 测试小红书连接
   * 使用优化后的 XiaohongshuSearch 类，包含重试机制、频率控制等
   */
  async testXiaohongshuConnection(cookie: string): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      // 1. 解析 Cookie 验证
      logger.info('正在解析 Cookie...');
      const parseResult = parseCookieSimple(cookie);
      
      if (!parseResult.a1Value) {
        return {
          success: false,
          error: '无法从 Cookie 中提取 a1 值',
        };
      }
      
      logger.info(`✓ Cookie 解析成功，a1: ${parseResult.a1Value ? '存在' : '不存在'}`);
      
      // 2. 直接注入 Cookie 到搜索服务实例（避免环境变量竞态）
      const { XiaohongshuSearch } = require('../../services/internet-search/xiaohongshu-search');
      const searchService = new XiaohongshuSearch();
      
      // 直接设置 config.cookie，跳过 initialize 的数据库加载
      (searchService as any).config.cookie = cookie;
      
      logger.info('开始测试小红书 API 连接...');
      
      // 3. 调用 testConnection 方法
      const result = await searchService.testConnection();
      
      return result;
    } catch (error) {
      logger.error('测试小红书连接失败:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : '测试失败',
      };
    }
  }

  /**
   * 测试汽车之家连接（使用搜索 API，无需 Cookie）
   */
  async testAutohomeConnection(): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      logger.info('正在测试汽车之家连接...');
      
      const { spawn } = require('child_process');
      const path = require('path');
      
      return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, '../../../scripts/test_autohome.py');
        const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
        
        const pyProcess = spawn(pythonExecutable, [scriptPath, '奥迪Q5L提车', '5']);
        let output = '';
        let errorOutput = '';
        let resolved = false;

        const doResolve = (result: { success: boolean; resultCount?: number; error?: string }) => {
          if (resolved) return;
          resolved = true;
          resolve(result);
        };

        pyProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        pyProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        pyProcess.on('close', (code: number) => {
          if (code !== 0) {
            doResolve({
              success: false,
              error: errorOutput || `Python 进程退出码：${code}`,
            });
            return;
          }

          try {
            const result = JSON.parse(output);
            doResolve({
              success: result.success,
              resultCount: result.total || result.results?.length || 0,
              error: result.error,
            });
          } catch (e) {
            doResolve({
              success: false,
              error: `解析响应失败：${output}`,
            });
          }
        });

        setTimeout(() => {
          pyProcess.kill();
          doResolve({
            success: false,
            error: '测试超时（15 秒）',
          });
        }, 15000);
      });
    } catch (error) {
      logger.error('测试汽车之家连接失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取 Cookie 状态
   */
  async getCookieStatus(): Promise<CookieStatus> {
    try {
      const sql = `
        SELECT 
          xiaohongshu_cookie,
          xiaohongshu_cookie_version,
          xiaohongshu_last_refresh_time,
          xiaohongshu_next_refresh_time,
          xiaohongshu_cookie_refresh_logs
        FROM network_post_config 
        WHERE id = 1
      `;
      
      const result = await this.conn.query(sql);
      const row = Array.isArray(result) ? result[0] : result;
      
      if (!row) {
        return {
          hasCookie: false,
          version: 0,
          lastRefreshTime: null,
          nextRefreshTime: null,
          recentLogs: [],
        };
      }
      
      const hasCookie = !!row.xiaohongshu_cookie && row.xiaohongshu_cookie.toString().length > 0;
      const cookie = row.xiaohongshu_cookie ? row.xiaohongshu_cookie.toString() : '';
      const version = row.xiaohongshu_cookie_version ? parseInt(row.xiaohongshu_cookie_version) : 0;
      const lastRefreshTime = row.xiaohongshu_last_refresh_time ? new Date(row.xiaohongshu_last_refresh_time) : null;
      const nextRefreshTime = row.xiaohongshu_next_refresh_time ? new Date(row.xiaohongshu_next_refresh_time) : null;
      
      // 安全解析 JSON 日志
      let recentLogs: any[] = [];
      try {
        if (row.xiaohongshu_cookie_refresh_logs) {
          const logData = row.xiaohongshu_cookie_refresh_logs;
          // MySQL JSON 字段可能返回字符串或对象，需要兼容处理
          if (typeof logData === 'string') {
            const parsed = JSON.parse(logData);
            recentLogs = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(logData)) {
            recentLogs = logData;
          } else if (typeof logData === 'object' && logData !== null) {
            // 如果是对象但不是数组，尝试转换为数组
            recentLogs = [logData];
          }
        }
      } catch (e) {
        logger.warn('解析 xiaohongshu_cookie_refresh_logs 失败:', e);
        recentLogs = [];
      }
      
      return {
        hasCookie,
        cookie,
        version,
        lastRefreshTime,
        nextRefreshTime,
        recentLogs,
      };
    } catch (error) {
      logger.error('获取 Cookie 状态失败:', error);
      return {
        hasCookie: false,
        version: 0,
        lastRefreshTime: null,
        nextRefreshTime: null,
        recentLogs: [],
      };
    }
  }

  /**
   * 保存 Cookie（用于自动刷新）
   */
  async saveCookie(cookie: string, source: 'auto' | 'manual' = 'auto'): Promise<{ success: boolean; version?: number; error?: string }> {
    try {
      // 构建刷新日志
      const refreshLog = {
        refresh_time: new Date().toISOString(),
        duration_ms: 0, // 由调用方更新
        status: 'success' as const,
        source,
        platform: 'xiaohongshu',
      };
      
      // 使用 SQL 层面自增 version，避免竞态条件
      await this.conn.execute(
        `UPDATE network_post_config 
         SET xiaohongshu_cookie = ?, 
             xiaohongshu_cookie_version = IFNULL(xiaohongshu_cookie_version, 0) + 1,
             xiaohongshu_last_refresh_time = NOW(),
             xiaohongshu_next_refresh_time = DATE_ADD(NOW(), INTERVAL 24 HOUR),
             xiaohongshu_cookie_refresh_logs = JSON_ARRAY_APPEND(
               IFNULL(xiaohongshu_cookie_refresh_logs, JSON_ARRAY()),
               '$',
               CAST(? AS JSON)
             )
         WHERE id = 1`,
        [cookie, JSON.stringify(refreshLog)]
      );
      
      // 查询实际写入的版本号
      const status = await this.getCookieStatus();
      const newVersion = status.version;
      
      logger.info(`[CookieStorage] 小红书 Cookie 保存成功，版本：${newVersion}, 来源：${source}`);
      return { success: true, version: newVersion };
    } catch (error) {
      logger.error('[CookieStorage] 小红书 Cookie 保存失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '保存失败' 
      };
    }
  }

  /**
   * 更新刷新日志（用于更新耗时）
   */
  async updateRefreshLog(durationMs: number, status: 'success' | 'failed', errorMessage?: string, platform: 'xiaohongshu' | 'zhihu' = 'xiaohongshu'): Promise<void> {
    try {
      const logEntry = {
        refresh_time: new Date().toISOString(),
        duration_ms: durationMs,
        status,
        error_message: errorMessage,
        source: 'auto',
        platform,
      };
      
      // 根据平台选择字段
      const logField = platform === 'zhihu' ? 'zhihu_cookie_refresh_logs' : 'xiaohongshu_cookie_refresh_logs';
      
      // 获取当前日志数组
      const [rows] = await this.conn.query(
        `SELECT ${logField} FROM network_post_config WHERE id = 1`
      ) as any;
      
      const row = Array.isArray(rows) ? rows[0] : rows;
      // MySQL JSON 字段可能返回字符串或对象，需要兼容处理
      let logs: any[] = [];
      if (row && row[logField]) {
        const logData = row[logField];
        if (typeof logData === 'string') {
          // 检查是否是无效的字符串（如 "[object Object]"）
          if (logData.startsWith('[object ')) {
            logger.warn(`${logField} 存储了无效的对象字符串，重置为空数组`);
            logs = [];
          } else {
            try {
              logs = JSON.parse(logData);
            } catch (e) {
              logger.warn(`解析 ${logField} 失败:`, e);
              logs = [];
            }
          }
        } else if (Array.isArray(logData)) {
          logs = logData;
        } else if (typeof logData === 'object' && logData !== null) {
          // 如果是对象但不是数组，尝试转换为数组
          logs = [logData];
        }
      }
      
      // 更新最后一条日志
      if (logs.length > 0) {
        logs[logs.length - 1] = logEntry;
        
        // 只保留最近 30 条
        if (logs.length > 30) {
          logs = logs.slice(-30);
        }
        
        await this.conn.execute(
          `UPDATE network_post_config SET ${logField} = ? WHERE id = 1`,
          [JSON.stringify(logs)]
        );
      }
    } catch (error) {
      logger.error('[CookieStorage] 更新刷新日志失败:', error);
    }
  }

  /**
   * 获取知乎 Cookie 状态
   */
  async getZhihuCookieStatus(): Promise<CookieStatus> {
    try {
      const sql = `
        SELECT 
          zhihu_cookie,
          zhihu_cookie_version,
          zhihu_last_refresh_time,
          zhihu_next_refresh_time,
          zhihu_cookie_refresh_logs
        FROM network_post_config 
        WHERE id = 1
      `;
      
      const result = await this.conn.query(sql);
      const row = Array.isArray(result) ? result[0] : result;
      
      if (!row) {
        return {
          hasCookie: false,
          version: 0,
          lastRefreshTime: null,
          nextRefreshTime: null,
          recentLogs: [],
        };
      }
      
      const hasCookie = !!row.zhihu_cookie && row.zhihu_cookie.toString().length > 0;
      const cookie = row.zhihu_cookie ? row.zhihu_cookie.toString() : '';
      const version = row.zhihu_cookie_version ? parseInt(row.zhihu_cookie_version) : 0;
      const lastRefreshTime = row.zhihu_last_refresh_time ? new Date(row.zhihu_last_refresh_time) : null;
      const nextRefreshTime = row.zhihu_next_refresh_time ? new Date(row.zhihu_next_refresh_time) : null;
      
      let recentLogs: any[] = [];
      try {
        if (row.zhihu_cookie_refresh_logs) {
          const logData = row.zhihu_cookie_refresh_logs;
          // MySQL JSON 字段可能返回字符串或对象，需要兼容处理
          if (typeof logData === 'string') {
            // 检查是否是无效的字符串（如 "[object Object]"）
            if (logData.startsWith('[object ')) {
              logger.warn(`zhihu_cookie_refresh_logs 存储了无效的对象字符串，重置为空数组`);
              recentLogs = [];
            } else {
              const parsed = JSON.parse(logData);
              recentLogs = Array.isArray(parsed) ? parsed : [];
            }
          } else if (Array.isArray(logData)) {
            recentLogs = logData;
          } else if (typeof logData === 'object' && logData !== null) {
            // 如果是对象但不是数组，尝试转换为数组
            recentLogs = [logData];
          }
        }
      } catch (e) {
        logger.warn('解析 zhihu_cookie_refresh_logs 失败:', e);
        recentLogs = [];
      }
      
      return {
        hasCookie,
        cookie,
        version,
        lastRefreshTime,
        nextRefreshTime,
        recentLogs,
      };
    } catch (error) {
      logger.error('获取知乎 Cookie 状态失败:', error);
      return {
        hasCookie: false,
        version: 0,
        lastRefreshTime: null,
        nextRefreshTime: null,
        recentLogs: [],
      };
    }
  }

  /**
   * 保存知乎 Cookie
   */
  async saveZhihuCookie(cookie: string, source: 'auto' | 'manual' = 'auto'): Promise<{ success: boolean; version?: number; error?: string }> {
    try {
      // 构建刷新日志
      const refreshLog = {
        refresh_time: new Date().toISOString(),
        duration_ms: 0,
        status: 'success' as const,
        source,
        platform: 'zhihu',
      };
      
      // 使用 SQL 层面自增 version，避免竞态条件
      await this.conn.execute(
        `UPDATE network_post_config 
         SET zhihu_cookie = ?, 
             zhihu_enabled = 1,
             zhihu_cookie_version = IFNULL(zhihu_cookie_version, 0) + 1,
             zhihu_last_refresh_time = NOW(),
             zhihu_next_refresh_time = DATE_ADD(NOW(), INTERVAL 24 HOUR),
             zhihu_cookie_refresh_logs = JSON_ARRAY_APPEND(
               IFNULL(zhihu_cookie_refresh_logs, JSON_ARRAY()),
               '$',
               CAST(? AS JSON)
             )
         WHERE id = 1`,
        [cookie, JSON.stringify(refreshLog)]
      );
      
      // 查询实际写入的版本号
      const status = await this.getZhihuCookieStatus();
      const newVersion = status.version;
      
      logger.info(`[CookieStorage] 知乎 Cookie 保存成功，版本：${newVersion}, 来源：${source}`);
      return { success: true, version: newVersion };
    } catch (error) {
      logger.error('[CookieStorage] 知乎 Cookie 保存失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '保存失败' 
      };
    }
  }
}
