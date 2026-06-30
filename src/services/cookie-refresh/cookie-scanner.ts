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

      // 检测是否在 Docker 容器中运行（多种检测方式）
      const isDocker = fs.existsSync('/.dockerenv') || 
                      fs.existsSync('/proc/1/cgroup') && 
                      fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker') ||
                      process.env.NODE_ENV === 'production';
      
      // 浏览器启动超时保护（30 秒）
      const browserLaunchPromise = chromium.launch({
        headless: isDocker, // Docker 中使用无头模式，本地使用有头模式
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled', // 隐藏自动化标志
          '--window-size=1920,1080',
          // Docker 中需要的额外参数
          ...(isDocker ? ['--disable-gpu', '--disable-software-rasterizer'] : []),
        ],
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('浏览器启动超时（30 秒）')), 30000)
      );

      this.browser = await Promise.race([browserLaunchPromise, timeoutPromise]);
      
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
    // 精确选择器：第一个二维码 - .login-container 下的 img.qrcode-img
    const firstQRSelector = '.login-container img.qrcode-img';
    
    // 精确选择器：第二个二维码 - .r-captcha-modal 下的 img.qrcode-img
    const secondQRSelector = '.r-captcha-modal img.qrcode-img';
    
    const selector = isSecondQR ? secondQRSelector : firstQRSelector;
    let qrcodeElement = null;
    
    // 等待页面稳定
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      logger.warn('等待网络空闲超时，继续尝试');
    });
    await this.page.waitForTimeout(2000);

    // 使用精确选择器查找二维码
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 10000 }).catch(() => null);
      qrcodeElement = await this.page.$(selector);
      if (qrcodeElement) {
        logger.info(`找到${isSecondQR ? '第二个' : '第一个'}二维码：${selector}`);
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
        // 确保元素在视图中
        await qrcodeElement.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
        await this.page.waitForTimeout(500); // 等待滚动完成
        
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
      logger.warn(`未找到二维码元素，截取整个页面`);
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
      let consecutiveNotLoginCount = 0; // 连续未登录检测计数

      // 智能轮询间隔：初期快（1 秒），后期慢（3 秒）
      const getPollingInterval = () => {
        if (checkCount <= 10) return 1000; // 前 10 秒：每秒检测
        if (checkCount <= 30) return 2000; // 10-60 秒：每 2 秒检测
        return 3000; // 60 秒后：每 3 秒检测
      };

      const checkInterval = setInterval(async () => {
        checkCount++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        try {
          const currentUrl = this.page.url();

          // 定期输出状态（每 10 秒）
          if (checkCount % (10 / (getPollingInterval() / 1000)) === 0) {
            logger.debug(`等待中... (${elapsed}秒) URL: ${currentUrl}`);
          }

          // 精确登录检测：必须检测到认证 Cookie
          const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/captcha');
          
          if (!isLoginPage) {
            // 不在登录页，获取 Cookie 确认是否真的登录成功
            try {
              const cookies = await this.page.context().cookies();
              
              // 小红书关键 Cookie 字段
              const hasAuthCookie = cookies.some((c: any) => 
                c.name === 'a1' || 
                c.name === 'web_session' || 
                c.name === 'session_id' ||
                c.name.includes('session') ||
                c.name.includes('token')
              );
              
              if (hasAuthCookie) {
                logger.info(`🎉 确认登录成功（URL: ${currentUrl}），找到认证 Cookie`);
                clearTimeout(timer);
                clearInterval(checkInterval);

                // 精确提取 Cookie 关键字段
                const cookieDict: Record<string, string> = {};
                const priorityKeys = ['a1', 'web_session', 'session_id', 'gid', 'api_settings', 'iminfo'];
                
                cookies.forEach((c: any) => {
                  cookieDict[c.name] = c.value;
                });
                
                // 优先提取关键字段，然后补充其他字段
                const cookieParts: string[] = [];
                for (const key of priorityKeys) {
                  if (cookieDict[key]) {
                    cookieParts.push(`${key}=${cookieDict[key]}`);
                    delete cookieDict[key]; // 避免重复
                  }
                }
                // 添加剩余 Cookie
                for (const [name, value] of Object.entries(cookieDict)) {
                  cookieParts.push(`${name}=${value}`);
                }
                const cookieString = cookieParts.join('; ');

                logger.info(`✅ 提取 Cookie 成功，包含 ${cookieParts.length} 个字段`);
                resolve({ changed: true, loggedIn: true, cookie: cookieString });
                return;
              } else {
                consecutiveNotLoginCount++;
                // 连续 3 次检测到不在登录页但无认证 Cookie，可能是异常跳转
                if (consecutiveNotLoginCount >= 3) {
                  logger.warn('⚠️ 连续检测到不在登录页但无认证 Cookie，可能异常跳转');
                }
              }
            } catch (err) {
              logger.debug('获取 Cookie 失败:', err);
              consecutiveNotLoginCount++;
            }
          } else {
            consecutiveNotLoginCount = 0; // 重置计数器
          }

          // 检查是否出现第二个二维码（使用精确选择器）- 只在第一轮检测
          if (!skipSecondQRCheck) {
            try {
              // 精确选择器：.r-captcha-modal 下的 img.qrcode-img
              const secondQRSelector = '.r-captcha-modal img.qrcode-img';
              const secondQR = await this.page.$(secondQRSelector);
              
              if (secondQR && !secondQRDetected) {
                logger.info('📱 检测到第二个二维码出现');
                secondQRDetected = true;
                
                // 快速等待二维码完全显示
                try {
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
            consecutiveNotLoginCount = 0; // 重置计数器
          }
        } catch (error) {
          logger.debug('检查出错:', error instanceof Error ? error.message : error);
          // 忽略错误，继续轮询
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
        fs.unlinkSync(filepath);
        logger.info(`🗑️ 已清理二维码：${filepath}`);
      }
    } catch (error) {
      logger.warn('清理二维码失败:', error);
    }
  }

  /**
   * 清理浏览器（增强错误处理）
   */
  private async cleanup(): Promise<void> {
    try {
      // 先关闭页面
      if (this.page) {
        try {
          await this.page.close();
          logger.debug('页面已关闭');
        } catch (pageError) {
          logger.debug('关闭页面时出错（可能已关闭）:', pageError instanceof Error ? pageError.message : pageError);
        }
        this.page = null;
      }
      
      // 再关闭浏览器
      if (this.browser) {
        try {
          await this.browser.close();
          logger.debug('浏览器已关闭');
        } catch (browserError) {
          logger.debug('关闭浏览器时出错（可能已关闭）:', browserError instanceof Error ? browserError.message : browserError);
        }
        this.browser = null;
      }
      
      logger.info('🗑️ 浏览器已清理');
    } catch (error) {
      logger.warn('清理浏览器失败:', error instanceof Error ? error.message : error);
    }
  }
}
