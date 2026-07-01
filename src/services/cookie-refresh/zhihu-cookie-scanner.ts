/**
 * 知乎 Cookie 扫码刷新模块
 * 
 * 使用 Playwright 实现知乎 APP 扫码登录
 * 参考小红书 CookieScanner 实现
 */

import { getLogger } from '../../utils/logger';
import { NetworkPostConfigStorage } from '../../storage/mysql/network-post-config-storage';
import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import path from 'path';
import fs from 'fs';

const logger = getLogger('zhihu-cookie-scanner');

/**
 * 扫码结果
 */
export interface ScanResult {
  success: boolean;
  cookie?: string;
  error?: string;
  qrCodePath?: string;
}

/**
 * 状态更新回调
 */
export type StatusCallback = (status: {
  status: string;
  qrCodeBase64?: string;
  message?: string;
}) => void;

/**
 * 知乎 Cookie 扫码器
 */
export class ZhihuCookieScanner {
  private static instance: ZhihuCookieScanner;
  private storage: NetworkPostConfigStorage;
  private browser: any = null;
  private page: any = null;
  private statusCallback: StatusCallback | null = null;

  private constructor() {
    const conn = MySQLConnectionManager.getInstance();
    conn.initialize();
    this.storage = NetworkPostConfigStorage.getInstance();
  }

  public static getInstance(): ZhihuCookieScanner {
    if (!ZhihuCookieScanner.instance) {
      ZhihuCookieScanner.instance = new ZhihuCookieScanner();
    }
    return ZhihuCookieScanner.instance;
  }

  /**
   * 设置状态更新回调
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * 刷新 Cookie
   */
  async refreshCookie(): Promise<{ success: boolean; version?: number; error?: string }> {
    const startTime = Date.now();
    logger.info('🔄 开始刷新知乎 Cookie...');

    try {
      // 清除旧的浏览器数据，强制重新登录
      const userDataDir = path.join(__dirname, '../../../scripts/zhihu_browser_data');
      if (fs.existsSync(userDataDir)) {
        logger.info('🗑️ 清除旧的浏览器数据，强制重新登录...');
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }

      // 初始化浏览器
      await this.initBrowser();

      // 打开登录页面
      logger.info('📱 打开知乎登录页面...');
      this.statusCallback?.({
        status: 'generating',
        message: '正在打开登录页面...',
      });

      await this.page.goto('https://www.zhihu.com/signin?next=%2F', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // 等待页面加载
      await this.page.waitForTimeout(2000);

      // 截取二维码
      const qrResult = await this.captureQRCode('zhihu_qr');
      
      this.statusCallback?.({
        status: 'waiting_scan',
        qrCodeBase64: qrResult.base64,
        message: '请使用知乎 APP 扫描二维码登录',
      });

      // 等待扫码登录（5 分钟超时）
      logger.info('⏳ 等待扫码登录...');
      const scanResult = await this.waitForScanOrLogin(300000);
      await this.cleanupQRCode(qrResult.filepath);

      if (!scanResult.loggedIn) {
        await this.cleanup();
        this.statusCallback?.({
          status: 'failed',
          message: '扫码登录超时（5 分钟）',
        });
        return { success: false, error: '扫码登录超时（5 分钟）' };
      }

      // 登录成功！
      logger.info('✅ 登录成功，提取 Cookie...');
      
      this.statusCallback?.({
        status: 'saving',
        message: '正在保存 Cookie...',
      });

      const cookie = scanResult.cookie;
      if (!cookie) {
        logger.error('❌ Cookie 为空！');
        await this.cleanup();
        return { success: false, error: '未能提取到 Cookie' };
      }

      // 保存 Cookie 到数据库
      logger.info('💾 开始保存 Cookie 到数据库...');
      const saveResult = await this.storage.saveZhihuCookie(cookie, 'auto');

      if (!saveResult.success) {
        logger.error('❌ 保存 Cookie 失败:', saveResult.error);
        await this.cleanup();
        return { success: false, error: saveResult.error };
      }

      // 验证 Cookie 有效性
      logger.info('🔍 正在验证 Cookie 有效性...');
      try {
        const https = await import('https');
        await new Promise<void>((resolve, reject) => {
          const req = https.get('https://www.zhihu.com/api/v4/me', {
            headers: { 'Cookie': cookie },
            timeout: 10000,
          }, (res: any) => {
            if (res.statusCode === 200) {
              logger.info('✅ Cookie 验证成功！');
            } else {
              logger.warn(`⚠️ Cookie 验证返回状态码: ${res.statusCode}`);
            }
            resolve();
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); resolve(); });
        });
      } catch (error) {
        logger.warn('⚠️ Cookie 验证过程出错:', error instanceof Error ? error.message : error);
      }

      // 更新日志
      logger.info('📊 更新刷新日志...');
      const duration = Date.now() - startTime;
      await this.storage.updateRefreshLog(duration, 'success');

      await this.cleanup();

      logger.info(`✅ Cookie 刷新成功！版本：${saveResult.version}, 耗时：${duration}ms`);
      this.statusCallback?.({
        status: 'success',
        message: 'Cookie 刷新成功',
      });
      return { success: true, version: saveResult.version };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('❌ Cookie 刷新失败:', errorMessage);
      await this.storage.updateRefreshLog(Date.now() - startTime, 'failed', errorMessage);
      this.statusCallback?.({
        status: 'failed',
        message: errorMessage,
      });
      await this.cleanup();
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 初始化浏览器（参考小红书实现）
   */
  private async initBrowser(): Promise<void> {
    try {
      const { chromium } = await import('playwright');

      const qrCodeDir = path.join(process.cwd(), 'data', 'qr_codes');
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
      }

      // 浏览器用户数据持久化目录
      const userDataDir = path.join(process.cwd(), 'data', 'browser_user_data', 'zhihu');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      logger.info(`📁 浏览器用户数据目录：${userDataDir}`);

      // 检测是否在 Docker 容器中运行
      const isDocker = fs.existsSync('/.dockerenv') || 
                      fs.existsSync('/proc/1/cgroup') && 
                      fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker') ||
                      process.env.NODE_ENV === 'production';
      
      const browserLaunchPromise = chromium.launchPersistentContext(userDataDir, {
        headless: isDocker,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
          ...(isDocker ? ['--disable-gpu', '--disable-software-rasterizer'] : []),
        ],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        permissions: ['geolocation'],
        geolocation: { latitude: 31.2304, longitude: 121.4737 },
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('浏览器启动超时（30 秒）')), 30000)
      );

      const context = await Promise.race([browserLaunchPromise, timeoutPromise]);
      
      logger.info(`浏览器启动成功（模式：${isDocker ? 'Docker 无头' : '本地有头'}，持久化：${userDataDir}）`);

      this.page = await context.newPage();

      // 注入反检测脚本
      await this.page.addInitScript(`
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {},
        };

        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['zh-CN', 'zh', 'en'],
        });
      `);

      logger.info('✅ 浏览器初始化成功（反检测模式 + 持久化）');
    } catch (error) {
      logger.error('❌ 浏览器初始化失败:', error);
      throw new Error('Playwright 初始化失败，请确保已安装：npm install playwright');
    }
  }

  /**
   * 截取二维码（参考小红书 captureQRCode）
   */
  private async captureQRCode(prefix: string): Promise<{ filepath: string; base64: string }> {
    const selector = 'canvas.Qrcode-qrcode';
    let qrcodeElement = null;
    
    // 等待页面稳定
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      logger.warn('等待网络空闲超时，继续尝试');
    });
    
    await this.page.waitForTimeout(1500);

    // 查找二维码 canvas 元素
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 10000 }).catch(() => null);
      qrcodeElement = await this.page.$(selector);
      if (qrcodeElement) {
        logger.info(`找到知乎二维码：${selector}`);
      }
    } catch (error) {
      logger.warn(`未找到二维码元素：${selector}`);
    }

    // 截取二维码或整个页面
    const filename = `${prefix}_${Date.now()}.png`;
    const filepath = path.join(process.cwd(), 'data', 'qr_codes', filename);

    let base64 = '';
    if (qrcodeElement) {
      try {
        await qrcodeElement.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
        await this.page.waitForTimeout(500);
        
        const buffer = await qrcodeElement.screenshot({ timeout: 10000 });
        fs.writeFileSync(filepath, buffer);
        base64 = buffer.toString('base64');
        logger.info(`二维码截图成功：${filepath}`);
      } catch (error) {
        logger.warn('元素截图失败，尝试截取整个页面:', error);
        const buffer = await this.page.screenshot({ fullPage: false, timeout: 10000 });
        fs.writeFileSync(filepath, buffer);
        base64 = buffer.toString('base64');
      }
    } else {
      logger.warn(`未找到二维码元素，截取整个页面`);
      const buffer = await this.page.screenshot({ fullPage: false, timeout: 10000 });
      fs.writeFileSync(filepath, buffer);
      base64 = buffer.toString('base64');
    }

    return { filepath, base64 };
  }

  /**
   * 等待扫码或登录（参考小红书 waitForScanOrLogin）
   */
  private async waitForScanOrLogin(timeout: number): Promise<{
    loggedIn: boolean;
    cookie?: string;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timer = setTimeout(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logger.warn(`⏰ 等待扫码超时（已等待 ${elapsed} 秒）`);
        resolve({ loggedIn: false });
      }, timeout);

      let checkCount = 0;

      const getPollingInterval = () => {
        if (checkCount <= 10) return 1000;
        if (checkCount <= 30) return 2000;
        return 3000;
      };

      const checkInterval = setInterval(async () => {
        checkCount++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        try {
          // 定期输出状态
          if (checkCount % 10 === 0) {
            logger.debug(`等待中... (${elapsed}秒)`);
          }

          // 检测认证 Cookie
          const cookies = await this.page.context().cookies();
          
          const cookieDict: Record<string, string> = {};
          cookies.forEach((c: any) => {
            cookieDict[c.name] = c.value;
          });

          // 知乎关键 Cookie 字段
          const hasXsrf = cookieDict['_xsrf'] && cookieDict['_xsrf'].length > 10;
          const hasZap = cookieDict['_zap'] && cookieDict['_zap'].length > 10;
          const hasZC0 = cookieDict['z_c0'];

          if (hasXsrf && hasZap && hasZC0) {
            logger.info(`🎉 确认登录成功，找到认证 Cookie`);
            clearTimeout(timer);
            clearInterval(checkInterval);

            // 提取 Cookie（优先关键字段）
            const priorityKeys = ['_xsrf', '_zap', 'z_c0', '__zse_ck', 'captcha_session_v2', 'captcha_ticket_v2'];
            const cookieParts: string[] = [];
            
            for (const key of priorityKeys) {
              if (cookieDict[key]) {
                cookieParts.push(`${key}=${cookieDict[key]}`);
                delete cookieDict[key];
              }
            }
            // 添加剩余 Cookie（以下划线开头的）
            for (const [name, value] of Object.entries(cookieDict)) {
              if (name.startsWith('_')) {
                cookieParts.push(`${name}=${value}`);
              }
            }

            const cookieString = cookieParts.join('; ');
            logger.info(`✅ 提取 Cookie 成功，包含 ${cookieParts.length} 个字段`);
            resolve({ loggedIn: true, cookie: cookieString });
            return;
          }

          // 检查 URL 是否已跳转（辅助判断）
          const currentUrl = this.page.url();
          if (currentUrl.includes('zhihu.com') && !currentUrl.includes('signin') && !currentUrl.includes('login')) {
            // URL 已跳转但 Cookie 还没就绪，等待一下
            logger.info('📄 页面已跳转，等待 Cookie 就绪...');
            await this.page.waitForTimeout(2000);
          }
        } catch (error) {
          logger.debug('检查出错:', error instanceof Error ? error.message : error);
        }
      }, getPollingInterval());
    });
  }

  /**
   * 清理二维码文件
   */
  private async cleanupQRCode(filepath: string): Promise<void> {
    try {
      if (fs.existsSync(filepath)) {
        logger.info(`📸 二维码已保留：${filepath}（7 天后自动清理）`);
      }
    } catch (error) {
      logger.warn('清理二维码失败:', error);
    }
  }

  /**
   * 清理浏览器
   */
  private async cleanup(): Promise<void> {
    const cleanupStartTime = Date.now();
    try {
      if (this.page) {
        try {
          await this.page.close();
          logger.debug('页面已关闭');
        } catch (pageError) {
          logger.debug('关闭页面时出错（可能已关闭）:', pageError instanceof Error ? pageError.message : pageError);
        }
        this.page = null;
      }
      
      if (this.browser) {
        try {
          const closePromise = this.browser.close();
          const timeoutPromise = new Promise<void>((resolve) => 
            setTimeout(() => {
              logger.warn('⚠️ 浏览器关闭超时（5 秒），强制清理');
              resolve();
            }, 5000)
          );
          await Promise.race([closePromise, timeoutPromise]);
          logger.debug('浏览器已关闭');
        } catch (browserError) {
          logger.debug('关闭浏览器时出错（可能已关闭）:', browserError instanceof Error ? browserError.message : browserError);
        }
        this.browser = null;
      }
      
      const duration = Date.now() - cleanupStartTime;
      logger.info(`🗑️ 浏览器已清理（耗时：${duration}ms）`);
    } catch (error) {
      logger.warn('清理浏览器失败:', error instanceof Error ? error.message : error);
      this.page = null;
      this.browser = null;
    }
  }
}
