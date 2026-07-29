import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { zhihuAdapter } from '../adapters/zhihu-adapter';
import { xiaohongshuAdapter } from '../adapters/xiaohongshu-adapter';
import { cookiePool } from '../infra/cookie-pool';
import express from 'express';

function createServer(): McpServer {
  const server = new McpServer({
    name: 'social-search',
    version: '1.0.0',
  });

  // 知乎搜索
  server.tool(
    'zhihu_search',
    '搜索知乎问答和文章',
    {
      query: z.string().describe('搜索关键词'),
      type: z.enum(['general', 'article']).optional().describe('搜索类型：general（综合）或 article（专栏文章）'),
      maxResults: z.number().optional().describe('最大返回结果数，默认 10'),
      summaryMode: z.boolean().optional().describe('摘要模式，限制返回内容长度'),
    },
    async (args) => {
      const results = await zhihuAdapter.search(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // 知乎内容详情
  server.tool(
    'zhihu_get_content',
    '获取知乎回答或文章的完整内容',
    {
      url: z.string().describe('知乎回答或文章 URL'),
    },
    async (args) => {
      const result = await zhihuAdapter.getContent(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 小红书搜索
  server.tool(
    'xiaohongshu_search',
    '搜索小红书笔记',
    {
      query: z.string().describe('搜索关键词'),
      sortBy: z.enum(['relevance', 'latest']).optional().describe('排序方式：relevance（相关性）或 latest（最新）'),
      maxResults: z.number().optional().describe('最大返回结果数，默认 10'),
      summaryMode: z.boolean().optional().describe('摘要模式，限制返回内容长度'),
    },
    async (args) => {
      const results = await xiaohongshuAdapter.search(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // 小红书笔记详情
  server.tool(
    'xiaohongshu_get_note',
    '获取小红书笔记的完整内容',
    {
      noteId: z.string().describe('小红书笔记 ID'),
      xsecToken: z.string().optional().describe('从搜索结果中获取的 xsec_token（可选，提高成功率）'),
    },
    async (args) => {
      const result = await xiaohongshuAdapter.getContent({ noteId: args.noteId, xsecToken: args.xsecToken || '' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

/**
 * stdio 模式启动
 */
export async function startMcpStdio(): Promise<void> {
  await cookiePool.init();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] stdio 模式已启动');
}

/**
 * SSE 模式启动（独立 HTTP 服务）
 */
export async function startMcpSse(port: number): Promise<void> {
  await cookiePool.init();
  const server = createServer();

  const app = express();
  const transports: Map<string, SSEServerTransport> = new Map();

  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.on('close', () => {
      transports.delete(sessionId);
    });

    await server.connect(transport);
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
    console.log(`[mcp] SSE 模式已启动: http://0.0.0.0:${port}/sse`);
  });
}

export { createServer };
