import express from 'express';
import path from 'path';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import searchRoutes from './routes/search';
import cookieConfigRoutes from './routes/cookie-config';
import { getOpenApiSpec } from './openapi';
import { cookiePool } from '../infra/cookie-pool';
import { CookieRefreshService } from '../services/cookie-refresh/refresh-service';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createMcpServer } from '../mcp/server';

function createApp() {
  const app = express();

  // 全局请求日志
  app.use((req, res, next) => {
    console.log(`[http] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  });

  // /mcp 路由由 MCP SDK 自行解析 body，不能预先 parse
  app.use((req, res, next) => {
    if (req.path === '/mcp') {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // OpenAPI spec（无需鉴权）
  app.get('/openapi.json', (_req, res) => {
    res.json(getOpenApiSpec());
  });

  // 健康检查（无需鉴权）
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', cookiePool: cookiePool.getStatus() });
  });

  // Web 管理页面 - 直接用路由返回 HTML，不用 static 中间件
  const webDir = path.join(__dirname, '../../web');
  const fs = require('fs');
  const adminHtml = fs.readFileSync(path.join(webDir, 'index.html'), 'utf-8');
  app.get('/admin', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(adminHtml);
  });
  app.get('/admin/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(adminHtml);
  });
  console.log('[routes] /admin registered (direct HTML)');

  // Cookie 配置管理 API（无需鉴权，内部管理页面使用）
  app.use('/api/cookie-configs', cookieConfigRoutes);

  // REST API 路由（需要鉴权 + 限流）
  app.use('/api/search', authMiddleware, rateLimitMiddleware, searchRoutes);

  // MCP Streamable HTTP 端点（需要鉴权）- 放在所有路由最后
  app.all('/mcp', authMiddleware, async (req, res) => {
    try {
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal error', message: err.message });
      }
    }
  });
  console.log('[routes] /mcp registered (protected by auth)');

  return app;
}

/**
 * 启动 Cookie 自动续期定时器
 * 每天 4 次：2:00, 8:00, 14:00, 20:00（每 6 小时）
 */
function startCookieRefreshScheduler(): void {
  const refreshService = CookieRefreshService.getInstance();

  // 计算到下一个整点（2/8/14/20 点）的延迟
  function scheduleNext(): void {
    const now = new Date();
    const hours = [2, 8, 14, 20];
    let nextHour = hours.find(h => h > now.getHours());
    if (nextHour === undefined) nextHour = hours[0]; // 下一个是明天凌晨 2 点

    const next = new Date(now);
    if (nextHour > now.getHours()) {
      next.setHours(nextHour, 0, 0, 0);
    } else {
      next.setDate(next.getDate() + 1);
      next.setHours(nextHour, 0, 0, 0);
    }

    const delay = next.getTime() - now.getTime();
    console.log(`[cookie-scheduler] 下次自动续期: ${next.toISOString().replace('T', ' ').substring(0, 19)}（${Math.round(delay / 60000)} 分钟后）`);

    setTimeout(async () => {
      console.log('[cookie-scheduler] 开始自动续期...');
      await refreshService.autoRefreshAll();
      scheduleNext();
    }, delay);
  }

  // 启动时先立即执行一次检查
  console.log('[cookie-scheduler] 启动时检查 Cookie 状态...');
  refreshService.autoRefreshAll().then(() => {
    scheduleNext();
  });
}

/**
 * 仅 REST 模式启动
 */
export async function startRestServer(port: number): Promise<void> {
  await cookiePool.init();
  const app = createApp();

  app.listen(port, () => {
    console.log(`[rest] REST API 已启动: http://0.0.0.0:${port}`);
    console.log(`[rest] OpenAPI 文档: http://0.0.0.0:${port}/openapi.json`);
    console.log(`[rest] Cookie 管理页面: http://0.0.0.0:${port}/admin`);
  });

  startCookieRefreshScheduler();
}

/**
 * 组合模式：REST + MCP Streamable HTTP 共享同一端口
 * MCP 采用无状态模式（sessionIdGenerator: undefined），每次请求独立处理
 */
export async function startCombinedServer(port: number): Promise<void> {
  await cookiePool.init();
  const app = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[social-search] 组合模式已启动：http://0.0.0.0:${port}`);
    console.log(`[social-search] REST API: http://0.0.0.0:${port}/api/search/`);
    console.log(`[social-search] MCP Streamable HTTP: http://0.0.0.0:${port}/mcp`);
    console.log(`[social-search] OpenAPI: http://0.0.0.0:${port}/openapi.json`);
    console.log(`[social-search] Cookie 管理页面：http://0.0.0.0:${port}/admin`);
  });
  
  // 禁用 IPv6
  server.on('listening', () => {
    server.address();
  });

  startCookieRefreshScheduler();
}
