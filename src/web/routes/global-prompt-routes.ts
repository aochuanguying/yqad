/**
 * 全局人设路由
 */

import { Router, Request, Response } from 'express';
import { load, save, validate, GlobalPrompt } from '../../services/global-prompt-service';
import { getLogger } from '../../utils/logger';

const logger = getLogger('global-prompt-routes');
const router = Router();

/**
 * GET /api/global-prompt - 获取全局人设配置
 */
router.get('/global-prompt', async (req: Request, res: Response) => {
  try {
    const config = await load();
    res.json(config || {});
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`读取全局人设配置失败：${msg}`);
    res.status(500).json({ error: `读取全局人设配置失败：${msg}` });
  }
});

/**
 * PUT /api/global-prompt - 保存全局人设配置
 */
router.put('/global-prompt', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: '请求体必须是一个 JSON 对象' });
      return;
    }

    // 校验字段
    const validation = validate(body as GlobalPrompt);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join('; ') });
      return;
    }

    // 保存配置（异步）
    const result = await save(body as GlobalPrompt);
    if (result.success) {
      res.json({ message: '保存成功' });
    } else {
      res.status(500).json({ error: result.error || '保存失败' });
    }
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`保存全局人设配置异常：${msg}`);
    res.status(500).json({ error: '保存失败' });
  }
});

export default router;
