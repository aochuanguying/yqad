## 新增需求

### 需求: 网关必须提供 OpenAI 兼容的 Models 接口
系统必须提供 `GET /v1/models` 接口，并返回符合 OpenAI 兼容结构的模型列表，用于让第三方客户端探测可用模型。

#### 场景: 使用有效鉴权获取模型列表
- **当** 客户端携带有效的 `Authorization: Bearer <gateway_api_key>` 调用 `GET /v1/models`
- **那么** 系统必须返回 HTTP 200
- **并且** 响应体必须包含 `data` 数组且每个元素必须包含 `id`

### 需求: 网关必须以 OpenAI 方式进行鉴权
系统必须校验 `Authorization: Bearer <token>`；当鉴权失败时必须返回 OpenAI 风格错误结构。

#### 场景: 缺少 Authorization
- **当** 客户端未携带 `Authorization` 调用任意 `/v1/*` 端点
- **那么** 系统必须返回 HTTP 401
- **并且** 响应体必须为 `{ "error": { "message": "...", "type": "authentication_error" } }` 结构

#### 场景: Bearer token 不匹配
- **当** 客户端携带错误的 `Authorization: Bearer <token>` 调用任意 `/v1/*` 端点
- **那么** 系统必须返回 HTTP 401

### 需求: 网关必须支持 OpenAI 兼容的 Chat Completions 接口并转发到 HiGPT
系统必须提供 `POST /v1/chat/completions` 接口，并将请求转发到 HiGPT 上游；转发时系统必须自动注入 HiGPT 所需的 `user_key` 到上游请求的 URL query。

#### 场景: 成功转发并返回上游响应
- **当** 客户端携带有效鉴权调用 `POST /v1/chat/completions`，请求体包含 `model` 与 `messages`
- **那么** 系统必须将请求转发到配置的 HiGPT baseURL
- **并且** 上游请求 URL query 必须包含 `user_key`
- **并且** 系统必须将上游的 HTTP 状态码与响应体透传返回给客户端（除错误结构映射需求外）

### 需求: 网关必须支持模型别名映射
系统必须支持将客户端传入的 `model` 映射为上游实际模型名，以便在不改动第三方软件配置的情况下切换上游模型。

#### 场景: 使用别名访问
- **当** 客户端在 `POST /v1/chat/completions` 中传入 `model` 为配置的别名（例如 `higpt`）
- **那么** 系统必须将上游请求体中的 `model` 替换为该别名映射的上游模型名（例如 `qwen3-5-397b`）

### 需求: 网关必须支持通过代理访问上游 HiGPT
系统必须支持配置上游代理，并在访问 HiGPT 时通过该代理建立连接。代理配置必须同时支持 HTTP 与 SOCKS 两类代理地址。

#### 场景: 配置 HTTP 代理
- **当** 系统配置了 HTTP 代理（例如 `http://192.168.59.50:10800`）
- **那么** 系统在请求 HiGPT 上游时必须通过该 HTTP 代理发起连接

#### 场景: 配置 SOCKS 代理
- **当** 系统配置了 SOCKS 代理（例如 `socks5://192.168.50.50:1080`）
- **那么** 系统在请求 HiGPT 上游时必须通过该 SOCKS 代理发起连接

### 需求: 网关必须对上游错误进行 OpenAI 风格映射
当上游返回非 2xx，或网关在转发过程中发生网络/超时错误时，系统必须返回 OpenAI 风格错误结构，并包含可定位问题的最小信息。

#### 场景: 上游返回 401/403
- **当** 上游返回 HTTP 401 或 403
- **那么** 系统必须返回 HTTP 502
- **并且** 响应体必须包含 `error.message`，且不得包含任何 `HIGPT_API_KEY` 或 `user_key`

#### 场景: 上游超时
- **当** 网关请求上游超过配置的超时时间
- **那么** 系统必须返回 HTTP 504
- **并且** 响应体必须为 OpenAI 风格错误结构

### 需求: 网关必须避免在日志中泄露敏感信息
系统在日志中必须禁止输出以下敏感信息：外部 `Authorization` 全文、`HIGPT_API_KEY`、`HIGPT_USER_KEY`（或其等价配置项）。

#### 场景: 记录请求日志时脱敏
- **当** 系统记录 `/v1/*` 请求与上游转发日志
- **那么** 日志内容中必须不包含上述敏感信息的明文

## 修改需求

## 移除需求
