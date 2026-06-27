import { Router, Request, Response } from 'express';
import { getAllConfig, getConfigGroup, updateConfigGroup, CONFIG_GROUPS } from '../services/config-service';

const router = Router();

/**
 * GET /api/config - 获取全部配置
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await getAllConfig();
    res.json(config);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `读取配置失败：${msg}` });
  }
});

/**
 * GET /api/config/:group - 获取指定分组配置
 */
router.get('/config/:group', async (req: Request, res: Response) => {
  const { group } = req.params;
  const groupConfig = await getConfigGroup(group);
  if (groupConfig === null) {
    res.status(404).json({
      error: `配置分组 "${group}" 不存在`,
      availableGroups: CONFIG_GROUPS,
    });
    return;
  }
  res.json(groupConfig);
});

/**
 * PUT /api/config/:group - 更新指定分组配置
 */
router.put('/config/:group', async (req: Request, res: Response) => {
  const { group } = req.params;
  const newValues = req.body;
  if (!newValues || typeof newValues !== 'object') {
    res.status(400).json({ error: '请求体必须是一个 JSON 对象' });
    return;
  }
  const result = await updateConfigGroup(group, newValues);
  if (result.success) {
    const updatedConfig = await getConfigGroup(group);
    res.json({ message: `配置分组 "${group}" 已更新`, data: updatedConfig });
  } else {
    const statusCode = result.error?.includes('无效') || result.error?.includes('必须') ? 400 : 500;
    res.status(statusCode).json({ error: result.error });
  }
});

export default router;
