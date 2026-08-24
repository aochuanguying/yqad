import { Router, Request, Response } from 'express';
import { zhihuAdapter } from '../../adapters/zhihu-adapter';
import { xiaohongshuAdapter } from '../../adapters/xiaohongshu-adapter';
import { autohomeAdapter } from '../../adapters/autohome-adapter';

const router = Router();

/**
 * POST /api/search/zhihu
 */
router.post('/zhihu', async (req: Request, res: Response) => {
  try {
    const { query, type, maxResults, summaryMode, noCache } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: '缺少 query 参数' });
      return;
    }

    const results = await zhihuAdapter.search({ query, type, maxResults, summaryMode, noCache });
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/search/zhihu/content
 */
router.post('/zhihu/content', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: '缺少 url 参数' });
      return;
    }

    const result = await zhihuAdapter.getContent({ url });
    if ('error' in result) {
      res.status(404).json(result);
      return;
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/search/xiaohongshu
 */
router.post('/xiaohongshu', async (req: Request, res: Response) => {
  try {
    const { query, sortBy, maxResults, summaryMode, noCache } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: '缺少 query 参数' });
      return;
    }

    const results = await xiaohongshuAdapter.search({ query, sortBy, maxResults, summaryMode, noCache });
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/search/xiaohongshu/note
 */
router.post('/xiaohongshu/note', async (req: Request, res: Response) => {
  try {
    const { noteId, xsecToken } = req.body;

    if (!noteId || typeof noteId !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: '缺少 noteId 参数' });
      return;
    }

    const result = await xiaohongshuAdapter.getContent({ noteId, xsecToken: xsecToken || '' });
    if ('error' in result) {
      res.status(404).json(result);
      return;
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/search/autohome
 */
router.post('/autohome', async (req: Request, res: Response) => {
  try {
    const { query, maxResults, summaryMode, noCache } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: '缺少 query 参数' });
      return;
    }

    const results = await autohomeAdapter.search({ query, maxResults, summaryMode, noCache });
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/search/autohome/post
 */
router.post('/autohome/post', async (req: Request, res: Response) => {
  try {
    const { postUrl } = req.body;

    if (!postUrl || typeof postUrl !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: '缺少 postUrl 参数' });
      return;
    }

    const result = await autohomeAdapter.getContent({ postUrl });
    if ('error' in result) {
      res.status(404).json(result);
      return;
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

export default router;
