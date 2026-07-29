## 1. 项目脚手架

- [x] 1.1 创建 `services/social-search/` 目录结构（src/mcp、src/rest、src/adapters、src/infra、src/config）
- [x] 1.2 初始化 package.json，添加核心依赖（@modelcontextprotocol/sdk、express、mysql2、ioredis、uuid）
- [x] 1.3 创建 tsconfig.json，配置编译输出到 dist/
- [x] 1.4 创建入口文件 src/index.ts，支持通过参数选择启动模式（mcp-stdio、mcp-sse、rest、all）

## 2. 基础设施层

- [x] 2.1 实现 src/infra/cache.ts — Redis 缓存封装（get/set/del，支持 TTL 和 noCache 参数）
- [x] 2.2 实现 src/infra/rate-limiter.ts — 基于 Redis 的滑动窗口频率限制器
- [x] 2.3 实现 src/infra/retry.ts — 指数退避重试工具（maxRetries、baseDelay 可配）
- [x] 2.4 实现 src/infra/proxy-pool.ts — 代理 IP 池管理（轮转选择、失败标记、预留接口，初期可返回 null）
- [x] 2.5 实现 src/infra/cookie-pool.ts — Cookie 池管理（从 MySQL 加载、LRU 轮转、有效性标记、定时刷新）

## 3. Adapter 基础与知乎实现

- [x] 3.1 定义 src/adapters/base-adapter.ts — 抽象基类（search、getContent 方法签名、统一返回类型）
- [x] 3.2 实现 src/adapters/zhihu-adapter.ts — 知乎搜索（关键词搜索、按类型过滤、结果结构化）
- [x] 3.3 实现知乎内容详情获取（回答/文章，解析为 Markdown 文本）
- [x] 3.4 验证知乎 adapter：使用现有 Cookie 执行搜索，确认返回结构正确

## 4. 小红书 Adapter 实现

- [x] 4.1 实现 src/adapters/xiaohongshu-adapter.ts — 小红书笔记搜索（关键词搜索、排序、结果结构化）
- [x] 4.2 实现小红书笔记详情获取（内容、图片列表、标签）
- [x] 4.3 实现摘要模式控制（summaryMode 参数，限制 snippet 长度）
- [x] 4.4 验证小红书 adapter：使用现有 Cookie 执行搜索，确认返回结构正确

## 5. MCP Server 核心

- [x] 5.1 实现 src/mcp/server.ts — MCP Server 初始化，注册所有搜索工具（zhihu_search、zhihu_get_content、xiaohongshu_search、xiaohongshu_get_note）
- [x] 5.2 实现 src/mcp/transports.ts — stdio transport 配置
- [x] 5.3 添加 SSE transport 配置（HTTP 端点 /sse + /messages）
- [x] 5.4 验证 MCP stdio 模式：本地配置 mcp.json 在 Kiro 中调用工具

## 6. REST API 网关

- [x] 6.1 实现 src/rest/app.ts — Express 应用初始化
- [x] 6.2 实现 src/rest/middleware/auth.ts — API Key 鉴权中间件
- [x] 6.3 实现 src/rest/middleware/rate-limit.ts — 每 Key 请求限流中间件
- [x] 6.4 实现 src/rest/routes/ — 搜索路由（POST /api/search/zhihu、POST /api/search/xiaohongshu）
- [x] 6.5 实现 src/rest/openapi.ts — 自动生成 OpenAPI 3.0 规范，暴露 GET /openapi.json
- [x] 6.6 验证 REST API：使用 curl 调用搜索接口，确认鉴权和返回结构正确

## 7. 配置与 Docker 部署

- [x] 7.1 实现 src/config/default.ts — 统一配置管理（端口、MySQL、Redis、API Keys、频率限制参数）
- [ ] 7.2 创建 Dockerfile（基于 node:20-slim，使用国内镜像源，安装生产依赖）
- [ ] 7.3 更新 x5-server docker-compose.yml 添加 social-search 服务定义（端口 3090、bridge 网络）
- [ ] 7.4 部署到 x5-server，验证远程 MCP SSE 和 REST API 可用

## 8. 集成验证

- [ ] 8.1 在 Kiro 中配置 mcp.json 指向远程 SSE 端点，验证工具发现和调用
- [ ] 8.2 将 OpenAPI spec 导入 Coze/Dify 创建 Plugin，验证搜索功能可用
- [ ] 8.3 补充 README 文档（安装、配置、使用说明、API 参考）
