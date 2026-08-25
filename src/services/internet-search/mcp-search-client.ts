/**
 * MCP Streamable HTTP 客户端
 * 负责与 social-search MCP 服务通信
 */

import { getLogger } from '../../utils/logger';

const logger = getLogger('mcp-search-client');

/** MCP 服务配置 */
interface McpClientConfig {
  endpoint: string;
  apiKey: string;
  timeout: number;
}

/** MCP 工具调用参数 */
interface ToolCallParams {
  name: string;
  arguments: Record<string, any>;
}

/** MCP 响应结果 */
interface McpToolResult {
  content: Array<{ type: string; text: string }>;
}

/**
 * MCP Streamable HTTP 客户端
 * 封装 JSON-RPC over SSE 协议
 */
export class McpSearchClient {
  private config: McpClientConfig;
  private requestId = 0;
  private initialized = false;

  constructor() {
    this.config = {
      endpoint: process.env.MCP_SEARCH_ENDPOINT || 'http://192.168.50.10:3090/mcp',
      apiKey: process.env.MCP_SEARCH_API_KEY || 'f6758b51d76a164f0ca6ea09f7caf50f12455379b698e601',
      timeout: parseInt(process.env.MCP_SEARCH_TIMEOUT || '60000', 10),
    };
  }

  /**
   * 调用 MCP 工具
   */
  async callTool<T = any>(params: ToolCallParams): Promise<T> {
    const id = ++this.requestId;

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: params.name,
        arguments: params.arguments,
      },
    });

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`MCP HTTP ${response.status}: ${errText}`);
      }

      // 解析 SSE 响应
      const rawText = await response.text();
      const result = this.parseSSEResponse(rawText, id);

      if (!result) {
        throw new Error('MCP 响应解析失败：无有效 data');
      }

      // 提取工具返回的文本内容
      const toolResult = result as McpToolResult;
      if (!toolResult.content || toolResult.content.length === 0) {
        throw new Error('MCP 工具返回空内容');
      }

      const textContent = toolResult.content.find(c => c.type === 'text');
      if (!textContent) {
        throw new Error('MCP 工具返回无文本内容');
      }

      return JSON.parse(textContent.text) as T;

    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        logger.error(`MCP 调用超时 (${this.config.timeout}ms): ${params.name}`);
        throw new Error(`MCP 调用超时: ${params.name}`);
      }
      throw error;
    }
  }

  /**
   * 解析 SSE 格式响应
   * 格式: "event: message\ndata: {...}\n\n"
   */
  private parseSSEResponse(raw: string, expectedId: number): any | null {
    const lines = raw.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(line.slice(6));

        // 检查是否为错误响应
        if (json.error) {
          throw new Error(`MCP 错误 [${json.error.code}]: ${json.error.message}`);
        }

        // 匹配请求 ID
        if (json.id === expectedId && json.result) {
          return json.result;
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('MCP 错误')) {
          throw e;
        }
        // JSON 解析失败，跳过
      }
    }

    return null;
  }

  /**
   * 检查 MCP 服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const healthUrl = this.config.endpoint.replace('/mcp', '/health');
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 导出单例
export const mcpSearchClient = new McpSearchClient();
