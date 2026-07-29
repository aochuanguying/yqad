## Why

yqad 项目中的发帖内容生成需要从知乎、小红书等社交平台获取参考素材，目前搜索逻辑散落在各个 service 中且仅供内部使用。同时，越来越多的 AI 客户端（Kiro、Cursor、Claude Desktop）和智能体开发平台（Coze、Dify、FastGPT）需要统一的社交平台搜索能力。将搜索功能抽象为独立的 MCP Server + REST API 服务，可以实现一次开发、多端复用。

## What Changes

- 新建独立的社交搜索服务（social-search-server），作为 yqad 项目的子模块
- 提供 MCP 协议（stdio/SSE）接入，供 AI IDE 客户端本地或远程调用
- 提供 REST OpenAPI 接口，供智能体开发平台以 Plugin 形式接入
- 统一 Cookie 池管理，复用 yqad 已有的 Cookie 刷新机制
- 内置频率控制、搜索结果缓存、代理 IP 轮转等反爬基础设施
- 采用 adapter 模式，支持按平台扩展（初期：知乎、小红书）

## Capabilities

### New Capabilities

- `mcp-server-core`: MCP Server 核心框架，支持 stdio 和 SSE 两种传输模式，处理工具注册、请求路由、协议适配
- `rest-api-gateway`: REST OpenAPI 网关层，提供标准化的 HTTP 接口、API Key 鉴权、请求限流，供智能体平台接入
- `zhihu-search-adapter`: 知乎搜索适配器，实现问答/文章搜索、内容详情获取、结果结构化返回
- `xiaohongshu-search-adapter`: 小红书搜索适配器，实现笔记搜索、笔记详情获取、结果结构化返回
- `cookie-pool-manager`: Cookie 池管理模块，多账号 Cookie 轮转、有效性检测、自动刷新集成
- `search-infra`: 搜索基础设施层，包含频率控制、Redis 缓存、代理 IP 轮转、请求重试

### Modified Capabilities

（无现有规范需要修改）

## Impact

- **新增代码目录**：`services/social-search/`（或独立为顶层 `social-search/` 目录）
- **依赖新增**：`@modelcontextprotocol/sdk`、Express/Fastify（REST 层）
- **基础设施**：复用现有 MySQL（Cookie 存储）和 Redis（缓存、频率控制）
- **部署**：新增一个 Docker 容器服务，与 yqad 同网络
- **对外暴露**：MCP stdio（本地）、MCP SSE + REST API（远程，需公网或内网穿透）
- **安全**：REST 接口需 API Key 鉴权，防止未授权调用
