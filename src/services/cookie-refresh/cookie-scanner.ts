/**
 * Cookie 扫码刷新模块
 * 
 * 使用 Playwright 实现小红书自动扫码登录
 * 支持两次扫码流程
 */

import { getLogger } from '../../utils/logger';
import { NetworkPostConfigStorage } from '../../storage/mysql/network-post-config-storage';
import path from 'path';
import fs from 'fs';

const logger = getLogger('cookie-scanner');

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
 * Cookie 扫码器
 */
export class CookieScanner {
  private static instance: CookieScanner;
  private storage: NetworkPostConfigStorage;
  private browser: any = null;
  private page: any = null;
  private statusCallback: StatusCallback | null = null;

  private constructor() {
    this.storage = NetworkPostConfigStorage.getInstance();
  }

  public static getInstance(): CookieScanner {
    if (!CookieScanner.instance) {
      CookieScanner.instance = new CookieScanner();
    }
    return CookieScanner.instance;
  }

  /**
   * 设置状态更新回调
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * 刷新 Cookie（兼容一次扫码和两次扫码）
   */
  async refreshCookie(): Promise<{ success: boolean; version?: number; error?: string }> {
    const startTime = Date.now();
    logger.info('🔄 开始刷新 Cookie...');

    try {
      // 初始化浏览器
      await this.initBrowser();

      // 打开登录页面
      logger.info('📱 打开小红书登录页面...');
      this.statusCallback?.({
        status: 'generating',
        message: '正在打开登录页面...',
      });

      await this.page.goto('https://www.xiaohongshu.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // 等待页面加载
      await this.page.waitForTimeout(3000);

      // 最多尝试 2 次扫码
      for (let scanRound = 1; scanRound <= 2; scanRound++) {
        logger.info(`📱 第 ${scanRound} 轮扫码...`);

        // 截取当前二维码（第二轮使用第二个二维码的特定选择器）
        const isSecondQR = scanRound === 2;
        const qrResult = await this.captureQRCode(`qr_round${scanRound}`, isSecondQR);
        
        const message = scanRound === 1 
          ? '请使用小红书 APP 扫码登录' 
          : '请再次扫描二维码完成登录';
        
        this.statusCallback?.({
          status: 'waiting_scan',
          qrCodeBase64: qrResult.base64,
          message,
        });

        // 等待扫码或页面变化（5 分钟超时）
        // 第二轮扫码时跳过第二个二维码检测，直接等待登录成功
        logger.info(`⏳ 等待第 ${scanRound} 轮扫码...`);
        const scanResult = await this.waitForScanOrLogin(300000, scanRound === 2);
        await this.cleanupQRCode(qrResult.filepath);

        if (!scanResult.changed) {
          // 超时
          await this.cleanup();
          this.statusCallback?.({
            status: 'failed',
            message: `第 ${scanRound} 轮扫码超时`,
          });
          return { success: false, error: `第 ${scanRound} 轮扫码超时（5 分钟）` };
        }

        if (scanResult.loggedIn) {
          // 登录成功！
          logger.info('✅ 登录成功，提取 Cookie...');
          logger.info('📝 Cookie 长度:', scanResult.cookie?.length || 0);
          logger.debug('📝 Cookie 内容:', scanResult.cookie?.substring(0, 100) + '...');
          
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
          const saveStartTime = Date.now();
          const saveResult = await this.storage.saveCookie(cookie, 'auto');
          logger.info(`💾 保存 Cookie 完成，耗时：${Date.now() - saveStartTime}ms, success=${saveResult.success}`);

          if (!saveResult.success) {
            logger.error('❌ 保存 Cookie 失败:', saveResult.error);
            await this.cleanup();
            return { success: false, error: saveResult.error };
          }

          // 更新日志
          logger.info('📊 更新刷新日志...');
          const duration = Date.now() - startTime;
          const logStartTime = Date.now();
          await this.storage.updateRefreshLog(duration, 'success');
          logger.info(`📊 更新日志完成，耗时：${Date.now() - logStartTime}ms`);

          await this.cleanup();

          logger.info(`✅ Cookie 刷新成功！版本：${saveResult.version}, 耗时：${duration}ms`);
          this.statusCallback?.({
            status: 'success',
            message: 'Cookie 刷新成功',
          });
          return { success: true, version: saveResult.version };
        }

        // 页面变化但未登录，说明需要第二次扫码
        logger.info(`第 ${scanRound} 轮扫码后页面变化，准备下一轮...`);
        
        // 等待新页面加载
        await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {
          logger.warn('等待页面加载超时，继续尝试');
        });
        await this.page.waitForTimeout(10000); // 多等一会，让第二个二维码完全加载并显示倒计时
      }

      // 两轮扫码后仍未登录
      await this.cleanup();
      this.statusCallback?.({
        status: 'failed',
        message: '两轮扫码后仍未登录成功',
      });
      return { success: false, error: '两轮扫码后仍未登录成功' };
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
   * 初始化浏览器
   */
  private async initBrowser(): Promise<void> {
    try {
      // @ts-ignore - Playwright 动态导入
      const { chromium } = await import('playwright');

      const qrCodeDir = path.join(process.cwd(), 'data', 'qr_codes');
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
      }

      // 检测是否在 Docker 容器中运行
      const isDocker = fs.existsSync('/.dockerenv') || process.env.NODE_ENV === 'production';
      
      this.browser = await chromium.launch({
        headless: isDocker, // Docker 中使用无头模式，本地使用有头模式
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled', // 隐藏自动化标志
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--disable-features=BlockInsecurePrivateNetworkRequests',
          '--window-size=1920,1080',
          // Docker 中需要的额外参数
          ...(isDocker ? ['--disable-gpu', '--disable-software-rasterizer'] : []),
        ],
      });
      
      logger.info(`浏览器启动成功（模式：${isDocker ? 'Docker 无头' : '本地有头'}）`);

      // 创建新的上下文，模拟真实浏览器
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        permissions: ['geolocation'],
        geolocation: { latitude: 31.2304, longitude: 121.4737 }, // 上海坐标
      });

      this.page = await context.newPage();

      // 注入反检测脚本
      await this.page.addInitScript(`
        // 覆盖 navigator.webdriver 属性
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // 覆盖 chrome 对象
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {},
        };

        // 覆盖权限查询
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // 覆盖 plugins 长度
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // 覆盖 languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['zh-CN', 'zh', 'en'],
        });
      `);

      logger.info('✅ 浏览器初始化成功（反检测模式）');
    } catch (error) {
      logger.error('❌ 浏览器初始化失败:', error);
      throw new Error('Playwright 初始化失败，请确保已安装：npm install playwright');
    }
  }

  /**
   * 截取二维码（通用方法）
   * @param prefix 文件名前缀
   * @param isSecondQR 是否是第二个二维码（使用不同的选择器）
   */
  private async captureQRCode(prefix: string, isSecondQR: boolean = false): Promise<{ filepath: string; base64: string }> {
    // 第一个二维码：.login-container 下的 img.qrcode-img
    const firstQRSelectors = [
      '.login-container .qrcode-img',
      '.login-container img[class*="qrcode"]',
      '.login-qrcode',
      '[class*="qrcode"]',
      'img[src*="qrcode"]',
      'canvas',
    ];

    // 第二个二维码：.r-captcha-modal 下的 img.qrcode-img
    const secondQRSelectors = [
      '.r-captcha-modal .qrcode-img',
      '.r-captcha-modal img[class*="qrcode"]',
      '.r-captcha-modal img',
      '[class*="captcha"] .qrcode-img',
      '[class*="captcha"] img[class*="qrcode"]',
      '[class*="captcha"] img',
    ];

    const selectors = isSecondQR ? [...secondQRSelectors, ...firstQRSelectors] : firstQRSelectors;

    let qrcodeElement = null;
    let matchedSelector = '';
    
    // 等待页面稳定
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      logger.warn('等待网络空闲超时，继续尝试');
    });
    await this.page.waitForTimeout(2000);

    for (const selector of selectors) {
      try {
        // 等待元素可见
        await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 }).catch(() => null);
        qrcodeElement = await this.page.$(selector);
        if (qrcodeElement) {
          matchedSelector = selector;
          logger.info(`找到${isSecondQR ? '第二个' : '第一个'}二维码：${selector}`);
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }

    // 截取二维码
    const filename = `${prefix}_${Date.now()}.png`;
    const filepath = path.join(process.cwd(), 'data', 'qr_codes', filename);

    let base64 = '';
    if (qrcodeElement) {
      try {
        // 确保元素在视图中
        await qrcodeElement.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
        await this.page.waitForTimeout(1000); // 等待滚动完成
        
        // 截图
        const buffer = await qrcodeElement.screenshot({ timeout: 10000 });
        fs.writeFileSync(filepath, buffer);
        base64 = buffer.toString('base64');
        logger.info(`二维码截图成功：${filepath}`);
      } catch (error) {
        logger.warn('元素截图失败，尝试截取整个页面:', error);
        // 如果元素截图失败，截取整个页面
        const buffer = await this.page.screenshot({ fullPage: false, timeout: 10000 });
        fs.writeFileSync(filepath, buffer);
        base64 = buffer.toString('base64');
      }
    } else {
      // 截取整个页面
      logger.warn(`未找到二维码元素（${matchedSelector || '无匹配'}），截取整个页面`);
      const buffer = await this.page.screenshot({ fullPage: false, timeout: 10000 });
      fs.writeFileSync(filepath, buffer);
      base64 = buffer.toString('base64');
    }

    return { filepath, base64 };
  }

  /**
   * 等待扫码或登录（同时检测页面变化和登录成功）
   * 返回：{ changed: 页面是否变化，loggedIn: 是否登录成功，cookie: Cookie 字符串 }
   */
  private async waitForScanOrLogin(timeout: number, skipSecondQRCheck: boolean = false): Promise<{
    changed: boolean;
    loggedIn: boolean;
    cookie?: string;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timer = setTimeout(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logger.warn(`⏰ 等待扫码超时（已等待 ${elapsed} 秒）`);
        resolve({ changed: false, loggedIn: false });
      }, timeout);

      let lastUrl = this.page.url();
      let secondQRDetected = false;
      let checkCount = 0;

      const checkInterval = setInterval(async () => {
        checkCount++;
        try {
          const currentUrl = this.page.url();

          // 每 5 次检查（10 秒）输出一次状态
          if (checkCount % 5 === 0) {
            logger.debug(`等待中... (${checkCount * 2}秒) URL: ${currentUrl}`);
          }

          // 额外检测：检查页面中是否有二维码相关的元素（每 4 秒检查一次）
          if (checkCount % 2 === 0) {
            try {
              const pageContent = await this.page.content();
              if (pageContent.includes('qrcode') || pageContent.includes('captcha')) {
                logger.debug('页面内容包含二维码或验证码相关关键词');
              }
            } catch (e) {
              // 忽略
            }
          }

          // 检查是否登录成功（跳转到首页）
          const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/captcha');
          const isHomePage = currentUrl.includes('/explore') || 
                            currentUrl.includes('/profile') ||
                            currentUrl === 'https://www.xiaohongshu.com/' ||
                            currentUrl === 'https://www.xiaohongshu.com' ||
                            currentUrl === 'https://www.xiaohongshu.com/explore';
          
          if (isHomePage || (!isLoginPage && checkCount > 5)) {
            // 如果不在登录页且已经检查了 10 秒以上，可能是登录成功了
            logger.info(`🎉 检测到页面跳转：${currentUrl}（可能已登录）`);
            
            // 获取 Cookie 确认是否登录成功
            try {
              const cookies = await this.page.context().cookies();
              const hasAuthCookie = cookies.some((c: any) => 
                c.name.includes('session') || 
                c.name.includes('token') || 
                c.name.includes('user')
              );
              
              if (hasAuthCookie || isHomePage) {
                logger.info('✅ 确认登录成功，找到认证 Cookie');
                clearTimeout(timer);
                clearInterval(checkInterval);

                const cookieDict: Record<string, string> = {};
                cookies.forEach((c: any) => {
                  cookieDict[c.name] = c.value;
                });
                const cookieParts: string[] = [];
                for (const [name, value] of Object.entries(cookieDict)) {
                  cookieParts.push(`${name}=${value}`);
                }
                const cookieString = cookieParts.join('; ');

                resolve({ changed: true, loggedIn: true, cookie: cookieString });
                return;
              }
            } catch (err) {
              logger.debug('获取 Cookie 失败:', err);
            }
          }

          // 检查是否出现第二个二维码（多种选择器）- 只在第一轮检测
          if (!skipSecondQRCheck) {
            try {
              let secondQR = null;
              
              // 尝试多个选择器
              const secondQRSelectors = [
                '.r-captcha-modal .qrcode-img',
                '.r-captcha-modal img',
                '[class*="captcha"] .qrcode-img',
                '[class*="captcha"] img',
                '[class*="code"] .qrcode-img',
                '[class*="code"] img',
                'img[class*="qrcode"]',
              ];
              
              for (const selector of secondQRSelectors) {
                try {
                  secondQR = await this.page.$(selector);
                  if (secondQR) {
                    logger.debug(`尝试选择器 ${selector}: ${secondQR ? '找到' : '未找到'}`);
                    break;
                  }
                } catch (e) {
                  // 继续尝试下一个
                }
              }
              
              if (secondQR && !secondQRDetected) {
                logger.info('📱 检测到第二个二维码出现');
                secondQRDetected = true;
                // 快速等待二维码完全显示
                try {
                  // 等待图片加载完成（最多 2 秒）
                  await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
                    logger.debug('等待网络空闲超时，继续');
                  });
                } catch (e) {
                  // 忽略
                }
                // 短暂等待让二维码完全渲染（1 秒足够）
                await this.page.waitForTimeout(1000);
                clearTimeout(timer);
                clearInterval(checkInterval);
                logger.info('✅ 第二个二维码已就绪，准备截图');
                resolve({ changed: true, loggedIn: false });
                return;
              }
            } catch (err) {
              // 忽略选择器错误
            }
          }

          // 检查 URL 是否变化（辅助判断）
          if (currentUrl !== lastUrl) {
            logger.info(`📄 页面 URL 已变化：${lastUrl} → ${currentUrl}`);
            lastUrl = currentUrl;
            // 不立即返回，继续观察
          }

          // 检查页面内容是否变化（确认按钮出现等，辅助判断）
          try {
            const confirmBtn = await this.page.$('[class*="confirm"]');
            const authBtn = await this.page.$('[class*="auth"]');
            const submitBtn = await this.page.$('[class*="submit"]');
            
            if (confirmBtn || authBtn || submitBtn) {
              logger.info('🔘 检测到确认/授权按钮');
              // 不立即返回，继续观察是否是第二个二维码
            }
          } catch (err) {
            // 忽略按钮检测错误
          }
        } catch (error) {
          logger.debug('检查出错:', error instanceof Error ? error.message : error);
          // 忽略错误，继续轮询
        }
      }, 2000); // 每 2 秒检查一次，平衡响应速度和性能
    });
  }

  /**
   * 清理二维码文件
   */
  private async cleanupQRCode(filepath: string): Promise<void> {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`🗑️ 已清理二维码：${filepath}`);
      }
    } catch (error) {
      logger.warn('清理二维码失败:', error);
    }
  }

  /**
   * 清理浏览器
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('🗑️ 浏览器已清理');
    } catch (error) {
      logger.warn('清理浏览器失败:', error);
    }
  }
}
