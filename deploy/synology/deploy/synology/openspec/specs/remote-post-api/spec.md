# 远程发帖 API

## 目的
提供远程发帖内容生成接口，支持外部系统调用生成发帖内容。

## 需求

### 需求：API 鉴权必须使用独立的 API Token
远程发帖 API 端点（`/api/posts/generate`、`/api/posts/batch`）必须使用独立的 API Token 进行鉴权，不再使用登录 Token。

#### 场景：使用有效 API Token 调用
- **当** 客户端在 `Authorization` 头中提供有效的 API Token
- **那么** API 必须正常处理请求，返回发帖内容

#### 场景：使用登录 Token 调用
- **当** 客户端在 `Authorization` 头中提供登录 Token（JWT 格式）
- **那么** API 必须拒绝请求，返回 401 错误，错误码为 `INVALID_TOKEN`

#### 场景：未提供 Token 调用
- **当** 客户端未在 `Authorization` 头中提供任何 Token
- **那么** API 必须拒绝请求，返回 401 错误，错误码为 `UNAUTHORIZED`
