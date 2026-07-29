## ADDED Requirements

### Requirement: MCP Server 支持 stdio 传输模式

系统 SHALL 支持通过 stdin/stdout 与 AI 客户端通信，客户端启动本地子进程即可使用全部搜索工具。

#### Scenario: 本地 stdio 启动

- **WHEN** 客户端通过 `node server.js --transport stdio` 启动服务
- **THEN** 服务通过 stdin 接收 JSON-RPC 请求，通过 stdout 返回响应

#### Scenario: 工具列表发现

- **WHEN** 客户端发送 `tools/list` 请求
- **THEN** 服务返回所有已注册搜索工具的名称、描述和输入 schema

### Requirement: MCP Server 支持 SSE 远程传输模式

系统 SHALL 支持通过 HTTP SSE 提供远程 MCP 服务，允许多个客户端共享同一实例。

#### Scenario: SSE 远程连接

- **WHEN** 客户端通过 HTTP 连接 `GET /sse` 端点
- **THEN** 服务建立 SSE 长连接，后续通过 `POST /messages` 接收请求并通过 SSE 推送响应

#### Scenario: 多客户端并发

- **WHEN** 多个客户端同时连接 SSE 端点
- **THEN** 每个客户端独立维护会话，互不干扰

### Requirement: 统一工具注册机制

系统 SHALL 提供统一的工具注册接口，各平台 adapter 通过注册即可暴露为 MCP 工具。

#### Scenario: 注册新搜索工具

- **WHEN** adapter 调用 `server.tool(name, schema, handler)` 注册工具
- **THEN** 该工具在 `tools/list` 中可见，客户端可通过 `tools/call` 调用

#### Scenario: 工具执行错误处理

- **WHEN** 工具 handler 抛出异常
- **THEN** 服务返回结构化错误响应，包含错误码和可读消息，不中断连接
