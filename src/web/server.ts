import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { errorHandler } from './middleware/error-handler';
import { jsonBodyParser } from './middleware/json-body-parser';
import { createSessionMiddleware } from './middleware/session-middleware';
import { createAuthMiddleware } from './middleware/auth-middleware';
import { SUPPORTED_IMAGE_EXTENSIONS } from '../services/material-processing';
import { verifyApiToken } from '../utils/api-token';

const logger = getLogger('web-server');

/**
 * 图片下载权限验证中间件
 * 只允许访问图片文件，禁止访问其他类型文件
 */
function imageAccessMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const config = loadConfig();
  
  // 获取请求的文件路径
  const basePath = config.materials.processedPath || './data/materials/processed';
  const basePathResolved = path.resolve(basePath);
  
  // 解码 URL 路径（处理中文等编码字符）
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch (error: any) {
    logger.warn(`URL 解码失败：${req.path} - ${error.message}`);
    res.status(400).json({ error: '无效的路径编码', code: 'INVALID_ENCODING' });
    return;
  }
  
  // 移除开头的斜杠，构建相对路径
  const relativePath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
  const filePathResolved = path.resolve(basePathResolved, relativePath);

  if (filePathResolved !== basePathResolved && !filePathResolved.startsWith(`${basePathResolved}${path.sep}`)) {
    logger.warn(`禁止访问越界路径：${req.path}`);
    res.status(403).json({ error: '禁止访问非图片文件', code: 'ACCESS_DENIED' });
    return;
  }
  
  // 检查文件是否存在
  if (!fs.existsSync(filePathResolved)) {
    logger.warn(`图片文件不存在：${filePathResolved}`);
    res.status(404).json({ error: '文件不存在', code: 'FILE_NOT_FOUND' });
    return;
  }
  
  // 检查文件扩展名
  const ext = path.extname(filePathResolved).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    logger.warn(`禁止访问非图片文件：${filePathResolved} (${ext})`);
    res.status(403).json({ error: '禁止访问非图片文件', code: 'ACCESS_DENIED' });
    return;
  }
  
  // 允许访问
  next();
}

function listenWithFallback(app: express.Express, port: number, attemptsLeft: number): void {
  app
    .listen(port, '0.0.0.0', () => {
      logger.info(`Web 管理界面已启动：http://0.0.0.0:${port}`);
      logger.info(`本地访问：http://localhost:${port}`);
      logger.info(`远程访问：http://<服务器 IP>:${port}`);
    })
    .on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        logger.warn(`端口 ${port} 已被占用，尝试使用端口 ${port + 1}`);
        listenWithFallback(app, port + 1, attemptsLeft - 1);
        return;
      }
      throw err;
    });
}

export function createWebApp(params?: { includeApiRoutes?: boolean }): express.Express {
  const config = loadConfig();
  const includeApiRoutes = params?.includeApiRoutes ?? true;

  const app = express();

  // 安全中间件：设置安全响应头
  app.use(helmet({
    contentSecurityPolicy: false, // 允许内联脚本（前端为纯 HTML）
  }));

  // 登录接口速率限制：15 分钟内最多 10 次
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', loginLimiter);

  app.use(jsonBodyParser());

  // 应用 Session 中间件（在路由之前）
  const sessionMiddleware = createSessionMiddleware();
  app.use(sessionMiddleware);

  if (includeApiRoutes) {
    // 创建认证中间件（使用配置中的公开路由白名单）
    const authMiddleware = createAuthMiddleware();
    
    // 先注册 API 路由（在静态文件之前）
    const configRoutes = require('./routes/config-routes').default;
    const materialsRoutes = require('./routes/materials-routes').default;
    const topicsRoutes = require('./routes/topics-routes').default;
    const authRoutes = require('./routes/auth-routes').default;
    const memberRoutes = require('./routes/member-routes').default;
    const globalPromptRoutes = require('./routes/global-prompt-routes').default;
    const aiHealthRoutes = require('./routes/ai-health-routes').default;
    const postsRoutes = require('./routes/posts-routes').default;
    const commentRoutes = require('./routes/comment-routes').default;
    const enhancedCommentRoutes = require('./routes/enhanced-comment-routes').default;
    const vehicleMonitorRoutes = require('./routes/vehicle-monitor-routes').default;
    const vehicleTokenRoutes = require('./routes/vehicle-token-routes').default;
    const telecomRoutes = require('./routes/telecom-routes').default;
    const tokenRoutes = require('./routes/token-routes').default;
    const memberManagementRoutes = require('./routes/member-management-routes').memberManagementRoutes;

    // token-routes 定义的是 /token，所以挂载在 /api 下（公开路由，不需要认证）
    // 必须放在所有 /api 路由之前，避免被认证中间件拦截
    app.use('/api/token', tokenRoutes);
    
    // 增强评论服务路由（使用 ChromaDB 情感分析）
    app.use('/api/comments', authMiddleware, enhancedCommentRoutes);
    
    // 会员管理路由（使用 MySQL 存储）
    app.use('/api/members', authMiddleware, memberManagementRoutes);
    
    // 应用认证中间件到所有 API 路由（公开路由会自动跳过）
    // 注意：具体的路由必须放在通用的 '/api' 路由之前，避免被拦截
    // posts-routes 使用独立的 API Token 鉴权，不经过登录会话鉴权
    app.use('/api/posts', postsRoutes);
    // comment-routes 使用独立的 API Token 鉴权
    app.use('/api/comment', commentRoutes);
    // vehicle-token-routes 使用独立的 API Token 鉴权
    app.use('/api/vehicle-token', vehicleTokenRoutes);
    // 素材库路由（需要认证）
    app.use('/api/materials', authMiddleware, materialsRoutes);
    // 发帖主题路由（需要认证）
    app.use('/api/topics', authMiddleware, topicsRoutes);
    app.use('/api/auth', authRoutes);  // 认证路由不需要中间件（内部处理）
    // member-routes 定义的是 /info，所以挂载在 /api/member 下
    app.use('/api/member', authMiddleware, memberRoutes);
    // vehicle-monitor-routes 定义的是 /status, /execute, /alerts，所以挂载在 /api/vehicle-monitor 下
    app.use('/api/vehicle-monitor', authMiddleware, vehicleMonitorRoutes);
    // 通用 /api 路由必须放在最后，避免拦截其他具体路由
    // config-routes 定义的是 /config，所以挂载在 /api 下
    app.use('/api', authMiddleware, configRoutes);
    // global-prompt-routes 定义的是 /global-prompt，所以挂载在 /api 下
    app.use('/api', authMiddleware, globalPromptRoutes);
    // ai-health-routes 定义的是 /ai-health，所以挂载在 /api 下
    app.use('/api', authMiddleware, aiHealthRoutes);
    // telecom-routes 定义的是 /telecom-config, /telecom-test, /alert-history，所以挂载在 /api 下
    app.use('/api', authMiddleware, telecomRoutes);
  }

  // 静态文件中间件放在 API 路由之后（禁用缓存，确保实时更新）
  app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: 0,  // 不缓存 HTML 文件
    setHeaders: (res, filePath) => {
      // 对 HTML 文件设置不缓存
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // 对 JS/CSS 文件设置短期缓存
      else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 分钟
      }
    },
  }));

  const materialsPath = config.materials.processedPath || './data/materials/processed';
  app.use('/images', imageAccessMiddleware, express.static(materialsPath));

  app.use(errorHandler);

  return app;
}

/**
 * 创建并启动 Web 管理服务器
 */
export function startWebServer(): void {
  const config = loadConfig();

  if (!config.web.enabled) {
    logger.info('Web管理界面已禁用');
    return;
  }

  const port = config.web.port;
  const app = createWebApp();

  // 启动服务器
  listenWithFallback(app, port, 10);
}
