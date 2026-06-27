import express from 'express';
import {
  getAllTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  resetTopicUseCount,
  resetAllTopics,
  incrementTopicUseCount,
  recommendSimilarTopics,
} from '../services/topics-service';
import { getLogger } from '../../utils/logger';
import { getTopicStorage } from '../../storage/mysql/topic-storage';

const router = express.Router();
const logger = getLogger('topics-routes');
const topicStorage = getTopicStorage();

/**
 * GET /api/topics
 * 获取所有主题
 */
router.get('/', async (req, res) => {
  try {
    const topics = await getAllTopics();
    res.json({ items: topics });
  } catch (error: any) {
    logger.error(`获取主题列表失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * POST /api/topics
 * 创建新主题
 */
router.post('/', async (req, res) => {
  try {
    const { title, direction, outline, materialPaths, maxUseCount, subDirections } = req.body;

    if (!title) {
      res.status(400).json({
        code: 'INVALID_INPUT',
        message: '主题标题不能为空',
      });
      return;
    }

    const topic = await createTopic({
      title,
      direction: direction || '',
      outline: outline || '',
      materialPaths: materialPaths || [],
      maxUseCount: maxUseCount || 1,
      subDirections,
    });

    if (!topic) {
      res.status(500).json({
        code: 'CREATE_FAILED',
        message: '创建主题失败',
      });
      return;
    }

    res.status(201).json(topic);
  } catch (error: any) {
    logger.error(`创建主题失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * PUT /api/topics/:id
 * 更新主题信息
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, direction, outline, materialPaths, maxUseCount } = req.body;

    const topic = await updateTopic(id, {
      title,
      direction,
      outline,
      materialPaths,
      maxUseCount,
    });

    if (!topic) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '主题不存在',
      });
      return;
    }

    res.json(topic);
  } catch (error: any) {
    logger.error(`更新主题失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * DELETE /api/topics/:id
 * 删除主题
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteTopic(id);

    if (!success) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '主题不存在',
      });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error(`删除主题失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * POST /api/topics/:id/reset
 * 重置单个主题使用次数
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await resetTopicUseCount(id);

    if (!success) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '主题不存在',
      });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error(`重置主题使用次数失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * POST /api/topics/reset-all
 * 重置所有主题使用次数
 */
router.post('/reset-all', async (req, res) => {
  try {
    const success = await resetAllTopics();

    if (!success) {
      res.status(500).json({
        code: 'RESET_FAILED',
        message: '重置所有主题失败',
      });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error(`重置所有主题失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * GET /api/topics/:id/max-use-count
 * 获取主题的最大使用次数
 */
router.get('/:id/max-use-count', async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await topicStorage.getTopicById(id);

    if (!topic) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '主题不存在',
      });
      return;
    }

    res.json({ maxUseCount: topic.max_use_count });
  } catch (error: any) {
    logger.error(`获取主题最大使用次数失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * GET /api/topics/:id/similar
 * 推荐相似主题
 */
router.get('/:id/similar', async (req, res) => {
  try {
    const { id } = req.params;
    const { n = 5, minSimilarity = 0.6 } = req.query;

    const recommendations = await recommendSimilarTopics(
      id,
      parseInt(n as string),
      parseFloat(minSimilarity as string)
    );

    res.json({ recommendations });
  } catch (error: any) {
    logger.error(`推荐相似主题失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * POST /api/topics/:id/increment
 * 增加主题使用次数
 */
router.post('/:id/increment', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await incrementTopicUseCount(id);

    if (!success) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '主题不存在',
      });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error(`增加主题使用次数失败：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

export default router;
