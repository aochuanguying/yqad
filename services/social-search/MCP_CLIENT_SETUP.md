# MCP 客户端配置指南

本文档介绍如何在不同的 MCP 客户端中配置连接到 Social Search MCP 服务器。

## 配置信息

- **服务器地址**: `http://192.168.50.10:3090/mcp`
- **API Key**: `social-search-api-key-2026`
- **连接模式**: HTTP (Streamable HTTP)

## Claude Desktop

### 配置文件位置

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 配置示例

```json
{
  "mcpServers": {
    "social-search": {
      "url": "http://192.168.50.10:3090/mcp",
      "headers": {
        "Authorization": "Bearer social-search-api-key-2026"
      }
    }
  }
}
```

## VS Code (GitHub Copilot Chat)

### 配置文件位置

在项目根目录创建 `.vscode/mcp.json` 或在工作区设置中配置。

### 配置示例

```json
{
  "mcpServers": {
    "social-search": {
      "url": "http://192.168.50.10:3090/mcp",
      "headers": {
        "Authorization": "Bearer social-search-api-key-2026",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

## 通用配置（参考配置文件）

项目根目录提供了参考配置文件：`services/social-search/mcp-client-config.json`

```json
{
  "mcpServers": {
    "social-search": {
      "url": "http://192.168.50.10:3090/mcp",
      "headers": {
        "Authorization": "Bearer social-search-api-key-2026",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

## 可用的 MCP Tools

连接成功后，你可以使用以下工具：

1. **zhihu_search** - 搜索知乎内容
   - 参数：`query` (搜索关键词)
   
2. **xiaohongshu_search** - 搜索小红书内容
   - 参数：`query` (搜索关键词)

## 测试连接

使用 curl 测试连接：

```bash
# 测试认证
curl -X POST http://192.168.50.10:3090/mcp \
  -H "Authorization: Bearer social-search-api-key-2026" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## 自定义 API Key

如果需要修改 API Key，在 Docker 容器中设置环境变量：

```bash
docker run -e API_KEYS="your-custom-key-1,your-custom-key-2" ...
```

然后重启容器使配置生效。

## 故障排查

### 1. 认证失败

错误信息：`{"error":"Unauthorized","code":"INVALID_API_KEY"}`

解决方案：
- 检查 Authorization header 格式是否正确
- 确认 API Key 是否正确
- 确认 Bearer 和 key 之间有空格

### 2. 连接失败

错误信息：`Connection refused` 或 `ETIMEDOUT`

解决方案：
- 确认服务器地址和端口正确
- 确认容器正在运行：`docker ps | grep social-search`
- 检查防火墙设置

### 3. MCP 服务器无响应

解决方案：
- 查看服务器日志：`docker logs social-search`
- 确认 MCP 端点已注册：日志中应显示 `[routes] /mcp registered (protected by auth)`
