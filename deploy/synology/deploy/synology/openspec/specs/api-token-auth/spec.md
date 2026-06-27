# API Token 认证

## 目的
提供独立的 API Token 验证机制，用于远程发帖 API 的鉴权，与登录 Token 分离。

## 需求

### 需求：系统必须提供 API Token 验证功能
系统必须提供独立的 API Token 验证中间件，用于验证远程 API 调用的 Token，与登录 Token 验证分离。

#### 场景：Token 验证成功
- **当** 请求头包含有效的 API Token（`Authorization: Bearer <api-token>`）
- **那么** 中间件必须允许请求通过，调用 `next()` 继续处理

#### 场景：缺少 Authorization 头
- **当** 请求头中不存在 `Authorization` 字段
- **那么** 中间件必须返回 401 错误，错误码为 `UNAUTHORIZED`

#### 场景：Token 格式无效
- **当** `Authorization` 头不以 `Bearer ` 开头或 Token 为空
- **那么** 中间件必须返回 401 错误，错误码为 `INVALID_TOKEN`

#### 场景：Token 不匹配
- **当** 提供的 API Token 与配置文件中存储的 Token 不匹配
- **那么** 中间件必须返回 401 错误，错误码为 `INVALID_TOKEN`

#### 场景：Token 文件不存在
- **当** API Token 配置文件不存在
- **那么** 中间件必须返回 401 错误，错误码为 `UNAUTHORIZED`
