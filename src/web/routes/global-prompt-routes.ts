/**
 * 全局人设路由
 */

import { Router, Request, Response } from 'express';
import { load, save, validate, GlobalPrompt } from '../../services/global-prompt-service';
import { getLogger } from '../../utils/logger';
import { getInternetReferenceStorage } from '../../storage/mysql/internet-reference-storage';

const logger = getLogger('global-prompt-routes');
const router = Router();

/**
 * GET /api/global-prompt - 获取全局人设配置（含搜索关键词）
 */
router.get('/global-prompt', async (req: Request, res: Response) => {
  try {
    const config = await load();
    // 附带返回搜索关键词
    let searchKeywords: string[] = [];
    try {
      const irConfig = await getInternetReferenceStorage().getConfig();
      searchKeywords = irConfig?.searchKeywords || [];
    } catch (e) {
      // 搜索关键词读取失败不影响人设
    }
    res.json({ ...(config || {}), searchKeywords });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`读取全局人设配置失败：${msg}`);
    res.status(500).json({ error: `读取全局人设配置失败：${msg}` });
  }
});

/**
 * PUT /api/global-prompt - 保存全局人设配置（含搜索关键词）
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

    // 保存人设配置
    const result = await save(body as GlobalPrompt);
    if (!result.success) {
      res.status(500).json({ error: result.error || '保存失败' });
      return;
    }

    // 保存搜索关键词（如果前端传了）
    if (body.searchKeywords !== undefined) {
      try {
        const storage = getInternetReferenceStorage();
        const currentConfig = await storage.getConfig();
        if (currentConfig) {
          currentConfig.searchKeywords = Array.isArray(body.searchKeywords)
            ? body.searchKeywords
            : String(body.searchKeywords).split(',').map((s: string) => s.trim()).filter(Boolean);
          await storage.saveConfig(currentConfig);
          logger.info(`搜索关键词已更新：${currentConfig.searchKeywords.join(', ')}`);
        }
      } catch (e: any) {
        logger.warn(`搜索关键词保存失败：${e.message}`);
      }
    }

    res.json({ message: '保存成功' });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`保存全局人设配置异常：${msg}`);
    res.status(500).json({ error: '保存失败' });
  }
});

export default router;
