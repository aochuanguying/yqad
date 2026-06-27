## 1. 项目准备

- [x] 1.1 安装依赖包：`npm install express-session bcryptjs`
- [x] 1.2 安装类型定义：`npm install -D @types/express-session @types/bcryptjs`
- [x] 1.3 更新 package.json，添加密码哈希生成脚本

## 2. 配置系统扩展

- [x] 2.1 在 config/default.yaml 中添加 web.auth 配置项（username, passwordHash, sessionSecret, sessionMaxAge）
- [x] 2.2 修改 config 类型定义，增加 web.auth 相关接口
- [x] 2.3 实现配置加载逻辑，支持环境变量覆盖（WEB_AUTH_USERNAME, WEB_AUTH_PASSWORD_HASH, WEB_AUTH_SESSION_SECRET）
- [x] 2.4 创建密码哈希生成脚本（scripts/generate-password-hash.ts）

## 3. Session 中间件实现

- [x] 3.1 创建 src/web/middleware/session-middleware.ts
- [x] 3.2 实现 session 中间件配置函数（使用 express-session）
- [x] 3.3 配置 Cookie 参数（httpOnly, secure, maxAge）
- [x] 3.4 在 src/web/server.ts 中应用 session 中间件

## 4. 认证中间件实现

- [x] 4.1 创建 src/web/middleware/auth-middleware.ts
- [x] 4.2 实现 isAuthenticated 中间件函数（检查 session.authenticated）
- [x] 4.3 实现 publicRoute 装饰器/白名单机制
- [x] 4.4 添加审计日志记录（登录成功/失败、未授权访问）

## 5. 登录/登出 API 实现

- [x] 5.1 创建 src/web/routes/auth-routes.ts（或修改现有文件）
- [x] 5.2 实现 POST /api/auth/login 接口（验证用户名密码，创建 Session）
- [x] 5.3 实现 POST /api/auth/logout 接口（销毁 Session）
- [x] 5.4 实现 GET /api/auth/status 接口（返回当前登录状态）
- [x] 5.5 在 server.ts 中注册 auth 路由

## 6. 登录页面实现

- [x] 6.1 创建 src/web/public/login.html（独立登录页）
- [x] 6.2 实现登录表单（用户名、密码输入框，提交按钮）
- [x] 6.3 添加前端表单验证（非空检查）
- [x] 6.4 实现登录成功跳转逻辑（支持 redirect 参数）
- [x] 6.5 实现登录错误提示显示

## 7. 前端集成

- [x] 7.1 修改 index.html，增加"退出登录"按钮（在 Header 区域）
- [x] 7.2 实现登出功能 JavaScript 函数
- [x] 7.3 添加页面加载时的登录状态检查
- [x] 7.4 实现未登录时自动跳转到登录页的逻辑

## 8. API 路由保护

- [x] 8.1 在 server.ts 中为所有 API 路由应用 authMiddleware
- [x] 8.2 配置公开路由白名单（/api/auth/login, /api/posts/token/*）
- [x] 8.3 确保静态资源不受认证限制
- [x] 8.4 确保远程发帖 API 的独立 Token 认证不受影响

## 9. 配置更新与文档

- [x] 9.1 更新 config/local.yaml.example，添加 web.auth 配置示例
- [x] 9.2 更新 README.md，添加 Web 认证配置说明
- [x] 9.3 添加环境变量配置文档（Docker 部署用）
- [x] 9.4 编写安全建议文档（HTTPS、强密码策略）

## 10. 测试与验证

- [x] 10.1 测试登录功能（正确凭据、错误凭据、空凭据）
- [x] 10.2 测试 Session 过期机制
- [x] 10.3 测试未授权访问 API 返回 401
- [x] 10.4 测试未授权访问页面跳转到登录页
- [x] 10.5 测试登出功能
- [x] 10.6 测试公开 API 白名单（登录 API、远程发帖 API）
- [x] 10.7 验证远程发帖 API 的独立 Token 认证仍然正常工作

## 11. 部署准备

- [x] 11.1 编译 TypeScript 代码
- [x] 11.2 在 Docker 环境中测试认证功能
- [x] 11.3 准备初始管理员密码哈希
- [x] 11.4 更新 Docker 部署文档，说明认证配置

## 9. 配置更新与文档

- [ ] 9.1 更新 config/local.yaml.example，添加 web.auth 配置示例
- [ ] 9.2 更新 README.md，添加 Web 认证配置说明
- [ ] 9.3 添加环境变量配置文档（Docker 部署用）
- [ ] 9.4 编写安全建议文档（HTTPS、强密码策略）

## 10. 测试与验证

- [ ] 10.1 测试登录功能（正确凭据、错误凭据、空凭据）
- [ ] 10.2 测试 Session 过期机制
- [ ] 10.3 测试未授权访问 API 返回 401
- [ ] 10.4 测试未授权访问页面跳转到登录页
- [ ] 10.5 测试登出功能
- [ ] 10.6 测试公开 API 白名单（登录 API、远程发帖 API）
- [ ] 10.7 验证远程发帖 API 的独立 Token 认证仍然正常工作

## 11. 部署准备

- [ ] 11.1 编译 TypeScript 代码
- [ ] 11.2 在 Docker 环境中测试认证功能
- [ ] 11.3 准备初始管理员密码哈希
- [ ] 11.4 更新 Docker 部署文档，说明认证配置
