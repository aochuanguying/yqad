## ADDED Requirements

### Requirement: REST API 提供标准化搜索接口

系统 SHALL 通过 REST API 暴露所有搜索能力，接口风格与 yqad 项目一致，供智能体开发平台以 Plugin 形式接入。

#### Scenario: 知乎搜索接口调用

- **WHEN** 客户端发送 `POST /api/search/zhihu` 携带 `{ "query": "奥迪Q5L评测", "maxResults": 5 }`
- **THEN** 服务返回结构化搜索结果列表，包含标题、摘要、作者、链接、点赞数

#### Scenario: 小红书搜索接口调用

- **WHEN** 客户端发送 `POST /api/search/xiaohongshu` 携带 `{ "query": "露营装备推荐", "maxResults": 5 }`
- **THEN** 服务返回结构化笔记列表，包含标题、内容摘要、作者、图片列表、点赞/收藏数

### Requirement: API Key 鉴权

系统 SHALL 要求所有 REST API 请求携带有效的 API Key，防止未授权调用。

#### Scenario: 有效 API Key

- **WHEN** 请求 Header 携带 `Authorization: Bearer <valid-key>`
- **THEN** 请求正常处理并返回结果

#### Scenario: 无效或缺失 API Key

- **WHEN** 请求未携带 API Key 或 Key 无效
- **THEN** 服务返回 HTTP 401，body 包含 `{ "error": "Unauthorized", "code": "INVALID_API_KEY" }`

### Requirement: 请求限流

系统 SHALL 对每个 API Key 实施请求频率限制，防止滥用。

#### Scenario: 超出频率限制

- **WHEN** 单个 API Key 在 1 分钟内请求超过配置的阈值
- **THEN** 服务返回 HTTP 429，Header 包含 `Retry-After` 指示等待秒数

#### Scenario: 正常频率请求

- **WHEN** 请求频率在限制范围内
- **THEN** 请求正常处理，响应 Header 包含 `X-RateLimit-Remaining` 剩余次数

### Requirement: OpenAPI 规范文档

系统 SHALL 自动生成并暴露 OpenAPI 3.0 规范文档，方便智能体平台导入。

#### Scenario: 获取 OpenAPI 文档

- **WHEN** 客户端访问 `GET /openapi.json`
- **THEN** 返回完整的 OpenAPI 3.0 规范 JSON，包含所有接口定义和 schema
