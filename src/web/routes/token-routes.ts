/**
 * Token 管理路由
 * 
 * 提供登录 Token（JWT）的获取、设置、删除、远程刷新功能
 * 使用 authTokenStorage（Redis 键 auth:token），与 API Token 隔离
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getLogger } from '../../utils/logger';
import { authTokenStorage } from '../../storage/redis/auth-token-storage';
import { mobileServiceConfigStorage } from '../../storage/mysql/mobile-service-config-storage';
import { getAuthService } from '../services/auth-instance';

const logger = getLogger('token-routes');
const router = Router();

/**
 * GET /api/token
 * 获取当前 Token（脱敏）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const token = await authTokenStorage.getToken();
    
    if (!token) {
      return res.json({
        success: true,
        data: {
          hasToken: false,
          token: null,
        },
      });
    }
    
    // 返回完整 Token（用于复制）
    return res.json({
      success: true,
      data: {
        hasToken: true,
        token: token,
      },
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取 Token 失败：${msg}`);
    res.status(500).json({
      success: false,
      error: `获取 Token 失败：${msg}`,
    });
  }
});

/**
 * PUT /api/token
 * 设置 Token
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Token 不能为空',
      });
    }
    
    // 验证 Token 格式（JWT Token 通常以 eyJ 开头）
    if (!token.startsWith('eyJ')) {
      return res.status(400).json({
        success: false,
        error: 'Token 格式不正确，JWT Token 通常以 eyJ 开头',
      });
    }
    
    // 保存到 Redis
    await authTokenStorage.saveToken(token);
    
    logger.info('Token 已更新');
    
    return res.json({
      success: true,
      message: 'Token 已保存',
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`设置 Token 失败：${msg}`);
    res.status(500).json({
      success: false,
      error: `设置 Token 失败：${msg}`,
    });
  }
});

/**
 * DELETE /api/token
 * 删除 Token
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    await authTokenStorage.deleteToken();
    
    logger.info('Token 已删除');
    
    return res.json({
      success: true,
      message: 'Token 已删除',
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`删除 Token 失败：${msg}`);
    res.status(500).json({
      success: false,
      error: `删除 Token 失败：${msg}`,
    });
  }
});

/**
 * POST /api/token/refresh-from-telecom
 * 从 Android Telecom API 获取最新 Token 并保存
 */
router.post('/refresh-from-telecom', async (req: Request, res: Response) => {
  try {
    // 从数据库获取 Telecom API 配置
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    
    if (!serviceConfig || !serviceConfig.apiUrl || !serviceConfig.apiToken) {
      return res.status(400).json({
        success: false,
        error: '手机服务 API 未配置，请先在"手机配置 → 服务配置"中设置 API 地址和 Token',
      });
    }
    
    // 调用 Telecom API 获取 Token
    logger.info('从 Telecom API 刷新 Token...');
    const response = await axios.get(`${serviceConfig.apiUrl}/api/v1/audi/token`, {
      headers: {
        'Authorization': `Bearer ${serviceConfig.apiToken}`,
      },
      timeout: 10000,
    });
    
    const data = response.data;
    if (!data.success || !data.data?.token) {
      const errorMsg = data.error || '未知错误';
      logger.error(`Telecom API 返回错误：${errorMsg}`);
      return res.status(502).json({
        success: false,
        error: `从手机获取 Token 失败：${errorMsg}`,
      });
    }
    
    const newToken = data.data.token;
    
    // 验证 Token 格式
    if (!newToken.startsWith('eyJ')) {
      return res.status(502).json({
        success: false,
        error: '获取到的 Token 格式不正确',
      });
    }
    
    // 保存到 Redis
    await authTokenStorage.saveToken(newToken);
    
    // 同步到 AuthService 内存
    const { authService } = await getAuthService();
    authService.saveLoginToken(newToken, 300000); // 83 小时 ≈ 300000 秒
    
    logger.info('Token 已从 Telecom API 刷新并保存');
    
    return res.json({
      success: true,
      message: 'Token 已刷新',
      data: {
        tokenLength: newToken.length,
        source: data.data.source || 'telecom-api',
      },
    });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errData = error.response?.data as any;
      const errMsg = errData?.error || errData?.message || error.message;
      
      if (status === 401) {
        logger.error('Telecom API 鉴权失败');
        return res.status(502).json({
          success: false,
          error: 'Telecom API 鉴权失败，请检查服务配置中的 API Token',
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(502).json({
          success: false,
          error: '连接 Telecom API 超时，请检查手机是否在线',
        });
      }
      
      if (!error.response) {
        return res.status(502).json({
          success: false,
          error: '无法连接 Telecom API，请检查手机服务是否运行',
        });
      }
      
      logger.error(`Telecom API 错误：HTTP ${status} - ${errMsg}`);
      return res.status(502).json({
        success: false,
        error: `Telecom API 错误：${errMsg}`,
      });
    }
    
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`刷新 Token 失败：${msg}`);
    res.status(500).json({
      success: false,
      error: `刷新 Token 失败：${msg}`,
    });
  }
});

export default router;
