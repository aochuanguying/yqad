/**
 * 网络发帖配置 API 路由
 * 
 * 提供网络发帖配置的加载、保存和测试连接功能
 */

import { Router, Request, Response } from 'express';
import { NetworkPostConfigStorage, NetworkPostConfig } from '../../storage/mysql/network-post-config-storage';
import { getLogger } from '../../utils/logger';

const logger = getLogger('network-post-routes');
const router = Router();

/**
 * GET /api/network-post-config - 获取网络发帖配置
 */
router.get('/network-post-config', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const config = await storage.getConfig();
    
    logger.info('获取网络发帖配置:', config ? '找到配置' : '未找到配置 (返回默认配置)');
    
    // 如果没有配置，返回默认配置
    const defaultConfig: NetworkPostConfig = {
      zhihuAccessSecret: '',
      zhihuCookie: '',
      zhihuEnabled: false,
      xiaohongshuCookie: '',
      xiaohongshuEnabled: false,
      autohomeCookie: '',
      autohomeEnabled: false,
      maxResults: 10,
      enabled: true,
    };
    
    res.json({ 
      success: true, 
      config: config || defaultConfig 
    });
  } catch (error) {
    logger.error('获取网络发帖配置失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取配置失败' 
    });
  }
});

/**
 * POST /api/network-post-config - 保存网络发帖配置
 */
router.post('/network-post-config', async (req: Request, res: Response) => {
  try {
    const requestBody = {
      zhihuCookie: req.body.zhihuCookie ? `长度=${req.body.zhihuCookie.length}` : '空',
      zhihuAccessSecret: req.body.zhihuAccessSecret ? `长度=${req.body.zhihuAccessSecret.length}` : '空',
      xiaohongshuCookie: req.body.xiaohongshuCookie ? `长度=${req.body.xiaohongshuCookie.length}` : '空',
    };
    logger.info('💾 接收到保存请求 - ' + JSON.stringify(requestBody));
    
    const storage = NetworkPostConfigStorage.getInstance();
    
    const config: NetworkPostConfig = {
      zhihuAccessSecret: req.body.zhihuAccessSecret || '',
      zhihuCookie: req.body.zhihuCookie || '',
      zhihuEnabled: req.body.zhihuEnabled || false,
      xiaohongshuCookie: req.body.xiaohongshuCookie || '',
      xiaohongshuEnabled: req.body.xiaohongshuEnabled || false,
      autohomeCookie: req.body.autohomeCookie || '',
      autohomeEnabled: req.body.autohomeEnabled || false,
      maxResults: req.body.maxResults || 10,
      enabled: req.body.enabled !== undefined ? req.body.enabled : true,
    };
    
    logger.info('💾 准备保存的配置 - 知乎 Cookie 长度:', config.zhihuCookie?.length || 0);
    
    const success = await storage.saveConfig(config);
    
    if (success) {
      // 手动保存 Cookie 时同步更新 version 和 last_refresh_time
      if (config.xiaohongshuCookie && config.xiaohongshuCookie.length > 0) {
        try {
          await storage.saveCookie(config.xiaohongshuCookie, 'manual');
          logger.info('💾 手动保存小红书 Cookie，已同步更新版本和刷新时间');
        } catch (err) {
          logger.warn('手动保存小红书 Cookie 版本同步失败:', err instanceof Error ? err.message : err);
        }
      }
      if (config.zhihuCookie && config.zhihuCookie.length > 0) {
        try {
          await storage.saveZhihuCookie(config.zhihuCookie, 'manual');
          logger.info('💾 手动保存知乎 Cookie，已同步更新版本和刷新时间');
        } catch (err) {
          logger.warn('手动保存知乎 Cookie 版本同步失败:', err instanceof Error ? err.message : err);
        }
      }
      res.json({ success: true, message: '配置保存成功' });
    } else {
      res.status(500).json({ success: false, error: '保存配置失败' });
    }
  } catch (error) {
    logger.error('保存网络发帖配置失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '保存配置失败' 
    });
  }
});

/**
 * POST /api/network-post-config/test-zhihu - 测试知乎连接
 */
router.post('/network-post-config/test-zhihu', async (req: Request, res: Response) => {
  try {
    const { accessSecret, cookie } = req.body;
    
    if (!accessSecret) {
      res.status(400).json({ 
        success: false, 
        error: 'Access Secret 不能为空' 
      });
      return;
    }
    
    const storage = NetworkPostConfigStorage.getInstance();
    
    // 1. 测试 Access Secret（搜索 API）
    const apiResult = await storage.testZhihuConnection(accessSecret);
    
    // 2. 测试 Cookie（如果提供了）
    let cookieValid: boolean | null = null;
    let cookieError: string | undefined;
    if (cookie && cookie.trim().length > 0) {
      try {
        const https = await import('https');
        cookieValid = await new Promise<boolean>((resolve) => {
          const req = https.get('https://www.zhihu.com/api/v4/me', {
            headers: { 'Cookie': cookie },
            timeout: 10000,
          }, (res: any) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => { req.destroy(); resolve(false); });
        });
        if (!cookieValid) {
          cookieError = 'Cookie 无效或已过期';
        }
      } catch (e) {
        cookieValid = false;
        cookieError = '验证 Cookie 时出错';
      }
    }
    
    if (apiResult.success) {
      res.json({ 
        success: true, 
        message: cookieValid === false 
          ? `API 连接成功（${apiResult.resultCount} 条结果），但 Cookie 无效`
          : '知乎连接测试成功',
        resultCount: apiResult.resultCount,
        cookieValid,
        cookieError,
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: apiResult.error || '测试失败',
        cookieValid,
        cookieError,
      });
    }
  } catch (error) {
    logger.error('测试知乎连接失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '测试失败' 
    });
  }
});

/**
 * POST /api/network-post-config/test-xiaohongshu - 测试小红书连接
 */
router.post('/network-post-config/test-xiaohongshu', async (req: Request, res: Response) => {
  try {
    const { cookie } = req.body;
    
    if (!cookie) {
      res.status(400).json({ 
        success: false, 
        error: 'Cookie 不能为空' 
      });
      return;
    }
    
    const storage = NetworkPostConfigStorage.getInstance();
    const result = await storage.testXiaohongshuConnection(cookie);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: '小红书 API 连接测试成功',
        resultCount: result.resultCount,
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || '测试失败',
      });
    }
  } catch (error) {
    logger.error('测试小红书连接失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '测试失败' 
    });
  }
});

/**
 * POST /api/network-post-config/test-autohome - 测试汽车之家连接
 */
router.post('/network-post-config/test-autohome', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const result = await storage.testAutohomeConnection();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: '汽车之家连接测试成功',
        resultCount: result.resultCount,
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || '测试失败',
      });
    }
  } catch (error) {
    logger.error('测试汽车之家连接失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '测试失败' 
    });
  }
});

/**
 * GET /api/network-post-config/autohome-warning - 获取汽车之家选择器警告
 */
router.get('/network-post-config/autohome-warning', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const warning = await storage.getAutohomeSelectorWarning();
    
    res.json({ 
      success: true, 
      warning: warning,
      hasWarning: !!warning,
    });
  } catch (error) {
    logger.error('获取汽车之家警告失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取警告失败' 
    });
  }
});

/**
 * POST /api/network-post-config/autohome-warning - 更新汽车之家选择器警告
 */
router.post('/network-post-config/autohome-warning', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const { warning, clear } = req.body;
    
    // 如果 clear=true，清除警告；否则设置警告
    const warningMessage = clear ? null : (warning || '');
    const success = await storage.updateAutohomeSelectorWarning(warningMessage);
    
    if (success) {
      if (clear) {
        res.json({ success: true, message: '警告已清除' });
      } else {
        res.json({ success: true, message: '警告已更新', warning: warningMessage });
      }
    } else {
      res.status(500).json({ success: false, error: '更新警告失败' });
    }
  } catch (error) {
    logger.error('更新汽车之家警告失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新警告失败' 
    });
  }
});

/**
 * GET /api/network-post-config/cookie-status - 获取 Cookie 状态
 */
router.get('/network-post-config/cookie-status', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const status = await storage.getCookieStatus();
    
    // 确保 recentLogs 是数组
    const logs = Array.isArray(status.recentLogs) ? status.recentLogs : [];
    
    res.json({ 
      success: true, 
      data: {
        hasCookie: status.hasCookie,
        version: status.version,
        lastRefreshTime: status.lastRefreshTime ? status.lastRefreshTime.toISOString() : null,
        nextRefreshTime: status.nextRefreshTime ? status.nextRefreshTime.toISOString() : null,
        recentLogs: logs.slice(-10), // 最近 10 条记录
      },
    });
  } catch (error) {
    logger.error('获取 Cookie 状态失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取状态失败' 
    });
  }
});

// 存储刷新任务的状态和二维码
const refreshTasks: Map<string, {
  status: 'generating_first' | 'waiting_first_scan' | 'generating_second' | 'waiting_login' | 'success' | 'failed';
  qrCodeBase64?: string;
  message?: string;
  version?: number;
  error?: string;
  createdAt?: number;
}> = new Map();

// 存储知乎刷新任务的状态
const zhihuRefreshTasks: Map<string, {
  status: 'generating' | 'waiting_scan' | 'saving' | 'success' | 'failed';
  message?: string;
  version?: number;
  error?: string;
  qrCodeBase64?: string;
  createdAt?: number;
}> = new Map();

// 定期清理已完成或已失败的过期任务（10 分钟后清理）
const TASK_EXPIRY_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [taskId, task] of refreshTasks.entries()) {
    if ((task.status === 'success' || task.status === 'failed') && task.createdAt && (now - task.createdAt > TASK_EXPIRY_MS)) {
      refreshTasks.delete(taskId);
    }
  }
  for (const [taskId, task] of zhihuRefreshTasks.entries()) {
    if ((task.status === 'success' || task.status === 'failed') && task.createdAt && (now - task.createdAt > TASK_EXPIRY_MS)) {
      zhihuRefreshTasks.delete(taskId);
    }
  }
}, 5 * 60 * 1000); // 每 5 分钟检查一次

/**
 * POST /api/network-post-config/cookie/refresh - 刷新 Cookie（异步）
 */
router.post('/network-post-config/cookie/refresh', async (req: Request, res: Response) => {
  try {
    const taskId = `refresh_${Date.now()}`;
    
    // 初始化任务状态
    refreshTasks.set(taskId, {
      status: 'generating_first',
      message: '正在生成二维码...',
      createdAt: Date.now(),
    });
    
    // 异步执行刷新任务
    (async () => {
      try {
        const { CookieScanner } = await import('../../services/cookie-refresh/cookie-scanner');
        const scanner = CookieScanner.getInstance();
        
        // 设置状态更新回调
        scanner.setStatusCallback((status: any) => {
          const currentTask = refreshTasks.get(taskId);
          if (currentTask) {
            refreshTasks.set(taskId, {
              ...currentTask,
              status: status.status,
              qrCodeBase64: status.qrCodeBase64,
              // 只有在 scanner 返回 message 时才更新，否则保留原有 message
              message: status.message || currentTask.message,
            });
          }
        });
        
        logger.info('🔄 开始刷新 Cookie...');
        const result = await scanner.refreshCookie();
        
        if (result.success) {
          refreshTasks.set(taskId, {
            status: 'success',
            message: 'Cookie 刷新成功',
            version: result.version,
          });
        } else {
          refreshTasks.set(taskId, {
            status: 'failed',
            error: result.error || '刷新失败',
            message: result.error || '刷新失败',
          });
        }
      } catch (error) {
        const currentTask = refreshTasks.get(taskId);
        refreshTasks.set(taskId, {
          ...currentTask,
          status: 'failed',
          error: error instanceof Error ? error.message : '刷新失败',
        });
      }
    })();
    
    // 立即返回任务 ID
    res.json({ 
      success: true, 
      taskId,
      message: '开始刷新，请使用 taskId 轮询状态',
    });
  } catch (error) {
    logger.error('刷新 Cookie 失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '刷新失败' 
    });
  }
});

/**
 * GET /api/network-post-config/cookie/status/:taskId - 获取刷新任务状态
 */
router.get('/network-post-config/cookie/status/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  
  const task = refreshTasks.get(taskId);
  if (!task) {
    res.status(404).json({ 
      success: false, 
      error: '任务不存在',
    });
    return;
  }
  
  res.json({ 
    success: true, 
    data: task,
  });
});

/**
 * POST /api/network-post-config/zhihu/refresh - 刷新知乎 Cookie（异步）
 */
router.post('/network-post-config/zhihu/refresh', async (req: Request, res: Response) => {
  try {
    const taskId = `zhihu_refresh_${Date.now()}`;
    
    // 初始化任务状态
    zhihuRefreshTasks.set(taskId, {
      status: 'generating',
      message: '正在生成二维码...',
      createdAt: Date.now(),
    });
    
    // 异步执行刷新任务
    (async () => {
      try {
        const { ZhihuCookieScanner } = await import('../../services/cookie-refresh/zhihu-cookie-scanner');
        const scanner = ZhihuCookieScanner.getInstance();
        
        // 设置状态更新回调
        scanner.setStatusCallback((status: any) => {
          const currentTask = zhihuRefreshTasks.get(taskId);
          zhihuRefreshTasks.set(taskId, {
            ...currentTask,
            status: status.status,
            message: status.message,
            qrCodeBase64: status.qrCodeBase64,
          });
        });
        
        logger.info('🔄 开始刷新知乎 Cookie...');
        const result = await scanner.refreshCookie();
        
        if (result.success) {
          zhihuRefreshTasks.set(taskId, {
            status: 'success',
            message: 'Cookie 刷新成功',
            version: result.version,
          });
        } else {
          zhihuRefreshTasks.set(taskId, {
            status: 'failed',
            error: result.error || '刷新失败',
            message: result.error || '刷新失败',
          });
        }
      } catch (error) {
        const currentTask = zhihuRefreshTasks.get(taskId);
        zhihuRefreshTasks.set(taskId, {
          ...currentTask,
          status: 'failed',
          error: error instanceof Error ? error.message : '刷新失败',
        });
      }
    })();
    
    // 立即返回任务 ID
    res.json({ 
      success: true, 
      taskId,
      message: '开始刷新知乎 Cookie，请使用 taskId 轮询状态',
    });
  } catch (error) {
    logger.error('刷新知乎 Cookie 失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '刷新失败' 
    });
  }
});

/**
 * GET /api/network-post-config/zhihu/status/:taskId - 获取知乎刷新任务状态
 */
router.get('/network-post-config/zhihu/status/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  
  const task = zhihuRefreshTasks.get(taskId);
  if (!task) {
    res.status(404).json({ 
      success: false, 
      error: '任务不存在',
    });
    return;
  }
  
  res.json({ 
    success: true, 
    data: task,
  });
});

/**
 * GET /api/network-post-config/zhihu-cookie-status - 获取知乎 Cookie 状态
 */
router.get('/network-post-config/zhihu-cookie-status', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const status = await storage.getZhihuCookieStatus();
    
    const logs = Array.isArray(status.recentLogs) ? status.recentLogs : [];
    
    res.json({ 
      success: true, 
      data: {
        hasCookie: status.hasCookie,
        version: status.version,
        lastRefreshTime: status.lastRefreshTime ? status.lastRefreshTime.toISOString() : null,
        nextRefreshTime: status.nextRefreshTime ? status.nextRefreshTime.toISOString() : null,
        recentLogs: logs.slice(-10),
      },
    });
  } catch (error) {
    logger.error('获取知乎 Cookie 状态失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取状态失败' 
    });
  }
});

/**
 * GET /api/network-post-config/cookie/status/xiaohongshu - 获取小红书 Cookie 状态
 */
router.get('/network-post-config/cookie/status/xiaohongshu', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const status = await storage.getCookieStatus();
    
    const hasCookie = status.hasCookie;
    // 判断有效性：有 Cookie 且最近 48 小时内刷新过，且最后一次刷新不是失败状态
    const isRecentlyRefreshed = status.lastRefreshTime 
      ? (Date.now() - status.lastRefreshTime.getTime() < 48 * 60 * 60 * 1000)
      : false;
    
    // 检查最近一条日志是否为失效（失效时 smartRefresh 会写入失败日志）
    const recentLogs = Array.isArray(status.recentLogs) ? status.recentLogs : [];
    const lastLog = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null;
    const isLastLogFailed = lastLog && lastLog.status === 'failed';
    
    const isValid = hasCookie && isRecentlyRefreshed && !isLastLogFailed;
    
    res.json({
      success: true,
      status: {
        isValid,
        lastUpdate: status.lastRefreshTime ? status.lastRefreshTime.toISOString() : null,
        version: status.version,
        expired: isLastLogFailed,
        expiredReason: isLastLogFailed ? (lastLog.error_message || lastLog.errorMessage || 'Cookie 已失效') : undefined,
      },
    });
  } catch (error) {
    logger.error('获取小红书 Cookie 状态失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});

/**
 * GET /api/network-post-config/cookie/status/zhihu - 获取知乎 Cookie 状态
 */
router.get('/network-post-config/cookie/status/zhihu', async (req: Request, res: Response) => {
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const status = await storage.getZhihuCookieStatus();
    
    const hasCookie = status.hasCookie;
    // 判断有效性：有 Cookie 且最近 48 小时内刷新过，且最后一次刷新不是失败状态
    const isRecentlyRefreshed = status.lastRefreshTime 
      ? (Date.now() - status.lastRefreshTime.getTime() < 48 * 60 * 60 * 1000)
      : false;
    
    // 检查最近一条日志是否为失效
    const recentLogs = Array.isArray(status.recentLogs) ? status.recentLogs : [];
    const lastLog = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null;
    const isLastLogFailed = lastLog && lastLog.status === 'failed';
    
    const isValid = hasCookie && isRecentlyRefreshed && !isLastLogFailed;
    
    res.json({
      success: true,
      status: {
        isValid,
        lastUpdate: status.lastRefreshTime ? status.lastRefreshTime.toISOString() : null,
        version: status.version,
        expired: isLastLogFailed,
        expiredReason: isLastLogFailed ? (lastLog.error_message || lastLog.errorMessage || 'Cookie 已失效') : undefined,
      },
    });
  } catch (error) {
    logger.error('获取知乎 Cookie 状态失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});
/**
 * POST /api/network-post-config/cookie/refresh/xiaohongshu - 刷新小红书 Cookie（异步）
 */
router.post('/network-post-config/cookie/refresh/xiaohongshu', async (req: Request, res: Response) => {
  try {
    const taskId = `xhs_refresh_${Date.now()}`;
    
    // 初始化任务状态
    refreshTasks.set(taskId, {
      status: 'generating_first',
      message: '正在生成二维码...',
      createdAt: Date.now(),
    });
    
    // 异步执行刷新任务
    (async () => {
      try {
        const { CookieScanner } = await import('../../services/cookie-refresh/cookie-scanner');
        const scanner = CookieScanner.getInstance();
        
        // 设置状态更新回调
        scanner.setStatusCallback((status: any) => {
          const currentTask = refreshTasks.get(taskId);
          if (currentTask) {
            refreshTasks.set(taskId, {
              ...currentTask,
              status: status.status,
              qrCodeBase64: status.qrCodeBase64,
              message: status.message || currentTask.message,
            });
          }
        });
        
        logger.info('🔄 开始刷新小红书 Cookie...');
        const result = await scanner.refreshCookie();
        
        if (result.success) {
          refreshTasks.set(taskId, {
            status: 'success',
            message: '小红书 Cookie 刷新成功',
            version: result.version,
          });
        } else {
          refreshTasks.set(taskId, {
            status: 'failed',
            error: result.error || '刷新失败',
            message: result.error || '刷新失败',
          });
        }
      } catch (error) {
        const currentTask = refreshTasks.get(taskId);
        refreshTasks.set(taskId, {
          ...currentTask,
          status: 'failed',
          error: error instanceof Error ? error.message : '刷新失败',
        });
      }
    })();
    
    // 立即返回任务 ID 和初始状态
    const task = refreshTasks.get(taskId);
    res.json({
      success: true,
      taskId,
      qrCodeBase64: task?.qrCodeBase64,
      message: task?.message,
    });
  } catch (error) {
    logger.error('小红书 Cookie 刷新失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '刷新失败',
    });
  }
});

/**
 * POST /api/network-post-config/cookie/refresh/zhihu - 刷新知乎 Cookie（异步）
 */
router.post('/network-post-config/cookie/refresh/zhihu', async (req: Request, res: Response) => {
  try {
    const taskId = `zhihu_refresh_${Date.now()}`;
    
    // 初始化任务状态
    zhihuRefreshTasks.set(taskId, {
      status: 'generating',
      message: '正在生成二维码...',
      createdAt: Date.now(),
    });
    
    // 异步执行刷新任务
    (async () => {
      try {
        const { ZhihuCookieScanner } = await import('../../services/cookie-refresh/zhihu-cookie-scanner');
        const scanner = ZhihuCookieScanner.getInstance();
        
        // 设置状态更新回调
        scanner.setStatusCallback((status: any) => {
          const currentTask = zhihuRefreshTasks.get(taskId);
          if (currentTask) {
            zhihuRefreshTasks.set(taskId, {
              ...currentTask,
              status: status.status,
              qrCodeBase64: status.qrCodeBase64,
              message: status.message || currentTask.message,
            });
          }
        });
        
        logger.info('🔄 开始刷新知乎 Cookie...');
        const result = await scanner.refreshCookie();
        
        if (result.success) {
          zhihuRefreshTasks.set(taskId, {
            status: 'success',
            message: '知乎 Cookie 刷新成功',
            version: result.version,
          });
        } else {
          zhihuRefreshTasks.set(taskId, {
            status: 'failed',
            error: result.error || '刷新失败',
            message: result.error || '刷新失败',
          });
        }
      } catch (error) {
        const currentTask = zhihuRefreshTasks.get(taskId);
        zhihuRefreshTasks.set(taskId, {
          ...currentTask,
          status: 'failed',
          error: error instanceof Error ? error.message : '刷新失败',
        });
      }
    })();
    
    // 立即返回任务 ID 和初始状态
    const task = zhihuRefreshTasks.get(taskId);
    res.json({
      success: true,
      taskId,
      qrCodeBase64: task?.qrCodeBase64,
      message: task?.message,
    });
  } catch (error) {
    logger.error('知乎 Cookie 刷新失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '刷新失败',
    });
  }
});

export default router;
