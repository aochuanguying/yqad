## 为什么

项目复盘发现 5 个高优先级问题：AI 兜底链配置不生效（功能缺陷）、Session secret 硬编码（安全漏洞）、优雅退出时数据库连接泄漏（资源泄漏）、多处异步调用未 await（可能导致静默失败或进程崩溃）、Web 应用缺少安全中间件（整体防护缺失）。这些问题直接影响系统稳定性、安全性和可维护性，需要优先修复。

## 变更内容

1. **修复 FallbackChain 硬编码默认值**：`initProviders()` 中 RateLimiter 和 CircuitBreaker 使用构造函数传入的配置参数，而非硬编码值
2. **修复 Session secret 安全漏洞**：生产环境未配置 `sessionSecret` 时拒绝启动，而非使用硬编码默认值
3. **修复优雅退出连接泄漏**：SIGINT/SIGTERM 处理中依次关闭 MySQL、Redis、ChromaDB 连接
4. **修复未 await 的异步调用**：`generateDailySummary`、`checkAlerts`、`cleanOldLogs` 添加 await；AuthService 构造函数改为工厂模式
5. **添加安全中间件**：集成 helmet、express-rate-limit，添加 CSRF 保护

## 功能 (Capabilities)

### 新增功能
- `ai-fallback-config-fix`: AI 兜底链的 RateLimiter 和 CircuitBreaker 正确读取配置参数
- `session-security-fix`: Session secret 安全加固，生产环境强制要求配置
- `graceful-shutdown-fix`: 优雅退出时正确关闭所有数据库连接
- `async-await-fix`: 修复未 await 的异步调用，防止静默失败
- `web-security-middleware`: 添加 helmet、速率限制、CSRF 保护等安全中间件

### 修改功能
<!-- 无现有规范变更 -->

## 影响

- **代码文件**：`src/ai/middleware/fallback-chain.ts`、`src/web/middleware/session-middleware.ts`、`src/index.ts`、`src/services/auth.ts`、`src/web/server.ts`、`src/web/middleware/auth-middleware.ts`
- **依赖新增**：`helmet`、`express-rate-limit`
- **配置变更**：`config/default.yaml` 可能需要新增安全相关配置项
- **无破坏性变更**：所有修改向后兼容
