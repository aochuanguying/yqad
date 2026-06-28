import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { getLogger } from '../../utils/logger';
import { parseCookieWithAI } from '../../utils/cookie-parser';

const logger = getLogger('network-post-config-storage');

export interface NetworkPostConfig {
  // 知乎配置
  zhihuAccessSecret?: string;
  zhihuEnabled: boolean;
  
  // 小红书配置
  xiaohongshuCookie?: string;
  xiaohongshuEnabled: boolean;
  
  // 微博配置
  weiboAccessToken?: string;
  weiboEnabled: boolean;
  
  // 通用配置
  maxResults: number;
  enabled: boolean;
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
        zhihuEnabled: !!row.zhihu_enabled,
        xiaohongshuCookie: row.xiaohongshu_cookie || '',
        xiaohongshuEnabled: !!row.xiaohongshu_enabled,
        weiboAccessToken: row.weibo_access_token || '',
        weiboEnabled: !!row.weibo_enabled,
        maxResults: row.max_results || 10,
        enabled: !!row.enabled,
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
          id, zhihu_access_secret, zhihu_enabled, 
          xiaohongshu_cookie, xiaohongshu_enabled,
          weibo_access_token, weibo_enabled,
          max_results, enabled, updated_at
        ) VALUES (
          1, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
        ) ON DUPLICATE KEY UPDATE
          zhihu_access_secret = VALUES(zhihu_access_secret),
          zhihu_enabled = VALUES(zhihu_enabled),
          xiaohongshu_cookie = VALUES(xiaohongshu_cookie),
          xiaohongshu_enabled = VALUES(xiaohongshu_enabled),
          weibo_access_token = VALUES(weibo_access_token),
          weibo_enabled = VALUES(weibo_enabled),
          max_results = VALUES(max_results),
          enabled = VALUES(enabled),
          updated_at = NOW()
        `,
        [
          config.zhihuAccessSecret || '',
          config.zhihuEnabled ? 1 : 0,
          config.xiaohongshuCookie || '',
          config.xiaohongshuEnabled ? 1 : 0,
          config.weiboAccessToken || '',
          config.weiboEnabled ? 1 : 0,
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
   */
  async testXiaohongshuConnection(cookie: string): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      // 1. 使用公共 AI 方法解析 Cookie
      logger.info('正在使用 AI 解析 Cookie...');
      const parseResult = await parseCookieWithAI(cookie);
      
      if (!parseResult.a1Value) {
        return {
          success: false,
          error: '无法从 Cookie 中提取 a1 值',
        };
      }
      
      logger.info(`✓ Cookie 解析成功，a1: ${parseResult.a1Value ? '存在' : '不存在'}`);
      
      // 2. 使用 Python xhshow 库测试小红书连接（使用最新的 mns0301 签名算法）
      const { spawn } = require('child_process');
      const path = require('path');
      
      return new Promise((resolve) => {
        // 使用独立的 Python 脚本文件（已修改为简单解析）
        const scriptPath = path.join(__dirname, '../../scripts/test_xiaohongshu.py');
        const pyProcess = spawn('python3.10', [scriptPath, cookie]);
        let output = '';
        let errorOutput = '';

        pyProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        pyProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        pyProcess.on('close', (code: number) => {
          if (code !== 0) {
            resolve({
              success: false,
              error: errorOutput || `Python 进程退出码：${code}`,
            });
            return;
          }

          try {
            const result = JSON.parse(output);
            resolve({
              success: result.success,
              resultCount: result.count,
              error: result.error,
            });
          } catch (e) {
            resolve({
              success: false,
              error: `解析响应失败：${output}`,
            });
          }
        });

        setTimeout(() => {
          pyProcess.kill();
          resolve({
            success: false,
            error: '测试超时（15 秒）',
          });
        }, 15000);
      });
    } catch (error) {
      logger.error('测试小红书连接失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
}
