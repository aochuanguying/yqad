import { Router, Request, Response } from 'express';
import { getLogger } from '../../utils/logger';
import { verifyApiToken } from '../../utils/api-token';
import { mobileSmsStorage, MobileSmsRecord } from '../../storage/mysql/mobile-sms-storage';
import { missedCallStorage, MissedCallRecord } from '../../storage/mysql/missed-call-storage';

const logger = getLogger('mobile-routes');

const router = Router();

/**
 * 混合认证中间件
 * 系统内部访问：Session 认证（已登录用户无需 Token）
 * 外部设备访问：API Token 认证（使用发帖 API Token）
 */
async function mixedAuthMiddleware(req: any, res: any, next: any) {
  try {
    // 优先检查 Session 认证（系统内部访问）
    if (req.session && req.session.authenticated) {
      logger.info('Session 会话认证通过（系统内部访问）');
      return next();
    }

    // 其次检查 API Token 认证（外部设备访问）
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('鉴权失败：缺少 Authorization 头');
      return res.status(401).json({ error: '缺少 Authorization 头', code: 'UNAUTHORIZED' });
    }

    // 提取 Token
    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('鉴权失败：Token 格式无效');
      return res.status(401).json({ error: 'Token 格式无效', code: 'INVALID_TOKEN' });
    }

    // 验证 Token（使用发帖 API Token）
    const isValid = await verifyApiToken(token);
    if (!isValid) {
      logger.warn(`鉴权失败：Token 无效`);
      return res.status(401).json({ error: 'Token 无效', code: 'INVALID_TOKEN' });
    }
    
    logger.info('API Token 鉴权成功（外部设备访问）');
    next();
  } catch (error: any) {
    logger.error(`混合认证异常：${error.message}`);
    res.status(401).json({ error: '鉴权失败', code: 'AUTH_FAILED' });
  }
}

// ==================== 手机短信 API ====================

/**
 * POST /api/posts/mobile/sms
 * 添加短信记录（混合认证：Session 或 API Token）
 */
router.post('/sms', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number, content, received_at } = req.body;

    // 验证必填字段
    if (!phone_number || !content) {
      return res.status(400).json({ 
        error: '缺少必填字段', 
        code: 'MISSING_FIELDS',
        missing: [!phone_number ? 'phone_number' : null, !content ? 'content' : null].filter(Boolean)
      });
    }

    // 创建记录
    const record: MobileSmsRecord = {
      phoneNumber: phone_number,
      content: content,
      receivedAt: received_at ? new Date(received_at) : new Date(),
    };

    const id = await mobileSmsStorage.addSms(record);
    logger.info(`短信记录已添加，ID: ${id}`);

    res.json({ success: true, data: { id } });
  } catch (error: any) {
    logger.error(`添加短信记录失败：${error.message}`);
    res.status(500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/posts/mobile/sms
 * 查询短信记录列表（混合认证：Session 或 API Token）
 */
router.get('/sms', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number, limit, offset } = req.query;

    const options = {
      phoneNumber: phone_number as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const records = await mobileSmsStorage.getSmsList(options);
    
    res.json({ success: true, data: records });
  } catch (error: any) {
    logger.error(`查询短信记录失败：${error.message}`);
    res.status(500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
});

// ==================== 未接电话 API ====================

/**
 * POST /api/posts/mobile/missed-calls
 * 添加未接电话记录（混合认证：Session 或 API Token）
 */
router.post('/missed-calls', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number, received_at } = req.body;

    // ���证必填字段
    if (!phone_number) {
      return res.status(400).json({ 
        error: '缺少必填字段', 
        code: 'MISSING_FIELDS',
        missing: ['phone_number']
      });
    }

    // 创建记录
    const record: MissedCallRecord = {
      phoneNumber: phone_number,
      receivedAt: received_at ? new Date(received_at) : new Date(),
    };

    const id = await missedCallStorage.addMissedCall(record);
    logger.info(`未接电话记录已添加，ID: ${id}`);

    res.json({ success: true, data: { id } });
  } catch (error: any) {
    logger.error(`添加未接电话记录失败：${error.message}`);
    res.status(500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/posts/mobile/missed-calls
 * 查询未接电话记录列表（混合认证：Session 或 API Token）
 */
router.get('/missed-calls', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number, limit, offset } = req.query;

    const options = {
      phoneNumber: phone_number as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const records = await missedCallStorage.getMissedCallsList(options);
    
    res.json({ success: true, data: records });
  } catch (error: any) {
    logger.error(`查询未接电话记录失败：${error.message}`);
    res.status(500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
});

export { router as mobileRoutes };
