import express from 'express';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import searchRoutes from './routes/search';
import { getOpenApiSpec } from './openapi';
import { cookiePool } from '../infra/cookie-pool';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createMcpServer } from '../mcp/server';

function createApp() {
  const app = express();

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

  // REST API 路由（需要鉴权 + 限流）
  app.use('/api/search', authMiddleware, rateLimitMiddleware, searchRoutes);

  return app;
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
  });
}

/**
 * 组合模式：REST + MCP Streamable HTTP 共享同一端口
 * MCP 采用无状态模式（sessionIdGenerator: undefined），每次请求独立处理
 */
export async function startCombinedServer(port: number): Promise<void> {
  await cookiePool.init();
  const app = createApp();

  // MCP Streamable HTTP 端点（无状态模式）
  app.all('/mcp', async (req, res) => {
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

  app.listen(port, () => {
    console.log(`[social-search] 组合模式已启动: http://0.0.0.0:${port}`);
    console.log(`[social-search] REST API: http://0.0.0.0:${port}/api/search/`);
    console.log(`[social-search] MCP Streamable HTTP: http://0.0.0.0:${port}/mcp`);
    console.log(`[social-search] OpenAPI: http://0.0.0.0:${port}/openapi.json`);
  });
}
