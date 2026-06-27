# web-security-middleware 规范

## 目的
待定 - 由归档变更 fix-top5-issues 创建。归档后请更新目的。
## 需求
### 需求:Web 应用必须集成 Helmet 安全中间件

Express 应用必须使用 `helmet` 中间件，自动设置安全相关的 HTTP 响应头，包括 `X-Content-Type-Options`、`X-Frame-Options`、`X-XSS-Protection`、`Content-Security-Policy`、`Strict-Transport-Security` 等。

#### 场景:所有 HTTP 响应包含安全头
- **当** 客户端请求任意页面或 API
- **那么** 响应头包含 Helmet 设置的各项安全头

### 需求:登录接口必须实施速率限制

`/api/auth/login` 接口必须实施速率限制，防止暴力破解攻击。同一 IP 在限定时间窗口内超过最大尝试次数后，必须返回 429 状态码。

#### 场景:正常频率登录请求被放行
- **当** 同一 IP 在 15 分钟内登录尝试不超过 10 次
- **那么** 请求正常处理

#### 场景:超过频率限制时返回 429
- **当** 同一 IP 在 15 分钟内登录尝试超过 10 次
- **那么** 返回 HTTP 429 状态码，提示"请求过于频繁，请稍后再试"

### 需求:Session 配置必须优化以减少存储压力

Session 中间件的 `resave` 必须设为 `false`，`saveUninitialized` 必须设为 `false`，以减少不必要的 Session 存储操作。

#### 场景:未修改的 Session 不被强制保存
- **当** 请求未修改 Session 数据
- **那么** Session 存储不执行保存操作

#### 场景:未登录访客不创建空 Session
- **当** 未认证用户访问页面
- **那么** 不为该用户创建新的 Session 记录

