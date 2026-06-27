/**
 * Token 管理路由
 * 
 * 提供 Token 的获取、设置、复制等功能
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../../utils/logger';
import { apiTokenStorage } from '../../storage/redis/api-token-storage';

const logger = getLogger('token-routes');
const router = Router();

/**
 * GET /api/token
 * 获取当前 Token（脱敏）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const token = await apiTokenStorage.getToken();
    
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
    await apiTokenStorage.saveToken(token);
    
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
    await apiTokenStorage.deleteToken();
    
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

export default router;
