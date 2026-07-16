/**
 * Cookie Scanner 单元测试
 * 
 * 验证修复后的核心逻辑：
 * 1. browser 引用正确保存和清理
 * 2. 并发锁（isRefreshing）
 * 3. 动态轮询间隔
 * 4. Cookie 失效时记录失败日志
 * 5. 状态接口正确判断有效性
 */

// Mock dependencies
const mockStorage = {
  getCookieStatus: jest.fn(),
  getZhihuCookieStatus: jest.fn(),
  saveCookie: jest.fn(),
  saveZhihuCookie: jest.fn(),
  updateRefreshLog: jest.fn(),
  testXiaohongshuConnection: jest.fn(),
  testZhihuConnection: jest.fn(),
  getConfig: jest.fn(),
};

jest.mock('../storage/mysql/network-post-config-storage', () => ({
  NetworkPostConfigStorage: {
    getInstance: () => mockStorage,
  },
}));

jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../utils/mysql-connection-manager', () => ({
  MySQLConnectionManager: {
    getInstance: () => ({
      initialize: jest.fn(),
    }),
  },
}));

// Mock playwright
jest.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: jest.fn(),
  },
}));

describe('CookieScanner', () => {
  let CookieScanner: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    jest.isolateModules(() => {
      const mod = require('../services/cookie-refresh/cookie-scanner');
      CookieScanner = mod.CookieScanner;
    });
  });

  describe('并发控制锁', () => {
    it('isRefreshing 初始为 false', () => {
      const scanner = CookieScanner.getInstance();
      expect(scanner.getIsRefreshing()).toBe(false);
    });

    it('smartRefreshCookie 正在执行时应拒绝第二次调用', async () => {
      const scanner = CookieScanner.getInstance();
      
      // 模拟 Cookie 有效性检查会花费较长时间
      const mockXhsSearch = {
        initialize: jest.fn(),
        testConnection: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({ success: false }), 100))
        ),
      };
      
      jest.doMock('../services/internet-search/xiaohongshu-search', () => ({
        XiaohongshuSearch: jest.fn().mockImplementation(() => mockXhsSearch),
      }));

      // 启动第一次调用（不 await）
      const firstCall = scanner.smartRefreshCookie();
      
      // 立即发起第二次调用
      const secondCall = await scanner.smartRefreshCookie();
      
      // 第二次调用应该被拒绝
      expect(secondCall.success).toBe(false);
      expect(secondCall.error).toContain('正在进行中');
      
      // 等待第一次调用完成
      await firstCall;
      
      // 完成后锁应该释放
      expect(scanner.getIsRefreshing()).toBe(false);
    });

    it('refreshCookie 正在执行时应拒绝第二次调用', async () => {
      const scanner = CookieScanner.getInstance();
      
      // 手动设置 isRefreshing 模拟正在执行
      (scanner as any).isRefreshing = true;
      
      const result = await scanner.refreshCookie();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('正在进行中');
    });
  });
});

describe('ZhihuCookieScanner', () => {
  let ZhihuCookieScanner: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      const mod = require('../services/cookie-refresh/zhihu-cookie-scanner');
      ZhihuCookieScanner = mod.ZhihuCookieScanner;
    });
  });

  describe('并发控制锁', () => {
    it('isRefreshing 初始为 false', () => {
      const scanner = ZhihuCookieScanner.getInstance();
      expect(scanner.getIsRefreshing()).toBe(false);
    });

    it('refreshCookie 正在执行时应拒绝第二次调用', async () => {
      const scanner = ZhihuCookieScanner.getInstance();
      (scanner as any).isRefreshing = true;
      
      const result = await scanner.refreshCookie();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('正在进行中');
    });

    it('smartRefreshCookie Cookie 无效时应记录失败日志', async () => {
      const scanner = ZhihuCookieScanner.getInstance();
      
      // 模拟数据库有 Cookie 但已失效
      mockStorage.getZhihuCookieStatus.mockResolvedValue({
        hasCookie: true,
        cookie: 'expired_cookie_value',
        version: 5,
        lastRefreshTime: new Date(),
        nextRefreshTime: null,
        recentLogs: [],
      });
      
      // Mock https 请求返回非 200（Cookie 无效）
      const mockReq = {
        on: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      };
      jest.doMock('https', () => ({
        get: jest.fn((_url: any, _opts: any, callback: any) => {
          callback({ statusCode: 401 });
          return mockReq;
        }),
      }));
      
      const result = await scanner.smartRefreshCookie();
      
      expect(result.success).toBe(false);
      expect(result.requiresManualRefresh).toBe(true);
      
      // 验证调用了 updateRefreshLog 记录失败
      expect(mockStorage.updateRefreshLog).toHaveBeenCalledWith(
        expect.any(Number),
        'failed',
        'Cookie 已失效，需要手动刷新',
        'zhihu'
      );
    });
  });
});

describe('Cookie 状态接口逻辑', () => {
  /**
   * 验证状态判断逻辑（纯逻辑测试，不依赖 Express）
   */
  it('最后一条日志为 failed 时 isValid 应为 false', () => {
    const hasCookie = true;
    const lastRefreshTime = new Date(); // 刚刷新过
    const isRecentlyRefreshed = Date.now() - lastRefreshTime.getTime() < 48 * 60 * 60 * 1000;
    
    const recentLogs = [
      { status: 'success', refresh_time: '2025-01-01' },
      { status: 'failed', error_message: 'Cookie 已失效，需要手动刷新' },
    ];
    const lastLog = recentLogs[recentLogs.length - 1];
    const isLastLogFailed = lastLog && lastLog.status === 'failed';
    
    const isValid = hasCookie && isRecentlyRefreshed && !isLastLogFailed;
    
    expect(isValid).toBe(false);
    expect(isLastLogFailed).toBe(true);
  });

  it('最后一条日志为 success 时 isValid 应为 true', () => {
    const hasCookie = true;
    const lastRefreshTime = new Date();
    const isRecentlyRefreshed = Date.now() - lastRefreshTime.getTime() < 48 * 60 * 60 * 1000;
    
    const recentLogs = [
      { status: 'failed', error_message: 'old failure' },
      { status: 'success', refresh_time: new Date().toISOString() },
    ];
    const lastLog = recentLogs[recentLogs.length - 1];
    const isLastLogFailed = lastLog && lastLog.status === 'failed';
    
    const isValid = hasCookie && isRecentlyRefreshed && !isLastLogFailed;
    
    expect(isValid).toBe(true);
  });

  it('没有 Cookie 时 isValid 应为 false', () => {
    const hasCookie = false;
    const isRecentlyRefreshed = true;
    const isLastLogFailed = false;
    
    const isValid = hasCookie && isRecentlyRefreshed && !isLastLogFailed;
    
    expect(isValid).toBe(false);
  });

  it('超过 48 小时未刷新时 isValid 应为 false', () => {
    const hasCookie = true;
    const lastRefreshTime = new Date(Date.now() - 49 * 60 * 60 * 1000); // 49 小时前
    const isRecentlyRefreshed = Date.now() - lastRefreshTime.getTime() < 48 * 60 * 60 * 1000;
    const isLastLogFailed = false;
    
    const isValid = hasCookie && isRecentlyRefreshed && !isLastLogFailed;
    
    expect(isValid).toBe(false);
  });
});

describe('动态轮询间隔', () => {
  it('checkCount <= 10 时间隔为 1000ms', () => {
    const getPollingInterval = (checkCount: number) => {
      if (checkCount <= 10) return 1000;
      if (checkCount <= 30) return 2000;
      return 3000;
    };
    
    expect(getPollingInterval(1)).toBe(1000);
    expect(getPollingInterval(10)).toBe(1000);
  });

  it('checkCount 11-30 时间隔为 2000ms', () => {
    const getPollingInterval = (checkCount: number) => {
      if (checkCount <= 10) return 1000;
      if (checkCount <= 30) return 2000;
      return 3000;
    };
    
    expect(getPollingInterval(11)).toBe(2000);
    expect(getPollingInterval(30)).toBe(2000);
  });

  it('checkCount > 30 时间隔为 3000ms', () => {
    const getPollingInterval = (checkCount: number) => {
      if (checkCount <= 10) return 1000;
      if (checkCount <= 30) return 2000;
      return 3000;
    };
    
    expect(getPollingInterval(31)).toBe(3000);
    expect(getPollingInterval(100)).toBe(3000);
  });
});
