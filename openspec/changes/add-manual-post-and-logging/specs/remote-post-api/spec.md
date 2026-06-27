## 修改需求

### 需求：API 鉴权必须使用独立的 API Token

**修改说明**：增加手工发帖 API 和日志查询 API

远程发帖 API 端点（`/api/posts/generate`、`/api/posts/batch`、`/api/posts/execute`、`/api/posts/logs`）必须使用独立的 API Token 进行鉴权，不再使用登录 Token。

#### 场景：使用有效 API Token 调用

- **当** 客户端在 `Authorization` 头中提供有效的 API Token
- **那么** API 必须正常处理请求，返回发帖内容

#### 场景：使用登录 Token 调用

- **当** 客户端在 `Authorization` 头中提供登录 Token（JWT 格式）
- **那么** API 必须拒绝请求，返回 401 错误，错误码为 `INVALID_TOKEN`

#### 场景：未提供 Token 调用

- **当** 客户端未在 `Authorization` 头中提供任何 Token
- **那么** API 必须拒绝请求，返回 401 错误，错误码为 `UNAUTHORIZED`

### 需求：系统必须提供手工立即发帖 API

**新增**：系统必须提供 `POST /api/posts/execute` 接口，支持手工触发发帖任务。

#### 场景：调用手工发帖接口

- **当** 客户端发送 POST 请求到 `/api/posts/execute`
- **那么** 系统必须验证 API Token，执行一次发帖任务并返回结果

#### 场景：手工发帖使用主题扣减次数

- **当** 手工发帖使用预配置主题并成功发布
- **那么** 系统必须立即扣减该主题的使用次数，并记录日志

#### 场景：手工发帖自由生成不扣减次数

- **当** 手工发帖使用自由生成模式（无主题）
- **那么** 系统不扣减任何主题次数，但记录日志

### 需求：系统必须提供发帖日志查询 API

**新增**：系统必须提供 `GET /api/posts/logs` 和 `GET /api/posts/logs/:id` 接口，支持查询发帖日志。

#### 场景：查询日志列表

- **当** 客户端发送 GET 请求到 `/api/posts/logs?page=1&limit=20`
- **那么** 系统必须返回分页的日志列表，包含总记录数和当前页数据

#### 场景：按触发方式筛选

- **当** 客户端请求 `/api/posts/logs?triggerType=manual`
- **那么** 系统必须只返回手动触发的发帖日志

#### 场景：查询日志详情

- **当** 客户端请求 `/api/posts/logs/:id`
- **那么** 系统必须返回指定 ID 的完整日志记录
