import { Router, Request, Response } from 'express';
import { getLogger } from '../../utils/logger';
import { mobileSmsStorage, MobileSmsRecord } from '../../storage/mysql/mobile-sms-storage';
import { missedCallStorage, MissedCallRecord } from '../../storage/mysql/missed-call-storage';

const logger = getLogger('mobile-routes');

const router = Router();

// ==================== 手机短信 API ====================

/**
 * POST /api/posts/mobile/sms
 * 添加短信记录
 */
router.post('/sms', async (req: Request, res: Response) => {
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
router.get('/sms', async (req: Request, res: Response) => {
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
 * 添加未接电话记录
 */
router.post('/missed-calls', async (req: Request, res: Response) => {
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
 * 查询未接电话记录列表
 */
router.get('/missed-calls', async (req: Request, res: Response) => {
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
