import { Router, Request, Response } from 'express';
import { cookieConfigStorage } from '../../infra/cookie-config-storage';
import { CookieRefreshService, getTaskStatus } from '../../services/cookie-refresh/refresh-service';
import { jwtMiddleware, generateToken, validateCredentials } from '../middleware/auth';

const router = Router();
const refreshService = CookieRefreshService.getInstance();

// ============================================================
// 认证 API（无需 JWT）
// ============================================================

// 登录
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '缺少用户名或密码' });
    }

    if (!validateCredentials(username, password)) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    const token = generateToken(username);
    res.json({ success: true, token, username });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 验证 Token（用于前端检查登录状态）
router.get('/auth/verify', jwtMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, user: req.user });
});

// ============================================================
// CRUD（需要 JWT 鉴权）
// ============================================================

// 列出所有配置
router.get('/cookie-configs', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const platform = req.query.platform as string | undefined;
    if (!platform) {
      return res.status(400).json({ success: false, error: '缺少 platform 参数' });
    }
    const configs = await cookieConfigStorage.getAllByPlatform(platform);
    res.json({ success: true, data: configs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取单个配置详情
router.get('/cookie-configs/:id', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const config = await cookieConfigStorage.getById(id);
    if (!config) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建配置
router.post('/cookie-configs', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const { platform, label, cookie, accessSecret, priority, weight } = req.body;
    if (!platform) {
      return res.status(400).json({ success: false, error: '缺少 platform 参数' });
    }
    const id = await cookieConfigStorage.create({ platform, label, cookie, accessSecret, priority, weight });
    const config = await cookieConfigStorage.getById(id);
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新配置
router.put('/cookie-configs/:id', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { label, cookie, accessSecret, enabled, priority, weight } = req.body;
    await cookieConfigStorage.update(id, { label, cookie, accessSecret, enabled, priority, weight });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除配置（软删除）
router.delete('/cookie-configs/:id', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await cookieConfigStorage.softDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Cookie 状态
// ============================================================

router.get('/cookie-configs/:id/status', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const status = await cookieConfigStorage.getStatus(id);
    if (!status) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 测试连接
// ============================================================

router.post('/cookie-configs/test-zhihu', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const { accessSecret } = req.body;
    if (!accessSecret) {
      return res.status(400).json({ success: false, error: '缺少 accessSecret 参数' });
    }
    const result = await cookieConfigStorage.testZhihu(accessSecret);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cookie-configs/test-xiaohongshu', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const { cookie } = req.body;
    if (!cookie) {
      return res.status(400).json({ success: false, error: '缺少 cookie 参数' });
    }
    const result = await cookieConfigStorage.testXiaohongshu(cookie);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cookie-configs/test-autohome', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const { autohomeAdapter } = await import('../../adapters/autohome-adapter');
    const results = await autohomeAdapter.search({ query: '新车', maxResults: 3, noCache: true });
    res.json({ success: true, resultCount: results.length });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// ============================================================
// 扫码刷新
// ============================================================

// 启动手动扫码刷新
router.post('/cookie-configs/cookie/refresh', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    const { configId } = req.body;
    if (!configId) {
      return res.status(400).json({ success: false, error: '缺少 configId 参数' });
    }
    const taskId = await refreshService.startManualRefresh(configId);
    res.json({ success: true, taskId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 轮询扫码刷新状态
router.get('/cookie-configs/cookie/refresh/:taskId/status', jwtMiddleware, (req: Request, res: Response) => {
  const status = getTaskStatus(req.params.taskId);
  if (!status) {
    return res.status(404).json({ success: false, error: '任务不存在或已过期' });
  }
  res.json(status);
});

export default router;
