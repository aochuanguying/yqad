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
    
    logger.info('获取网络发帖配置:', config ? '找到配置' : '未找到配置 (返回 null)');
    
    res.json({ success: true, config });
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
    const { cookie } = req.body;
    
    const storage = NetworkPostConfigStorage.getInstance();
    const result = await storage.testAutohomeConnection(cookie || '');
    
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

export default router;
