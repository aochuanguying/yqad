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
  private isRefreshing: boolean = false;

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
   * 是否正在刷新中
   */
  getIsRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * 设置状态更新回调
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * 智能刷新 Cookie（定时任务使用）
   * 
   * 逻辑：
   * 1. 先检查当前 Cookie 是否有效（通过 API 测试）
   * 2. 如果有效 → 刷新页面续期，增加有效期
   * 3. 如果无效 → 返回 requiresManualRefresh=true，不执行扫码
   * 
   * 适用场景：定时任务自动刷新（无人值守）
   */
  async smartRefreshCookie(): Promise<{ 
    success: boolean; 
    version?: number; 
    error?: string;
    requiresManualRefresh?: boolean; // 需要用户手动刷新
  }> {
    if (this.isRefreshing) {
      logger.warn('⚠️ 知乎 Cookie 刷新正在进行中，跳过本次请求');
      return { success: false, error: '刷新正在进行中，请稍后再试' };
    }
    this.isRefreshing = true;
    const startTime = Date.now();
    logger.info('🔍 开始智能检查知乎 Cookie 状态...');

    try {
      // 1. 检查当前 Cookie 是否有效
      logger.info('📡 正在测试当前 Cookie 有效性...');
      
      // 从数据库获取当前 Cookie
      const status = await this.storage.getZhihuCookieStatus();
      if (!status.hasCookie || !status.cookie) {
        logger.warn('⚠️ 数据库中没有知乎 Cookie');
        return { 
          success: false, 
          error: '数据库中没有 Cookie，请先登录',
          requiresManualRefresh: true 
        };
      }
      
      // 使用 API 测试 Cookie 有效性
      const https = await import('https');
      const isValid = await new Promise<boolean>((resolve) => {
        const req = https.get('https://www.zhihu.com/api/v4/me', {
          headers: { 'Cookie': status.cookie },
          timeout: 10000,
        }, (res: any) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });

      if (isValid) {
        // 2. Cookie 有效，注入到浏览器后刷新页面续期
        logger.info('✅ 当前知乎 Cookie 有效，注入 Cookie 到浏览器后刷新续期...');
        
        try {
          // 使用普通浏览器（非持久化），避免持久化目录的旧 Cookie 覆盖注入的有效 Cookie
          const { chromium } = await import('playwright');
          const isDocker = fs.existsSync('/.dockerenv') || process.env.NODE_ENV === 'production';
          const browser = await chromium.launch({
            headless: isDocker,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
          });
          const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
          });
          
          // 注入数据库中的有效 Cookie 到浏览器 context
          const cookieStr = status.cookie!;
          const cookiePairs = cookieStr.split(';').map(s => s.trim()).filter(s => s.includes('='));
          const cookiesToAdd = cookiePairs.map(pair => {
            const [name, ...valueParts] = pair.split('=');
            return {
              name: name.trim(),
              value: valueParts.join('=').trim(),
              domain: '.zhihu.com',
              path: '/',
            };
          });
          
          if (cookiesToAdd.length > 0) {
            await context.addCookies(cookiesToAdd);
            logger.info(`🍪 已注入 ${cookiesToAdd.length} 个 Cookie 到浏览器`);
          }
          
          const page = await context.newPage();
          
          // 访问主页（此时浏览器带有有效 Cookie，应为登录态）
          await page.goto('https://www.zhihu.com', {
            waitUntil: 'networkidle',
            timeout: 15000,
          });
          await page.waitForTimeout(2000);
          
          // 刷新页面触发续期
          await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(2000);
          
          // 提取新 Cookie
          logger.info('🍪 提取续期后的 Cookie...');
          const cookies = await context.cookies();
          const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
          const cookie = cookieString.length > 50 ? cookieString : null;
          
          await browser.close();
          
          if (cookie) {
            // 验证新 Cookie 是否真正有效
            logger.info('🔍 验证续期后的 Cookie 有效性...');
            const verifyValid = await new Promise<boolean>((resolve) => {
              const req = https.get('https://www.zhihu.com/api/v4/me', {
                headers: { 'Cookie': cookie },
                timeout: 10000,
              }, (res: any) => {
                resolve(res.statusCode === 200);
              });
              req.on('error', () => resolve(false));
              req.on('timeout', () => { req.destroy(); resolve(false); });
            });
            
            if (verifyValid) {
              const saveResult = await this.storage.saveZhihuCookie(cookie, 'auto');
              if (saveResult.success) {
                const duration = Date.now() - startTime;
                await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');
                logger.info(`✅ 知乎 Cookie 续期成功，版本：${saveResult.version}`);
                return { success: true, version: saveResult.version };
              } else {
                logger.error('❌ 保存知乎 Cookie 失败:', saveResult.error);
                return { success: false, error: saveResult.error };
              }
            } else {
              // 新 Cookie 验证失败，但原 Cookie 仍有效，不标记失败
              logger.warn('⚠️ 续期后的 Cookie 验证失败，保留原有效 Cookie，跳过本次续期');
              const duration = Date.now() - startTime;
              await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');
              return { success: true };
            }
          } else {
            // 没提取到新 Cookie，但原 Cookie 刚测试过是有效的
            const duration = Date.now() - startTime;
            await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');
            logger.info('✅ 未提取到新 Cookie，但原 Cookie 仍有效');
            return { success: true };
          }
        } catch (error) {
          logger.warn('🔄 续期过程出错，但当前 Cookie 仍然有效:', error instanceof Error ? error.message : error);
          const duration = Date.now() - startTime;
          await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');
          return { success: true }; // Cookie 仍然有效
        }
      } else {
        // 3. API 测试 Cookie 无效，尝试浏览器续期（持久化 session 可能仍有效）
        logger.warn('⚠️ API 测试知乎 Cookie 已失效，尝试浏览器续期...');
        
        const userDataDir = path.join(__dirname, '../../../scripts/zhihu_browser_data');
        
        try {
          await this.initBrowser(userDataDir);
          
          // 访问主页检查浏览器 session 是否还在
          await this.page.goto('https://www.zhihu.com', {
            waitUntil: 'networkidle',
            timeout: 15000,
          });
          await this.page.waitForTimeout(2000);
          
          // 检查认证 Cookie
          const cookies = await this.page.context().cookies();
          const cookieDict: Record<string, string> = {};
          cookies.forEach((c: any) => {
            cookieDict[c.name] = c.value;
          });
          
          const hasXsrf = cookieDict['_xsrf'] && cookieDict['_xsrf'].length > 10;
          const hasZap = cookieDict['_zap'] && cookieDict['_zap'].length > 10;
          const hasZC0 = cookieDict['z_c0'];
          const currentUrl = this.page.url();
          const isOnLoginPage = currentUrl.includes('/signin') || currentUrl.includes('/login');
          
          const isLoggedIn = hasXsrf && hasZap && hasZC0 && !isOnLoginPage;
          
          if (isLoggedIn) {
            // 浏览器 session 有效，刷新续期
            logger.info('✅ 浏览器 session 仍然有效，刷新页面续期...');
            await this.page.reload({ waitUntil: 'networkidle', timeout: 15000 });
            await this.page.waitForTimeout(2000);
            
            const cookie = await this.extractCookie();
            if (cookie) {
              // 验证新 Cookie 是否真正有效
              logger.info('🔍 验证浏览器续期后的 Cookie 有效性...');
              const verifyValid = await new Promise<boolean>((resolve) => {
                const req = https.get('https://www.zhihu.com/api/v4/me', {
                  headers: { 'Cookie': cookie },
                  timeout: 10000,
                }, (res: any) => {
                  resolve(res.statusCode === 200);
                });
                req.on('error', () => resolve(false));
                req.on('timeout', () => { req.destroy(); resolve(false); });
              });
              
              if (verifyValid) {
                const saveResult = await this.storage.saveZhihuCookie(cookie, 'auto');
                if (saveResult.success) {
                  logger.info(`✅ 浏览器续期成功，版本：${saveResult.version}`);
                  const duration = Date.now() - startTime;
                  await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');
                  await this.cleanup();
                  return { success: true, version: saveResult.version };
                }
              } else {
                logger.warn('⚠️ 浏览器续期后 Cookie 验证失败');
                // 不保存无效 Cookie，走后面的失效逻辑
              }
            }
          }
          
          // 浏览器 session 也失效了
          logger.warn('⚠️ 浏览器 session 也已失效，需要手动刷新');
          await this.cleanup();
        } catch (browserError) {
          logger.warn('浏览器续期尝试失败:', browserError instanceof Error ? browserError.message : browserError);
          await this.cleanup();
        }
        
        // 真正失效：记录失败日志
        await this.storage.updateRefreshLog(Date.now() - startTime, 'failed', 'Cookie 已失效，需要手动刷新', 'zhihu');
        return { 
          success: false, 
          error: '知乎 Cookie 已失效，请在 Web 页面手动刷新',
          requiresManualRefresh: true 
        };
      }
    } catch (error) {
      logger.error('❌ 智能刷新知乎 Cookie 失败:', error instanceof Error ? error.message : error);
      await this.cleanup();
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '智能刷新失败' 
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 刷新 Cookie
   */
  async refreshCookie(): Promise<{ success: boolean; version?: number; error?: string }> {
    if (this.isRefreshing) {
      logger.warn('⚠️ 知乎 Cookie 刷新正在进行中，跳过本次请求');
      return { success: false, error: '刷新正在进行中，请稍后再试' };
    }
    this.isRefreshing = true;
    const startTime = Date.now();
    logger.info('🔄 开始刷新知乎 Cookie...');

    try {
      // 使用持久化浏览器数据目录，保持登录状态
      const userDataDir = path.join(__dirname, '../../../scripts/zhihu_browser_data');
      logger.info(`📂 使用用户数据目录：${userDataDir}`);

      // 初始化浏览器
      await this.initBrowser(userDataDir);

      // 先检查是否已登录
      logger.info('🔍 检查是否已登录...');
      try {
        await this.page.goto('https://www.zhihu.com', {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        await this.page.waitForTimeout(2000);
        
        // 检查认证 Cookie
        const cookies = await this.page.context().cookies();
        const cookieDict: Record<string, string> = {};
        cookies.forEach((c: any) => {
          cookieDict[c.name] = c.value;
        });
        
        const hasXsrf = cookieDict['_xsrf'] && cookieDict['_xsrf'].length > 10;
        const hasZap = cookieDict['_zap'] && cookieDict['_zap'].length > 10;
        const hasZC0 = cookieDict['z_c0'];
        
        const isLoggedIn = hasXsrf && hasZap && hasZC0;
        const currentUrl = this.page.url();
        const isOnLoginPage = currentUrl.includes('/signin') || currentUrl.includes('/login');
        
        if (isLoggedIn && !isOnLoginPage) {
          logger.info('✅ 检测到已登录状态');
          
          // 主动续期：刷新页面触发网站重新颁发 Cookie
          logger.info('🔄 正在刷新页面以续期 Cookie...');
          await this.page.reload({ waitUntil: 'networkidle', timeout: 15000 });
          await this.page.waitForTimeout(2000);
          
          // 获取续期后的新 Cookie
          logger.info('🍪 获取续期后的 Cookie...');
          const cookie = await this.extractCookie();
          if (cookie) {
            const saveResult = await this.storage.saveZhihuCookie(cookie, 'auto');
            if (saveResult.success) {
              logger.info(`✅ 知乎 Cookie 自动续期成功，版本：${saveResult.version}`);
              const duration = Date.now() - startTime;
              await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');
              await this.cleanup();
              return { success: true, version: saveResult.version };
            }
          }
        }
        
        logger.info('⚠️ 未检测到登录状态，需要重新登录');
      } catch (error) {
        logger.warn('检查登录状态失败，进入扫码流程:', error instanceof Error ? error.message : error);
      }

      // 打开登录页面
      logger.info('📱 打开知乎登录页面...');
      this.statusCallback?.({
        status: 'generating',
        message: '正在打开登录页面...',
      });

      logger.info('🌐 正在加载知乎登录页面...');
      
      // 先访问首页，再跳转到登录页
      await this.page.goto('https://www.zhihu.com', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      // 点击登录按钮
      try {
        await this.page.click('a[href="/signin"]', { timeout: 5000 });
        await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
      } catch (error) {
        logger.warn('点击登录按钮失败，直接跳转到登录页');
        await this.page.goto('https://www.zhihu.com/signin?next=%2F', {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      }

      // 保存页面截图用于调试
      const debugPath = path.join(process.cwd(), 'data', 'qr_codes', `zhihu_debug_${Date.now()}.png`);
      await this.page.screenshot({ path: debugPath, fullPage: true });
      logger.info(`📸 页面调试截图已保存：${debugPath}`);
      
      // 保存页面 HTML 用于调试
      const htmlPath = path.join(process.cwd(), 'data', 'qr_codes', `zhihu_debug_${Date.now()}.html`);
      const htmlContent = await this.page.content();
      fs.writeFileSync(htmlPath, htmlContent);
      logger.info(`📄 页面 HTML 已保存：${htmlPath}`);
      
      // 输出页面标题和 URL
      const pageTitle = await this.page.title();
      const pageUrl = this.page.url();
      logger.info(`📄 页面标题：${pageTitle}`);
      logger.info(`🔗 页面 URL: ${pageUrl}`);
      
      // 等待二维码元素出现（最多等待 30 秒）
      logger.info('⏳ 等待二维码加载...');
      
      // 尝试多种可能的二维码 selector
      const qrSelectors = [
        'canvas.Qrcode-qrcode',
        'canvas[qrcode]',
        '.qrcode-canvas',
        'img.qrcode-img',
        '.login-qrcode img',
      ];
      
      let qrFound = false;
      for (const selector of qrSelectors) {
        try {
          await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
          logger.info(`✅ 找到二维码元素：${selector}`);
          qrFound = true;
          break;
        } catch (error) {
          logger.debug(`Selector ${selector} 未找到`);
        }
      }
      
      if (!qrFound) {
        logger.warn('未找到二维码元素，继续等待 10 秒后重试');
        await this.page.waitForTimeout(10000);
        
        // 再次尝试
        for (const selector of qrSelectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              logger.info(`✅ 二次检查找到二维码元素：${selector}`);
              qrFound = true;
              break;
            }
          } catch (error) {
            // ignore
          }
        }
      }
      
      if (!qrFound) {
        logger.error('❌ 仍未找到二维码元素，可能页面加载失败或被反爬');
        // 再次保存截图
        const debugPath2 = path.join(process.cwd(), 'data', 'qr_codes', `zhihu_debug_failed_${Date.now()}.png`);
        await this.page.screenshot({ path: debugPath2, fullPage: true });
        logger.info(`📸 失败调试截图已保存：${debugPath2}`);
      }

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
      const cookieType = typeof scanResult.cookie;
      const cookieLen = scanResult.cookie?.length || 0;
      const cookiePreview = scanResult.cookie ? scanResult.cookie.substring(0, 100) : 'N/A';
      logger.info(`✅ 登录成功，scanResult: 类型=${cookieType}, 长度=${cookieLen}, 预览=${cookiePreview}...`);
      
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
      
      logger.info('💾 准备保存的 Cookie 长度:', cookie.length);
      logger.info('💾 准备保存的 Cookie 预览:', cookie.substring(0, 100) + '...');

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
      await this.storage.updateRefreshLog(duration, 'success', undefined, 'zhihu');

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
      await this.storage.updateRefreshLog(Date.now() - startTime, 'failed', errorMessage, 'zhihu');
      this.statusCallback?.({
        status: 'failed',
        message: errorMessage,
      });
      await this.cleanup();
      return { success: false, error: errorMessage };
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 初始化浏览器（参考小红书实现）
   */
  private async initBrowser(userDataDir: string): Promise<void> {
    try {
      const { chromium } = await import('playwright');

      const qrCodeDir = path.join(process.cwd(), 'data', 'qr_codes');
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
      }

      // 确保用户数据目录存在
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      logger.info(`📁 浏览器用户数据目录：${userDataDir}`);
      logger.info('ℹ️ 使用持久化目录以保持登录状态');

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
      this.browser = context; // 保存引用以便 cleanup 时关闭
      
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
    // 多种可能的二维码 selector
    const selectors = [
      'canvas.Qrcode-qrcode',
      'canvas[qrcode]',
      '.qrcode-canvas',
      'canvas[data-testid="qrcode"]',
    ];
    let qrcodeElement = null;
    let matchedSelector = '';
    
    // 等待页面稳定
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      logger.warn('等待网络空闲超时，继续尝试');
    });
    
    await this.page.waitForTimeout(2000);

    // 尝试多种 selector 查找二维码 canvas 元素
    for (const selector of selectors) {
      try {
        qrcodeElement = await this.page.$(selector);
        if (qrcodeElement) {
          matchedSelector = selector;
          logger.info(`✅ 找到知乎二维码：${selector}`);
          break;
        }
      } catch (error) {
        logger.debug(`Selector ${selector} 未找到`);
      }
    }
    
    if (!qrcodeElement) {
      logger.warn('未找到二维码元素，尝试截取整个页面');
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
      let stopped = false;

      const getPollingInterval = () => {
        if (checkCount <= 10) return 1000;
        if (checkCount <= 30) return 2000;
        return 3000;
      };

      const scheduleNextCheck = () => {
        if (stopped) return;
        setTimeout(doCheck, getPollingInterval());
      };

      const doCheck = async () => {
        if (stopped) return;
        checkCount++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        try {
          // 定期输出状态
          if (elapsed % 10 === 0) {
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
            stopped = true;
            clearTimeout(timer);

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
            logger.info(`✅ 提取 Cookie 成功，包含 ${cookieParts.length} 个字段，长度：${cookieString.length}`);
            logger.info('🔍 cookieString 类型:', typeof cookieString);
            logger.info('🔍 cookieString 前 200 字符:', cookieString.substring(0, 200) + '...');
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

        // 安排下一次检查
        scheduleNextCheck();
      };

      // 启动第一次检查
      scheduleNextCheck();
    });
  }

  /**
   * 清理二维码文件
   */
  private async cleanupQRCode(filepath: string): Promise<void> {
    try {
      // 清理 7 天前的旧二维码文件
      const qrCodeDir = path.join(process.cwd(), 'data', 'qr_codes');
      if (fs.existsSync(qrCodeDir)) {
        const files = fs.readdirSync(qrCodeDir);
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let cleanedCount = 0;
        for (const file of files) {
          const filePath = path.join(qrCodeDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < sevenDaysAgo) {
              fs.unlinkSync(filePath);
              cleanedCount++;
            }
          } catch (e) {
            // 忽略单个文件的清理错误
          }
        }
        if (cleanedCount > 0) {
          logger.info(`🗑️ 已清理 ${cleanedCount} 个过期二维码/调试文件`);
        }
      }
    } catch (error) {
      logger.warn('清理二维码失败:', error);
    }
  }

  /**
   * 提取 Cookie（通用方法）
   */
  private async extractCookie(): Promise<string | null> {
    try {
      const cookies = await this.page.context().cookies();
      const cookieDict: Record<string, string> = {};
      cookies.forEach((c: any) => {
        cookieDict[c.name] = c.value;
      });
      
      // 优先提取关键字段
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
      logger.info(`🍪 提取 Cookie 成功，长度：${cookieString.length}, 字段数：${cookieParts.length}`);
      return cookieString;
    } catch (error) {
      logger.error('提取 Cookie 失败:', error instanceof Error ? error.message : error);
      return null;
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
      
      // 不清理持久化浏览器数据目录，保持登录状态
      // 持久化目录位于 scripts/zhihu_browser_data，由 initBrowser 使用
      
      const duration = Date.now() - cleanupStartTime;
      logger.info(`🗑️ 浏览器已清理（耗时：${duration}ms）`);
    } catch (error) {
      logger.warn('清理浏览器失败:', error instanceof Error ? error.message : error);
      this.page = null;
      this.browser = null;
    }
  }
}
