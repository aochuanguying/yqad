## Context

yqad 项目中已有知乎和小红书的 Cookie 管理与内容抓取逻辑，但耦合在业务代码中，无法被外部系统调用。需要将搜索能力抽成独立服务，同时服务于 AI IDE 客户端（通过 MCP 协议）和智能体开发平台（通过 REST API）。

当前状态：
- 知乎/小红书 Cookie 存储在 MySQL `cookies` 表，由 yqad 定时刷新
- 搜索逻辑分散在 `src/services/` 的各个 service 中
- Redis（192.168.50.50:6379）可用于缓存和频率控制
- 部署环境为 x5-server（192.168.50.10），Docker 容器

## Goals / Non-Goals

**Goals:**

- 提供统一的社交平台搜索服务，支持 MCP（stdio/SSE）和 REST 双协议
- 初期覆盖知乎、小红书两个平台，架构支持后续扩展
- 复用 yqad 的 Cookie 刷新机制，不重复造轮子
- 支持本地运行（开发/个人使用）和远程部署（团队/平台使用）
- 提供 OpenAPI 规范，一键导入 Coze/Dify 等平台

**Non-Goals:**

- 不做通用爬虫框架
- 不做内容存储/索引（只做实时搜索，不持久化搜索结果）
- 不做用户系统（API Key 通过配置文件管理，不做注册登录）
- 不做 MCP 市场/注册中心（后续独立项目）
- 初期不做代理 IP 池（预留接口，默认直连）

## Decisions

### 1. 项目结构：yqad 子目录 vs 独立仓库

**决策**：放在 yqad 项目内 `services/social-search/` 子目录

**理由**：
- 复用 yqad 的 MySQL 连接配置和 Cookie 表
- 共享 node_modules 中的 mysql2、ioredis 等依赖
- 部署时与 yqad 在同一 Docker 网络，直接访问数据库
- 后续如需独立可轻松拆出

**替代方案**：独立仓库 — 隔离更好但增加维护成本和跨库协调

### 2. MCP SDK 选择

**决策**：使用 `@modelcontextprotocol/sdk`（官方 TypeScript SDK）

**理由**：
- 官方维护，协议更新最快
- 内置 stdio 和 SSE 两种 transport
- 与 yqad 的 TypeScript 技术栈一致

### 3. REST 框架选择

**决策**：使用 Express（与 yqad 主服务一致）

**理由**：
- yqad 已使用 Express，团队熟悉
- 可直接复用 yqad 的中间件模式（鉴权、日志）
- 生态成熟，OpenAPI 生成工具完善（swagger-jsdoc）

**替代方案**：Fastify — 性能更好但引入新框架增加学习成本

### 4. 架构分层

```
services/social-search/
├── src/
│   ├── index.ts                 # 入口：根据参数选择启动 MCP 或 REST 或两者
│   ├── mcp/
│   │   ├── server.ts            # MCP Server 初始化与工具注册
│   │   └── transports.ts        # stdio/SSE transport 配置
│   ├── rest/
│   │   ├── app.ts               # Express 应用
│   │   ├── routes/              # 路由定义
│   │   ├── middleware/          # 鉴权、限流中间件
│   │   └── openapi.ts           # OpenAPI spec 生成
│   ├── adapters/
│   │   ├── base-adapter.ts      # 抽象基类
│   │   ├── zhihu-adapter.ts     # 知乎实现
│   │   └── xiaohongshu-adapter.ts # 小红书实现
│   ├── infra/
│   │   ├── cookie-pool.ts       # Cookie 池管理
│   │   ├── rate-limiter.ts      # 频率控制
│   │   ├── cache.ts             # Redis 缓存
│   │   ├── proxy-pool.ts        # 代理 IP 轮转
│   │   └── retry.ts             # 重试机制
│   └── config/
│       └── default.ts           # 配置定义（端口、Redis、MySQL、API Keys）
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 5. 统一工具 Schema 定义

**决策**：一份 JSON Schema 同时驱动 MCP tool schema 和 OpenAPI spec

```typescript
// 工具定义（单一数据源）
const tools = {
  zhihu_search: {
    description: '搜索知乎问答和文章',
    input: { query: 'string', type?: 'general|article', maxResults?: 'number' },
    output: { results: 'SearchResult[]' }
  },
  // ...
};

// MCP 注册
tools.forEach(t => mcpServer.tool(t.name, t.input, t.handler));

// REST 路由自动生成
tools.forEach(t => app.post(`/api/search/${t.platform}`, wrapHandler(t.handler)));
```

### 6. Cookie 池策略

**决策**：定时从 MySQL 拉取，内存池 LRU 轮转

**流程**：
1. 启动时从 `cookies` 表加载指定平台的有效记录
2. 每 5 分钟刷新一次池（捡回被 yqad 刷新的新 Cookie）
3. 请求时选择"最近最久未使用"的 Cookie
4. 请求失败标记失效，立即从池中移除

### 7. 部署方式

**决策**：独立 Docker 容器，加入 yqad 的 docker-compose

```yaml
social-search:
  build:
    context: ./services/social-search
    dockerfile: Dockerfile
  container_name: social-search
  restart: unless-stopped
  ports:
    - "3090:3090"    # REST API + MCP SSE
  environment:
    - MYSQL_HOST=192.168.50.50
    - REDIS_HOST=192.168.50.50
    - API_KEYS=key1,key2,key3
  networks:
    - default
```

对外端口 3090，不与 yqad 的 3080 冲突。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 知乎/小红书反爬升级导致搜索失败 | adapter 层解耦，可快速切换抓取策略；频率控制降低被封概率 |
| Cookie 池耗尽无法提供服务 | 返回明确错误码，上游可降级处理；监控告警 |
| REST API 被滥用 | API Key 鉴权 + 频率限制；初期 Key 数量人工控制 |
| MCP 协议更新导致不兼容 | 使用官方 SDK，跟随版本更新 |
| 单机部署性能瓶颈 | 初期够用，后续可水平扩展（无状态设计，Cookie 池读 DB） |

## Migration Plan

1. 在 yqad 项目内创建 `services/social-search/` 目录，独立 package.json
2. 实现核心框架（MCP + REST 壳）+ 一个 adapter（知乎）作为 MVP
3. 本地 stdio 模式验证 MCP 工具调用正确
4. 添加小红书 adapter
5. Docker 打包，加入 x5-server 的 docker-compose
6. 远程 SSE + REST 模式验证
7. 生成 OpenAPI spec，测试 Coze/Dify 导入

## Open Questions

1. 是否需要支持 Streamable HTTP（MCP 新传输协议）？还是 SSE 够用？
2. 代理 IP 池初期是否需要？如果知乎/小红书的反爬对服务器 IP 宽容度够高可以推迟
3. API Key 管理后续是否要做数据库管理 + 仪表盘？还是配置文件够用？
