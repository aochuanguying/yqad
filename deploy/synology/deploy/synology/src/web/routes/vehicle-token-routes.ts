/**
 * 车辆 Token 更新路由
 * 
 * 提供通过 API Token 鉴权的 Token 更新接口
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../../utils/logger';
import { updateToken } from '../../services/vehicle-monitor-service';
import { verifyApiToken } from '../../utils/api-token';

const logger = getLogger('vehicle-token-routes');
const router = Router();

/**
 * API Token 鉴权中间件
 */
async function apiTokenMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('鉴权失败：缺少 Authorization 头');
      return res.status(401).json({ error: '缺少 Authorization 头', code: 'UNAUTHORIZED' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('鉴权失败：Token 格式无效');
      return res.status(401).json({ error: 'Token 格式无效', code: 'INVALID_TOKEN' });
    }
    
    const isValid = verifyApiToken(token);
    if (!isValid) {
      logger.warn('鉴权失败：Token 无效');
      return res.status(401).json({ error: 'Token 无效', code: 'INVALID_TOKEN' });
    }
    
    logger.debug('API Token 鉴权成功');
    next();
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`API Token 鉴权异常：${msg}`);
    return res.status(500).json({ error: '鉴权失败', code: 'AUTH_ERROR' });
  }
}

/**
 * POST /api/vehicle-token/update
 * 更新车辆监控 Token（需要 API Token 鉴权）
 */
router.post('/update', apiTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    // 请求体验证
    if (token === undefined || token === null) {
      return res.status(400).json({
        code: 'INVALID_PARAM',
        message: '缺少 token 字段',
      });
    }

    if (typeof token !== 'string') {
      return res.status(400).json({
        code: 'INVALID_PARAM',
        message: 'token 必须是字符串类型',
      });
    }

    if (token.trim() === '') {
      return res.status(400).json({
        code: 'INVALID_PARAM',
        message: 'token 不能为空字符串',
      });
    }

    // 调用服务更新 Token（等待 Redis 保存完成）
    const success = await updateToken(token);

    if (success) {
      logger.info('Token 更新成功');
      res.json({
        code: 'SUCCESS',
        message: 'Token 已更新',
      });
    } else {
      logger.error('Token 更新失败');
      res.status(500).json({
        code: 'UPDATE_FAILED',
        message: 'Token 更新失败，请稍后重试',
      });
    }
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`更新 Token 失败：${msg}`);
    res.status(500).json({
      code: 'ERROR',
      message: `更新失败：${msg}`,
    });
  }
});

export default router;
