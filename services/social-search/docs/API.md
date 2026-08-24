# Social Search API 文档

## 服务地址

| 协议 | 地址 | 用途 |
|------|------|------|
| MCP Streamable HTTP | `https://mcp.hxfssc.com:8088/mcp` | AI IDE 客户端（Kiro/Cursor/Claude Desktop） |
| REST API | `https://mcp.hxfssc.com:8088/api/search/` | 智能体平台（Coze/Dify/FastGPT）、自定义程序 |
| OpenAPI 文档 | `https://mcp.hxfssc.com:8088/openapi.json` | 导入到智能体平台 |
| 健康检查 | `https://mcp.hxfssc.com:8088/health` | 监控 |

---

## 一、MCP 客户端接入

### Kiro / Cursor / Claude Deskt
在 `~/.kiro/settings/mcp.json`（或对应客户端的 MCP 配置文件）中添加：

```json
{
  "mcpServers": {
    "social-search": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.hxfssc.com:8088/mcp"]
    }
  }
}
```

> 需要本机安装 Node.js（>= 18）。`mcp-remote` 会自动下载，无需手动安装。

配置后重启 IDE 或重连 MCP Server，即可在对话中使用以下工具：

| 工具名 | 功能 |
|--------|------|
| `zhihu_search` | 搜索知乎问答和文章 |
| `zhihu_get_content` | 获取知乎回答/文章完整正文和图片 |
| `xiaohongshu_search` | 搜索小红书笔记 |
| `xiaohongshu_get_note` | 获取小红书笔记完整内容、图片、标签 |

---

### 直接调用 MCP Streamable HTTP（自定义 MCP 客户端）

端点：`POST https://mcp.hxfssc.com:8088/mcp`

请求头：
```
Content-Type: application/json
Accept: application/json, text/event-stream
```

#### 1. 初始化

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "my-client", "version": "1.0.0" }
  }
}
```

响应（SSE 格式）：
```
event: message
data: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"social-search","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
```

#### 2. 获取工具列表

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

#### 3. 调用工具

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "xiaohongshu_search",
    "arguments": {
      "query": "露营好物推荐",
      "maxResults": 5
    }
  }
}
```

---

## 二、REST API 接入

### 鉴权

所有 REST API 请求需要在 Header 中携带 API Key：

```
Authorization: Bearer f6758b51d76a164f0ca6ea09f7caf50f12455379b698e601
```

---

### 知乎搜索

```
POST /api/search/zhihu
```

请求体：
```json
{
  "query": "奥迪Q5L 2025款评价",
  "type": "general",
  "maxResults": 5,
  "summaryMode": false,
  "noCache": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词 |
| type | string | 否 | `general`（综合）或 `article`（专栏文章），默认 general |
| maxResults | number | 否 | 最大返回数，默认 10 |
| summaryMode | boolean | 否 | 摘要模式（snippet 限 100 字），默认 false |
| noCache | boolean | 否 | 跳过缓存，默认 false |

响应：
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "title": "BBA中，奔驰glc宝马X3，奥迪Q5L哪个值得入手？",
      "snippet": "日常如果不非要使劲豁车...",
      "author": "4YourEyezOnly",
      "url": "https://www.zhihu.com/question/449321891/answer/1947983474",
      "extra": {
        "type": "Answer",
        "voteCount": 1092,
        "commentCount": 175
      }
    }
  ]
}
```

---

### 知乎内容详情

```
POST /api/search/zhihu/content
```

请求体：
```json
{
  "url": "https://www.zhihu.com/question/449321891/answer/1947983474"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 知乎回答或文章 URL |

响应：
```json
{
  "success": true,
  "data": {
    "title": "BBA中，奔驰glc宝马X3，奥迪Q5L哪个值得入手？",
    "content": "先给结论...(完整正文)",
    "author": "4YourEyezOnly",
    "url": "https://www.zhihu.com/question/449321891/answer/1947983474",
    "extra": {
      "images": [
        "https://picx.zhimg.com/v2-xxx.jpg",
        "https://picx.zhimg.com/v2-yyy.jpg"
      ],
      "voteCount": 1092,
      "commentCount": 175
    }
  }
}
```

---

### 小红书搜索

```
POST /api/search/xiaohongshu
```

请求体：
```json
{
  "query": "露营好物推荐",
  "sortBy": "relevance",
  "maxResults": 5,
  "summaryMode": false,
  "noCache": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词 |
| sortBy | string | 否 | `relevance`（相关性）或 `latest`（最新），默认 relevance |
| maxResults | number | 否 | 最大返回数，默认 10 |
| summaryMode | boolean | 否 | 摘要模式，默认 false |
| noCache | boolean | 否 | 跳过缓存，默认 false |

响应：
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "title": "新手露营👏有哪些好用建议？",
      "snippet": "",
      "author": "郑小喜",
      "url": "https://www.xiaohongshu.com/explore/69d6fc08000000001f007646",
      "extra": {
        "noteId": "69d6fc08000000001f007646",
        "xsecToken": "ABtw5Uqcm...",
        "coverImage": "https://...",
        "likeCount": "6082",
        "collectCount": "5659",
        "commentCount": "309"
      }
    }
  ]
}
```

---

### 小红书笔记详情

```
POST /api/search/xiaohongshu/note
```

请求体：
```json
{
  "noteId": "69d6fc08000000001f007646",
  "xsecToken": "ABtw5Uqcm..."
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| noteId | string | 是 | 小红书笔记 ID（从搜索结果 extra.noteId 获取） |
| xsecToken | string | 否 | 从搜索结果 extra.xsecToken 获取，提高成功率 |

响应：
```json
{
  "success": true,
  "data": {
    "title": "新手露营👏有哪些好用建议？",
    "content": "最近把自己自驾露营常带的东西重新整理了一遍...",
    "author": "郑小喜",
    "url": "https://www.xiaohongshu.com/explore/69d6fc08000000001f007646",
    "extra": {
      "noteId": "69d6fc08000000001f007646",
      "images": [
        "http://sns-webpic-qc.xhscdn.com/...",
        "http://sns-webpic-qc.xhscdn.com/..."
      ],
      "tags": ["自驾露营", "露营装备", "户外装备"],
      "likeCount": "6082",
      "collectCount": "5659",
      "commentCount": "309"
    }
  }
}
```

---

## 三、智能体平台接入（Coze / Dify / FastGPT）

### 方式 1：导入 OpenAPI

1. 在平台的「插件/工具」管理中选择「导入 OpenAPI」
2. URL 填：`https://mcp.hxfssc.com:8088/openapi.json`
3. 鉴权方式选 Bearer Token，填入 API Key

### 方式 2：手动配置

如果平台不支持 URL 导入，下载 OpenAPI JSON 后手动上传：

```bash
curl -o openapi.json https://mcp.hxfssc.com:8088/openapi.json
```

---

## 四、错误码

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 401 | INVALID_API_KEY | API Key 无效或缺失 |
| 429 | RATE_LIMIT_EXCEEDED | 请求频率超限，参考 Retry-After 头 |
| 404 | NOTE_NOT_FOUND / CONTENT_NOT_FOUND | 内容不存在或已删除 |
| 500 | Internal Error | 服务内部错误 |

---

## 五、频率限制

- 每个 API Key 每分钟 30 次请求
- 每个平台（知乎/小红书）每分钟 10 次搜索
- 搜索结果缓存 10 分钟（可通过 noCache=true 跳过）
- 响应 Header `X-RateLimit-Remaining` 表示剩余次数

---

## 六、curl 示例

```bash
# 知乎搜索
curl -X POST https://mcp.hxfssc.com:8088/api/search/zhihu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f6758b51d76a164f0ca6ea09f7caf50f12455379b698e601" \
  -d '{"query":"新能源车推荐","maxResults":5}'

# 小红书搜索
curl -X POST https://mcp.hxfssc.com:8088/api/search/xiaohongshu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f6758b51d76a164f0ca6ea09f7caf50f12455379b698e601" \
  -d '{"query":"露营装备","maxResults":5}'

# 知乎详情
curl -X POST https://mcp.hxfssc.com:8088/api/search/zhihu/content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f6758b51d76a164f0ca6ea09f7caf50f12455379b698e601" \
  -d '{"url":"https://www.zhihu.com/question/449321891/answer/1947983474"}'

# 小红书详情
curl -X POST https://mcp.hxfssc.com:8088/api/search/xiaohongshu/note \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f6758b51d76a164f0ca6ea09f7caf50f12455379b698e601" \
  -d '{"noteId":"69d6fc08000000001f007646","xsecToken":"ABtw5Uqcm..."}'

# MCP 初始化（Streamable HTTP）
curl -X POST https://mcp.hxfssc.com:8088/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```
