import express from 'express';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import searchRoutes from './routes/search';
import { getOpenApiSpec } from './openapi';
import { cookiePool } from '../infra/cookie-pool';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer as createMcpServer } from '../mcp/server';

function createApp() {
  const app = express();

  app.use(express.json());

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
 * 组合模式：REST + MCP SSE 共享同一端口
 */
export async function startCombinedServer(port: number): Promise<void> {
  await cookiePool.init();
  const app = createApp();
  const mcpServer = createMcpServer();
  const transports: Map<string, SSEServerTransport> = new Map();

  // MCP SSE 端点（无需 REST 鉴权，MCP 协议自身管理）
  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.on('close', () => {
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.listen(port, () => {
    console.log(`[social-search] 组合模式已启动: http://0.0.0.0:${port}`);
    console.log(`[social-search] REST API: http://0.0.0.0:${port}/api/search/`);
    console.log(`[social-search] MCP SSE: http://0.0.0.0:${port}/sse`);
    console.log(`[social-search] OpenAPI: http://0.0.0.0:${port}/openapi.json`);
  });
}
