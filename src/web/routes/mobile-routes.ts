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
 * 注意：此接口仅用于外部设备（AutoJS）上报接收到的短信，不用于主动发送短信
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
 * POST /api/posts/mobile/send-sms
 * 主动发送短信（混合认证：Session 或 API Token）
 * 调用 Android Telecom API 发送短信，不记录到短信记录表
 */
router.post('/send-sms', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number, content } = req.body;

    // 验证必填字段
    if (!phone_number || !content) {
      return res.status(400).json({ 
        error: '缺少必填字段', 
        code: 'MISSING_FIELDS',
        missing: [!phone_number ? 'phone_number' : null, !content ? 'content' : null].filter(Boolean)
      });
    }

    // 调用 Android Telecom API 发送短信
    const { telecomClient } = await import('../../services/telecom-client');
    const { telecomApiStorage } = await import('../../storage/mysql/telecom-api-storage');
    const { mobileServiceConfigStorage } = await import('../../storage/mysql/mobile-service-config-storage');
    
    const telecomConfig = await telecomApiStorage.getConfig();
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    
    if (telecomConfig && telecomConfig.alertPhone && serviceConfig && serviceConfig.apiUrl && serviceConfig.apiToken) {
      telecomClient.init(telecomConfig, serviceConfig);
      
      // 发送短信
      const smsResult = await telecomClient.sendSms(phone_number, content);
      
      if (smsResult.success) {
        logger.info(`短信发送成功：${phone_number}`);
        res.json({ 
          success: true, 
          message: '短信发送成功'
        });
      } else {
        logger.warn(`短信发送失败：${smsResult.error}`);
        res.status(500).json({ 
          success: false,
          error: '短信发送失败：' + (smsResult.error || '未知错误')
        });
      }
    } else {
      logger.warn('Telecom API 未配置');
      res.status(503).json({ 
        success: false,
        error: 'Telecom API 未配置'
      });
    }
  } catch (telecomError: any) {
    logger.error(`调用 Telecom API 失败：${telecomError.message}`);
    res.status(500).json({ error: '调用 Telecom API 失败：' + telecomError.message, code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/posts/mobile/sms
 * 查询短信记录列表（混合认证：Session 或 API Token）
 * 支持分页，最大返回 100 条记录
 */
router.get('/sms', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number, limit, offset } = req.query;

    const options = {
      phoneNumber: phone_number as string | undefined,
      limit: Math.min(limit ? parseInt(limit as string, 10) : 50, 100), // 最多 100 条
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const records = await mobileSmsStorage.getSmsList(options);
    const total = await mobileSmsStorage.getSmsCount(options.phoneNumber);
    
    res.json({ 
      success: true, 
      data: records,
      pagination: {
        total,
        limit: options.limit,
        offset: options.offset,
        hasMore: options.offset + options.limit < total
      }
    });
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
    const total = await missedCallStorage.getMissedCallsCount(options.phoneNumber);
    
    res.json({ 
      success: true, 
      data: records,
      pagination: {
        total,
        limit: options.limit,
        offset: options.offset,
        hasMore: options.offset + options.limit < total
      }
    });
  } catch (error: any) {
    logger.error(`查询未接电话记录失败：${error.message}`);
    res.status(500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/posts/mobile/call
 * 拨打电话（混合认证：Session 或 API Token）
 * 注意：主动外呼不记录到未接电话表，未接电话表只记录外部打进来的未接来电
 */
router.post('/call', mixedAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone_number } = req.body;

    // 验证必填字段
    if (!phone_number) {
      return res.status(400).json({ 
        error: '缺少必填字段', 
        code: 'MISSING_FIELDS',
        missing: ['phone_number']
      });
    }

    // 调用 Android Telecom API 拨打电话
    const { telecomClient } = await import('../../services/telecom-client');
    const { telecomApiStorage } = await import('../../storage/mysql/telecom-api-storage');
    const { mobileServiceConfigStorage } = await import('../../storage/mysql/mobile-service-config-storage');
    
    const telecomConfig = await telecomApiStorage.getConfig();
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    
    if (telecomConfig && telecomConfig.alertPhone && serviceConfig && serviceConfig.apiUrl && serviceConfig.apiToken) {
      telecomClient.init(telecomConfig, serviceConfig);
      
      // 拨打电话
      const callResult = await telecomClient.makePhoneCall(phone_number);
      
      if (callResult.success) {
        logger.info(`电话拨打成功：${phone_number}`);
        res.json({ 
          success: true, 
          message: '电话拨打成功'
        });
      } else {
        logger.warn(`电话拨打失败：${callResult.error}`);
        res.status(500).json({ 
          success: false,
          error: '电话拨打失败：' + (callResult.error || '未知错误')
        });
      }
    } else {
      logger.warn('Telecom API 未配置');
      res.status(503).json({ 
        success: false,
        error: 'Telecom API 未配置'
      });
    }
  } catch (telecomError: any) {
    logger.error(`调用 Telecom API 失败：${telecomError.message}`);
    res.status(500).json({ error: '调用 Telecom API 失败：' + telecomError.message, code: 'INTERNAL_ERROR' });
  }
});

export { router as mobileRoutes };
