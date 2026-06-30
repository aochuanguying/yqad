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
    const storage = NetworkPostConfigStorage.getInstance();
    
    const config: NetworkPostConfig = {
      zhihuAccessSecret: req.body.zhihuAccessSecret || '',
      zhihuEnabled: req.body.zhihuEnabled || false,
      xiaohongshuCookie: req.body.xiaohongshuCookie || '',
      xiaohongshuEnabled: req.body.xiaohongshuEnabled || false,
      autohomeCookie: req.body.autohomeCookie || '',
      autohomeEnabled: req.body.autohomeEnabled || false,
      maxResults: req.body.maxResults || 10,
      enabled: req.body.enabled !== undefined ? req.body.enabled : true,
    };
    
    const success = await storage.saveConfig(config);
    
    if (success) {
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
    const { accessSecret } = req.body;
    
    if (!accessSecret) {
      res.status(400).json({ 
        success: false, 
        error: 'Access Secret 不能为空' 
      });
      return;
    }
    
    const storage = NetworkPostConfigStorage.getInstance();
    const result = await storage.testZhihuConnection(accessSecret);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: '知乎 API 连接测试成功',
        resultCount: result.resultCount,
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || '测试失败',
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
}> = new Map();

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
    });
    
    // 异步执行刷新任务
    (async () => {
      try {
        const { CookieScanner } = await import('../../services/cookie-refresh/cookie-scanner');
        const scanner = CookieScanner.getInstance();
        
        // 设置状态更新回调
        scanner.setStatusCallback((status: any) => {
          const currentTask = refreshTasks.get(taskId);
          refreshTasks.set(taskId, {
            ...currentTask,
            status: status.status,
            qrCodeBase64: status.qrCodeBase64,
            message: status.message,
          });
        });
        
        logger.info('🔄 开始刷新 Cookie...');
        const result = await scanner.refreshCookie();
        
        if (result.success) {
          const currentTask = refreshTasks.get(taskId);
          refreshTasks.set(taskId, {
            ...currentTask,
            status: 'success',
            version: result.version,
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

export default router;
