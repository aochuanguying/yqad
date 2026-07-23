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
  private isRefreshing: boolean = false;

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
      logger.warn('⚠️ Cookie 刷新正在进行中，跳过本次请求');
      return { success: false, error: '刷新正在进行中，请稍后再试' };
    }
    this.isRefreshing = true;
    const startTime = Date.now();
    logger.info('🔍 开始智能检查 Cookie 状态...');

    try {
      // 1. 检查当前 Cookie 是否有效
      logger.info('📡 正在测试当前 Cookie 有效性...');
      const { XiaohongshuSearch } = await import('../../services/internet-search/xiaohongshu-search');
      const searchService = new XiaohongshuSearch();
      await searchService.initialize(); // 加载 Cookie
      const testResult = await searchService.testConnection();

      if (testResult.success) {
        // 2. Cookie 有效，注入到浏览器后刷新页面续期
        logger.info('✅ 当前 Cookie 有效，注入 Cookie 到浏览器后刷新续期...');
        
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
          const currentCookie = (searchService as any).config?.cookie || '';
          if (currentCookie) {
            const cookiePairs = currentCookie.split(';').map((s: string) => s.trim()).filter((s: string) => s.includes('='));
            const cookiesToAdd = cookiePairs.map((pair: string) => {
              const [name, ...valueParts] = pair.split('=');
              return {
                name: name.trim(),
                value: valueParts.join('=').trim(),
                domain: '.xiaohongshu.com',
                path: '/',
              };
            });
            
            if (cookiesToAdd.length > 0) {
              await context.addCookies(cookiesToAdd);
              logger.info(`🍪 已注入 ${cookiesToAdd.length} 个 Cookie 到浏览器`);
            }
          }
          
          const page = await context.newPage();
          
          // 访问主页（此时浏览器带有有效 Cookie，应为登录态）
          await page.goto('https://www.xiaohongshu.com', {
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
            const verifyService = new XiaohongshuSearch();
            (verifyService as any).config = { cookie };
            const verifyResult = await verifyService.testConnection();
            
            if (verifyResult.success) {
              const saveResult = await this.storage.saveCookie(cookie, 'auto');
              if (saveResult.success) {
                const duration = Date.now() - startTime;
                await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
                logger.info(`✅ Cookie 续期成功，版本：${saveResult.version}`);
                await this.cleanup();
                return { success: true, version: saveResult.version };
              } else {
                logger.error('❌ 保存 Cookie 失败:', saveResult.error);
                await this.cleanup();
                return { success: false, error: saveResult.error };
              }
            } else {
              // 新 Cookie 验证失败，但原 Cookie 仍有效（第一步已验证），不覆盖、不标记失败
              logger.warn(`⚠️ 续期后的 Cookie 验证失败：${verifyResult.error}，保留原有效 Cookie，跳过本次续期`);
              const duration = Date.now() - startTime;
              await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
              await this.cleanup();
              return { success: true }; // 原 Cookie 仍有效
            }
          } else {
            // 没提取到新 Cookie，但原 Cookie 刚测试过是有效的
            const duration = Date.now() - startTime;
            await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
            logger.info('✅ 未提取到新 Cookie，但原 Cookie 仍有效');
            await this.cleanup();
            return { success: true };
          }
        } catch (error) {
          logger.warn('🔄 续期过程出错，但当前 Cookie 仍然有效:', error instanceof Error ? error.message : error);
          await this.cleanup();
          const duration = Date.now() - startTime;
          await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
          return { success: true }; // Cookie 仍然有效
        }
      } else {
        // 3. API 测试 Cookie 无效，尝试浏览器续期（持久化 session 可能仍有效）
        logger.warn('⚠️ API 测试 Cookie 已失效，尝试浏览器续期...');
        
        try {
          await this.initBrowser();
          
          // 访问主页检查浏览器 session 是否还在
          await this.page.goto('https://www.xiaohongshu.com', {
            waitUntil: 'networkidle',
            timeout: 15000,
          });
          await this.page.waitForTimeout(2000);
          
          // 检查是否有认证 Cookie
          const cookies = await this.page.context().cookies();
          const hasAuthCookie = cookies.some((c: any) => 
            c.name === 'a1' || c.name === 'web_session' || c.name === 'id_token'
          );
          const currentUrl = this.page.url();
          const isLoggedIn = hasAuthCookie && !currentUrl.includes('/login');
          
          if (isLoggedIn) {
            // 浏览器 session 有效，刷新续期
            logger.info('✅ 浏览器 session 仍然有效，刷新页面续期...');
            await this.page.reload({ waitUntil: 'networkidle', timeout: 15000 });
            await this.page.waitForTimeout(2000);
            
            const cookie = await this.extractCookie();
            if (cookie) {
              // 验证新 Cookie 是否真正有效
              logger.info('🔍 验证浏览器续期后的 Cookie 有效性...');
              const { XiaohongshuSearch } = await import('../../services/internet-search/xiaohongshu-search');
              const verifyService = new XiaohongshuSearch();
              (verifyService as any).config = { cookie };
              const verifyResult = await verifyService.testConnection();
              
              if (verifyResult.success) {
                const saveResult = await this.storage.saveCookie(cookie, 'auto');
                if (saveResult.success) {
                  logger.info(`✅ 浏览器续期成功，版本：${saveResult.version}`);
                  const duration = Date.now() - startTime;
                  await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
                  await this.cleanup();
                  return { success: true, version: saveResult.version };
                }
              } else {
                logger.warn(`⚠️ 浏览器续期后 Cookie 验证失败：${verifyResult.error}`);
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
        await this.storage.updateRefreshLog(Date.now() - startTime, 'failed', 'Cookie 已失效，需要手动刷新', 'xiaohongshu');
        return { 
          success: false, 
          error: 'Cookie 已失效，请在 Web 页面手动刷新',
          requiresManualRefresh: true 
        };
      }
    } catch (error) {
      logger.error('❌ 智能刷新 Cookie 失败:', error instanceof Error ? error.message : error);
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
   * 刷新 Cookie（兼容一次扫码和两次扫码）
   */
  async refreshCookie(): Promise<{ success: boolean; version?: number; error?: string }> {
    if (this.isRefreshing) {
      logger.warn('⚠️ Cookie 刷新正在进行中，跳过本次请求');
      return { success: false, error: '刷新正在进行中，请稍后再试' };
    }
    this.isRefreshing = true;
    const startTime = Date.now();
    logger.info('🔄 开始刷新 Cookie...');

    try {
      // 初始化浏览器
      await this.initBrowser();

      // 先检查是否已登录（通过访问主页）
      logger.info('🔍 检查是否已登录...');
      try {
        await this.page.goto('https://www.xiaohongshu.com', {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        await this.page.waitForTimeout(2000);
        
        // 检查是否有认证 Cookie
        const cookies = await this.page.context().cookies();
        const hasAuthCookie = cookies.some((c: any) => 
          c.name === 'a1' || c.name === 'web_session' || c.name === 'id_token'
        );
        
        // 检查是否在主页（不在登录页）
        const currentUrl = this.page.url();
        const isLoggedIn = hasAuthCookie && !currentUrl.includes('/login');
        
        if (isLoggedIn) {
          logger.info('✅ 检测到已登录状态');
          
          // 主动续期：刷新页面触发网站重新颁发 Cookie
          logger.info('🔄 正在刷新页面以续期 Cookie...');
          await this.page.reload({ waitUntil: 'networkidle', timeout: 15000 });
          await this.page.waitForTimeout(2000);
          
          // 获取续期后的新 Cookie
          logger.info('🍪 获取续期后的 Cookie...');
          const cookie = await this.extractCookie();
          if (cookie) {
            const saveResult = await this.storage.saveCookie(cookie, 'auto');
            if (saveResult.success) {
              logger.info(`✅ Cookie 自动续期成功，版本：${saveResult.version}`);
              const duration = Date.now() - startTime;
              await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
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
      logger.info('📱 打开小红书登录页面...');
      this.statusCallback?.({
        status: 'generating',
        message: '正在打开登录页面...',
      });

      await this.page.goto('https://www.xiaohongshu.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // 等待页面加载
      await this.page.waitForTimeout(2000);

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

        // 等待扫码或页面变化（优化：第一轮 3 分钟，第二轮 2 分钟）
        // 第二轮扫码时跳过第二个二维码检测，直接等待登录成功
        logger.info(`⏳ 等待第 ${scanRound} 轮扫码...`);
        const scanTimeout = scanRound === 1 ? 180000 : 120000; // 3 分钟 / 2 分钟
        const scanResult = await this.waitForScanOrLogin(scanTimeout, scanRound === 2);
        
        // 立即检查 scanResult
        logger.info('🔍 scanResult 原始值:', JSON.stringify({
          changed: scanResult.changed,
          loggedIn: scanResult.loggedIn,
          hasCookie: !!scanResult.cookie,
          cookieLength: scanResult.cookie?.length,
          cookieType: typeof scanResult.cookie
        }));
        
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
          const cookieLen = scanResult.cookie?.length || 0;
          const cookieType = typeof scanResult.cookie;
          const cookiePreview = scanResult.cookie ? scanResult.cookie.substring(0, 50) : 'N/A';
          
          logger.info(`✅ 登录成功，scanResult: changed=${scanResult.changed}, loggedIn=${scanResult.loggedIn}, cookie 长度=${cookieLen}, 类型=${cookieType}, 预览=${cookiePreview}...`);
          
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

          // 验证 Cookie 有效性（非阻塞，不等待完成）
          logger.info('🔍 正在验证 Cookie 有效性...（后台运行）');
          (async () => {
            try {
              const { XiaohongshuSearch } = await import('../../services/internet-search/xiaohongshu-search');
              const searchService = new XiaohongshuSearch();
              await searchService.initialize(); // 加载 Cookie
              const testResult = await searchService.testConnection();
              
              if (testResult.success) {
                logger.info(`✅ Cookie 验证成功！获取到 ${testResult.resultCount} 条结果`);
              } else {
                logger.warn('⚠️ Cookie 验证失败，但已保存到数据库:', testResult.error);
              }
            } catch (error) {
              logger.warn('⚠️ Cookie 验证过程出错:', error instanceof Error ? error.message : error);
            }
          })();

          // 更新日志
          logger.info('📊 更新刷新日志...');
          const duration = Date.now() - startTime;
          const logStartTime = Date.now();
          await this.storage.updateRefreshLog(duration, 'success', undefined, 'xiaohongshu');
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
        await this.page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {
          logger.warn('等待页面加载超时，继续尝试');
        });
        await this.page.waitForTimeout(5000); // 优化：5 秒足够让第二个二维码加载
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
      await this.storage.updateRefreshLog(Date.now() - startTime, 'failed', errorMessage, 'xiaohongshu');
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
   * 初始化浏览器（支持持久化用户数据）
   */
  private async initBrowser(): Promise<void> {
    try {
      // @ts-ignore - Playwright 动态导入
      const { chromium } = await import('playwright');

      const qrCodeDir = path.join(process.cwd(), 'data', 'qr_codes');
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
      }

      // 浏览器用户数据持久化目录（每次刷新都使用新目录，确保干净环境）
      // 使用固定的持久化用户数据目录
      const userDataDir = path.join(process.cwd(), 'data', 'browser_user_data', 'xiaohongshu');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      logger.info(`📁 浏览器用户数据目录：${userDataDir}`);
      logger.info('ℹ️ 使用持久化目录以保持登录状态');

      // 检测是否在 Docker 容器中运行（多种检测方式）
      const isDocker = fs.existsSync('/.dockerenv') || 
                      fs.existsSync('/proc/1/cgroup') && 
                      fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker') ||
                      process.env.NODE_ENV === 'production';
      
      // 浏览器启动超时保护（30 秒）
      const browserLaunchPromise = chromium.launchPersistentContext(userDataDir, {
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
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        permissions: ['geolocation'],
        geolocation: { latitude: 31.2304, longitude: 121.4737 }, // 上海坐标
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('浏览器启动超时（30 秒）')), 30000)
      );

      // persistentContext 直接返回 BrowserContext，不需要再创建 context
      const context = await Promise.race([browserLaunchPromise, timeoutPromise]);
      this.browser = context; // 保存引用以便 cleanup 时关闭
      
      logger.info(`浏览器启动成功（模式：${isDocker ? 'Docker 无头' : '本地有头'}，持久化：${userDataDir}）`);

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

      logger.info('✅ 浏览器初始化成功（反检测模式 + 持久化）');
    } catch (error) {
      logger.error('❌ 浏览器���始化失败:', error);
      throw new Error('Playwright 初始化失败，请确保已安装：npm install playwright');
    }
  }

  /**
   * 截取二维码（通用方法，优化截图时机）
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
    
    // 等待页面稳定（优化超时时间）
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      logger.warn('等待网络空闲超时，继续尝试');
    });
    
    // 第二个二维码需要更多等待时间，确保完全渲染
    const waitTime = isSecondQR ? 2000 : 1500; // 优化：减少等待时间
    await this.page.waitForTimeout(waitTime);

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
        
        // 第二个二维码需要更多等待时间确保完全渲染
        await this.page.waitForTimeout(isSecondQR ? 1000 : 500);
        
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

      let stopped = false;

      const scheduleNextCheck = () => {
        if (stopped) return;
        setTimeout(doCheck, getPollingInterval());
      };

      const doCheck = async () => {
        if (stopped) return;
        checkCount++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        try {
          const currentUrl = this.page.url();

          // 定期输出状态（每 10 秒）
          if (elapsed % 10 === 0) {
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
                
                // 使用原始 Cookie（不刷新页面，避免 Cookie 丢失）
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
                    delete cookieDict[key];
                  }
                }
                for (const [name, value] of Object.entries(cookieDict)) {
                  cookieParts.push(`${name}=${value}`);
                }
                const cookieString = cookieParts.join('; ');
                
                // 使用字符串模板确保输出
                const logMsg = `✅ Cookie: 长度=${cookieString.length}, 字段数=${cookieParts.length}, 前 100 字符=${cookieString.substring(0, 100)}`;
                logger.info(logMsg);
                
                stopped = true;
                clearTimeout(timer);
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
                stopped = true;
                clearTimeout(timer);
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

        // 安排下一次检查
        scheduleNextCheck();
      };

      // 启动第一次检查
      scheduleNextCheck();
    });
  }

  /**
   * 提取 Cookie（通用方法）
   */
  private async extractCookie(): Promise<string | null> {
    try {
      const cookies = await this.page.context().cookies();
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
          delete cookieDict[key];
        }
      }
      for (const [name, value] of Object.entries(cookieDict)) {
        cookieParts.push(`${name}=${value}`);
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
   * 清理二维码文件（保留最近的 3 个用于问题排查）
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
   * 清理浏览器（增强错误处理和进程泄漏防护）
   */
  private async cleanup(): Promise<void> {
    const cleanupStartTime = Date.now();
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
      
      // 再关闭浏览器（使用超时保护）
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
      
      // 不再清理持久化浏览器数据目录，保持登录状态
      // const userDataDir = path.join(process.cwd(), 'data', 'browser_user_data');
      // ... (保留用户数据)
    } catch (error) {
      logger.warn('清理浏览器失败:', error instanceof Error ? error.message : error);
      // 即使失败也要重置引用
      this.page = null;
      this.browser = null;
    }
  }
}
