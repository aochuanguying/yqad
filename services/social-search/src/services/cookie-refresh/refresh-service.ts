/**
 * Cookie 刷新服务
 *
 * 基于 Playwright 实现知乎和小红书的扫码登录和自动续期。
 * 借鉴主项目 CookieScanner / ZhihuCookieScanner 的核心逻辑。
 */

import * as path from 'path';
import * as fs from 'fs';
import { cookieConfigStorage } from '../../infra/cookie-config-storage';

type Platform = 'zhihu' | 'xiaohongshu';

export interface ScanStatus {
  status: string; // 'generating' | 'waiting_scan' | 'saving' | 'success' | 'failed'
  qrCodeBase64?: string;
  message?: string;
}

export interface RefreshResult {
  success: boolean;
  cookie?: string;
  version?: number;
  error?: string;
}

interface RefreshTask {
  taskId: string;
  platform: Platform;
  configId: number;
  status: ScanStatus;
  result?: RefreshResult;
  createdAt: number;
}

// ============================================================
// 全局任务管理
// ============================================================
const activeTasks: Map<string, RefreshTask> = new Map();
const taskCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [taskId, task] of activeTasks) {
    if (now - task.createdAt > 30 * 60 * 1000) {
      activeTasks.delete(taskId);
    }
  }
}, 60 * 1000);

function createTask(platform: Platform, configId: number): string {
  const taskId = `${platform}_${configId}_${Date.now()}`;
  activeTasks.set(taskId, {
    taskId,
    platform,
    configId,
    status: { status: 'generating', message: '正在初始化...' },
    createdAt: Date.now(),
  });
  return taskId;
}

function getTaskStatus(taskId: string): ScanStatus | null {
  const task = activeTasks.get(taskId);
  return task ? task.status : null;
}

// ============================================================
// 刷新服务
// ============================================================
export class CookieRefreshService {
  private static instance: CookieRefreshService;

  public static getInstance(): CookieRefreshService {
    if (!CookieRefreshService.instance) {
      CookieRefreshService.instance = new CookieRefreshService();
    }
    return CookieRefreshService.instance;
  }

  /**
   * 手动扫码刷新（通过配置 ID）
   */
  async startManualRefresh(configId: number): Promise<string> {
    const config = await cookieConfigStorage.getById(configId);
    if (!config) {
      throw new Error(`配置 ${configId} 不存在`);
    }

    const platform = config.platform as Platform;
    const taskId = createTask(platform, configId);

    // 异步启动刷新流程
    this.doRefresh(taskId, platform, configId).catch(err => {
      const task = activeTasks.get(taskId);
      if (task) {
        task.status = { status: 'failed', message: err.message };
        task.result = { success: false, error: err.message };
      }
    });

    return taskId;
  }

  getTaskStatus(taskId: string): ScanStatus | null {
    return getTaskStatus(taskId);
  }

  /**
   * 自动续期所有启用的配置
   */
  async autoRefreshAll(): Promise<void> {
    const platforms: Platform[] = ['zhihu', 'xiaohongshu'];
    for (const platform of platforms) {
      const configs = await cookieConfigStorage.getAllByPlatform(platform);
      for (const config of configs) {
        try {
          await this.smartRefresh(config.id, platform);
        } catch (err: any) {
          console.error(`[cookie-refresh] 自动续期失败: ${platform} #${config.id}:`, err.message);
        }
      }
    }
  }

  // ============================================================
  // 内部实现
  // ============================================================

  private async doRefresh(taskId: string, platform: Platform, configId: number): Promise<void> {
    const task = activeTasks.get(taskId);
    if (!task) return;

    let browser: any = null;
    let page: any = null;
    const startTime = Date.now();

    try {
      const { chromium } = await import('playwright-core');

      const qrCodeDir = path.join(process.cwd(), 'data', 'qr_codes');
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
      }

      const isDocker = fs.existsSync('/.dockerenv') || process.env.NODE_ENV === 'production';

      // 手动扫码时使用临时浏览器（不加载持久化数据），确保每次都显示二维码
      const context = await chromium.launch({
        headless: isDocker,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled', '--window-size=1920,1080',
          ...(isDocker ? ['--disable-gpu', '--disable-software-rasterizer'] : []),
        ],
      });

      browser = context;
      const page = await context.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
      });

      // 注入反检测脚本
      await page.addInitScript(`
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
        const oq = window.navigator.permissions.query;
        window.navigator.permissions.query = (p) => p.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : oq(p);
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
      `);

      if (platform === 'zhihu') {
        await this.doZhihuRefresh(task, page, configId, startTime);
      } else {
        await this.doXiaohongshuRefresh(task, page, configId, startTime);
      }
    } catch (err: any) {
      task.status = { status: 'failed', message: err.message };
      task.result = { success: false, error: err.message };
    } finally {
      try {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch {}
    }
  }

  // -------------------------------------------------------
  // 知乎刷新
  // -------------------------------------------------------
  private async doZhihuRefresh(task: RefreshTask, page: any, configId: number, startTime: number): Promise<void> {
    // 直接打开登录页面显示二维码
    task.status = { status: 'generating', message: '正在打开登录页面...' };

    // 访问首页再点登录
    await page.goto('https://www.zhihu.com', { waitUntil: 'networkidle', timeout: 30000 });
    try {
      await page.click('a[href="/signin"]', { timeout: 5000 });
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.goto('https://www.zhihu.com/signin?next=%2F', { waitUntil: 'networkidle', timeout: 30000 });
    }

    await page.waitForTimeout(3000);

    // 截取二维码 - 优先使用更精确的选择器
    const qrSelectors = [
      'canvas.Qrcode-qrcode',         // 知乎二维码 canvas
      'canvas[qrcode]',
      '.qrcode-canvas',
      'img.qrcode-img',
      '.login-qrcode img',
      'div[class*="qrcode"] canvas',
      'div[class*="QRCode"] canvas',
    ];
    let qrBase64 = '';
    for (const sel of qrSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const buffer = await el.screenshot({ timeout: 10000 });
          qrBase64 = buffer.toString('base64');
          console.log('[cookie-refresh] 知乎二维码截图成功，选择器:', sel);
          break;
        }
      } catch (e: any) {
        console.log('[cookie-refresh] 知乎二维码截图失败，选择器:', sel, e.message);
      }
    }
    if (!qrBase64) {
      const buffer = await page.screenshot({ fullPage: false, timeout: 10000 });
      qrBase64 = buffer.toString('base64');
      console.log('[cookie-refresh] 知乎截取全屏');
    }

    task.status = {
      status: 'waiting_scan',
      qrCodeBase64: qrBase64,
      message: '请使用知乎 APP 扫描二维码登录',
    };

    // 等待扫码
    const scanResult = await this.waitForZhihuLogin(page, 300000);
    if (!scanResult) {
      task.status = { status: 'failed', message: '扫码超时' };
      task.result = { success: false, error: '扫码超时' };
      return;
    }

    task.status = { status: 'saving', message: '正在保存...' };
    await cookieConfigStorage.saveCookie(configId, scanResult, 'manual');
    const duration = Date.now() - startTime;
    await cookieConfigStorage.updateRefreshLog(configId, duration, 'success');
    task.status = { status: 'success', message: '扫码登录成功' };
    task.result = { success: true, cookie: scanResult };
  }

  // -------------------------------------------------------
  // 小红书刷新
  // -------------------------------------------------------
  private async doXiaohongshuRefresh(task: RefreshTask, page: any, configId: number, startTime: number): Promise<void> {
    // 直接打开登录页面显示二维码
    task.status = { status: 'generating', message: '正在打开登录页面...' };

    await page.goto('https://www.xiaohongshu.com/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 截取二维码 - 优先使用更精确的选择器
    const qrSelectors = [
      'div.qrcode-img img',           // 二维码图片
      '.qrcode-wrapper canvas',       // 二维码 canvas
      '[class*="qrcode"] img',        // 类名包含 qrcode 的图片
      '[class*="QRCode"] img',        // 类名包含 QRCode 的图片
    ];
    let qrBase64 = '';
    for (const sel of qrSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const buffer = await el.screenshot({ timeout: 10000 });
          qrBase64 = buffer.toString('base64');
          console.log('[cookie-refresh] 小红书二维码截图成功，选择器:', sel);
          break;
        }
      } catch (e: any) {
        console.log('[cookie-refresh] 小红书二维码截图失败，选择器:', sel, e.message);
      }
    }
    if (!qrBase64) {
      // 如果找不到二维码元素，截取登录弹窗区域
      try {
        const loginModal = await page.$('.login-modal, .login-dialog, [class*="login"]');
        if (loginModal) {
          const buffer = await loginModal.screenshot({ timeout: 10000 });
          qrBase64 = buffer.toString('base64');
          console.log('[cookie-refresh] 小红书截取登录弹窗');
        }
      } catch {}
    }
    if (!qrBase64) {
      const buffer = await page.screenshot({ fullPage: false, timeout: 10000 });
      qrBase64 = buffer.toString('base64');
      console.log('[cookie-refresh] 小红书截取全屏');
    }

    task.status = {
      status: 'waiting_scan',
      qrCodeBase64: qrBase64,
      message: '请使用小红书 APP 扫描二维码登录',
    };

    // 等待扫码
    const scanResult = await this.waitForXiaohongshuLogin(page, 300000, false);
    if (!scanResult) {
      task.status = { status: 'failed', message: '扫码超时' };
      task.result = { success: false, error: '扫码超时' };
      return;
    }

    task.status = { status: 'saving', message: '正在保存...' };
    await cookieConfigStorage.saveCookie(configId, scanResult, 'manual');
    const duration = Date.now() - startTime;
    await cookieConfigStorage.updateRefreshLog(configId, duration, 'success');
    task.status = { status: 'success', message: '扫码登录成功' };
    task.result = { success: true, cookie: scanResult };
  }

  // -------------------------------------------------------
  // 自动续期（smartRefresh）
  // -------------------------------------------------------
  private async smartRefresh(configId: number, platform: Platform): Promise<void> {
    const config = await cookieConfigStorage.getById(configId);
    if (!config || !config.cookie) return;

    // 检测 Cookie 有效性
    const isValid = await this.testCookie(platform, config.cookie);
    if (isValid) {
      // Cookie 有效，尝试浏览器续期
      try {
        const { chromium } = await import('playwright-core');
        const isDocker = fs.existsSync('/.dockerenv') || process.env.NODE_ENV === 'production';
        const browser = await chromium.launch({
          headless: isDocker,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        // 注入 Cookie
        const pairs = config.cookie.split(';').map((s: string) => s.trim()).filter((s: string) => s.includes('='));
        const cookiesToAdd = pairs.map((pair: string) => {
          const [name, ...vp] = pair.split('=');
          return { name: name.trim(), value: vp.join('='), domain: platform === 'zhihu' ? '.zhihu.com' : '.xiaohongshu.com', path: '/' };
        });
        await context.addCookies(cookiesToAdd);

        const page = await context.newPage();
        const url = platform === 'zhihu' ? 'https://www.zhihu.com' : 'https://www.xiaohongshu.com';
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);
        await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);

        const cookies = await context.cookies();
        const newCookie = platform === 'zhihu'
          ? this.extractZhihuCookie(cookies)
          : this.extractXiaohongshuCookie(cookies);

        await browser.close();

        if (newCookie) {
          // 验证新 Cookie
          const newIsValid = await this.testCookie(platform, newCookie);
          if (newIsValid) {
            await cookieConfigStorage.saveCookie(configId, newCookie, 'auto');
            console.log(`[cookie-refresh] ${platform} #${configId} 自动续期成功`);
            return;
          }
        }
        console.log(`[cookie-refresh] ${platform} #${configId} 续期后验证失败，保留原 Cookie`);
      } catch (err: any) {
        console.warn(`[cookie-refresh] ${platform} #${configId} 浏览器续期出错:`, err.message);
      }
    } else {
      // Cookie 失效
      console.warn(`[cookie-refresh] ${platform} #${configId} Cookie 已失效，需要手动刷新`);
      await cookieConfigStorage.updateRefreshLog(configId, 0, 'failed', 'Cookie 已失效，需要手动刷新');
    }
  }

  private async testCookie(platform: Platform, cookie: string): Promise<boolean> {
    try {
      if (platform === 'zhihu') {
        const https = await import('https');
        return new Promise((resolve) => {
          const req = https.get('https://www.zhihu.com/api/v4/me', {
            headers: { 'Cookie': cookie },
            timeout: 10000,
          }, (res: any) => resolve(res.statusCode === 200));
          req.on('error', () => resolve(false));
          req.on('timeout', () => { req.destroy(); resolve(false); });
        });
      } else {
        const response = await fetch('https://edith.xiaohongshu.com/api/sns/web/v1/search/notes?keyword=test&page_size=1', {
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.xiaohongshu.com/',
          },
        });
        if (!response.ok) return false;
        const data: any = await response.json();
        return !!data.success;
      }
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------
  // Cookie 提取
  // -------------------------------------------------------
  private extractZhihuCookie(cookies: any[]): string | null {
    const dict: Record<string, string> = {};
    cookies.forEach((c: any) => { dict[c.name] = c.value; });

    const priorityKeys = ['_xsrf', '_zap', 'z_c0', '__zse_ck', 'captcha_session_v2', 'captcha_ticket_v2'];
    const parts: string[] = [];
    for (const key of priorityKeys) {
      if (dict[key]) { parts.push(`${key}=${dict[key]}`); delete dict[key]; }
    }
    for (const [name, value] of Object.entries(dict)) {
      if (name.startsWith('_')) parts.push(`${name}=${value}`);
    }
    return parts.length > 0 ? parts.join('; ') : null;
  }

  private extractXiaohongshuCookie(cookies: any[]): string | null {
    const dict: Record<string, string> = {};
    cookies.forEach((c: any) => { dict[c.name] = c.value; });

    const priorityKeys = ['a1', 'web_session', 'session_id', 'gid', 'api_settings', 'iminfo'];
    const parts: string[] = [];
    for (const key of priorityKeys) {
      if (dict[key]) { parts.push(`${key}=${dict[key]}`); delete dict[key]; }
    }
    for (const [name, value] of Object.entries(dict)) {
      parts.push(`${name}=${value}`);
    }
    return parts.length > 0 ? parts.join('; ') : null;
  }

  // -------------------------------------------------------
  // 登录等待
  // -------------------------------------------------------
  private waitForZhihuLogin(page: any, timeout: number): Promise<string | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stopped = false;

      const timer = setTimeout(() => {
        stopped = true;
        resolve(null);
      }, timeout);

      const doCheck = async () => {
        if (stopped) return;
        try {
          const cookies = await page.context().cookies();
          const dict: Record<string, string> = {};
          cookies.forEach((c: any) => { dict[c.name] = c.value; });

          if (dict['_xsrf']?.length > 10 && dict['_zap']?.length > 10 && dict['z_c0']) {
            clearTimeout(timer);
            stopped = true;
            resolve(this.extractZhihuCookie(cookies));
            return;
          }

          if (Date.now() - startTime < timeout) {
            setTimeout(doCheck, 2000);
          }
        } catch { setTimeout(doCheck, 2000); }
      };
      doCheck();
    });
  }

  private waitForXiaohongshuLogin(page: any, timeout: number, skipSecondQR: boolean): Promise<string | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stopped = false;

      const timer = setTimeout(() => {
        stopped = true;
        resolve(null);
      }, timeout);

      const doCheck = async () => {
        if (stopped) return;
        try {
          const cookies = await page.context().cookies();
          const hasAuth = cookies.some((c: any) =>
            c.name === 'a1' || c.name === 'web_session'
          );
          const isOnLoginPage = page.url().includes('/login');

          if (hasAuth && !isOnLoginPage) {
            clearTimeout(timer);
            stopped = true;
            resolve(this.extractXiaohongshuCookie(cookies));
            return;
          }

          // 检测第二个二维码
          if (!skipSecondQR) {
            try {
              const secondQR = await page.$('.r-captcha-modal img.qrcode-img');
              if (secondQR) {
                clearTimeout(timer);
                stopped = true;
                resolve(null); // 返回 null 表示需要第二轮
                return;
              }
            } catch {}
          }

          if (Date.now() - startTime < timeout) {
            setTimeout(doCheck, 2000);
          }
        } catch { setTimeout(doCheck, 2000); }
      };
      doCheck();
    });
  }
}

export { getTaskStatus, createTask };
