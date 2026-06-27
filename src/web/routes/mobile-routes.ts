import { Router, Request, Response } from 'express';
import { getLogger } from '../../utils/logger';
import { verifyApiToken } from '../../utils/api-token';
import { mobileSmsStorage, MobileSmsRecord } from '../../storage/mysql/mobile-sms-storage';
import { missedCallStorage, MissedCallRecord } from '../../storage/mysql/missed-call-storage';

const logger = getLogger('mobile-routes');

const router = Router();

/**
 * 简化的鉴权中间件（使用会话认证，已登录即可访问）
 */
function simpleAuthMiddleware(req: any, res: any, next: any) {
  // 检查是否有会话（已登录）
  if (req.session && req.session.authenticated) {
    logger.info('会话认证通过');
    next();
  } else {
    logger.warn('未登录或会话过期');
    res.status(401).json({ error: '未登录或会话过期', code: 'UNAUTHORIZED' });
  }
}

// ==================== 手机短信 API ====================

/**
 * POST /api/posts/mobile/sms
 * 添加短信记录
 */
router.post('/sms', simpleAuthMiddleware, async (req: Request, res: Response) => {
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
 * 查询短信记录列表
 */
router.get('/sms', simpleAuthMiddleware, async (req: Request, res: Response) => {
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
 * POST /api/posts/mobile/calls/missed
 * 添加未接电话记录
 */
router.post('/calls/missed', simpleAuthMiddleware, async (req: Request, res: Response) => {
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
 * GET /api/posts/mobile/calls/missed
 * 查询未接电话记录列表
 */
router.get('/calls/missed', simpleAuthMiddleware, async (req: Request, res: Response) => {
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
