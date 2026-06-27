## 上下文

项目复盘发现 5 个高优先级问题，涉及 AI 中间件、Web 安全、资源管理和异步处理。这些问题分散在多个模块中，但每个修复都相对独立、改动范围小。

## 目标 / 非目标

**目标：**
- 修复 FallbackChain 中 RateLimiter/CircuitBreaker 配置不生效的 bug
- 修复 Session secret 生产环境安全漏洞
- 修复优雅退出时数据库连接泄漏
- 修复未 await 的异步调用
- 添加基础 Web 安全中间件（helmet、rate-limit）

**非目标：**
- 不重构整个 AI 中间件架构
- 不引入完整的认证体系（如 OAuth2）
- 不添加 WAF 或高级安全防护
- 不修改业务逻辑

## 决策

### 1. FallbackChain 配置修复

**方案**：修改 `initProviders()` 方法，从构造函数参数 `this.rateLimitConfig` 和 `this.circuitBreakerConfig` 读取配置值，与硬编码默认值合并（配置优先）。

**替代方案**：
- 方案 B：从全局 config 读取 → 拒绝，FallbackChain 应保持独立，不依赖全局配置
- 方案 C：移除默认值，强制配置 → 拒绝，破坏向后兼容

**选择方案 A**：构造函数参数 + 默认值回退，保持向后兼容且不引入全局依赖。

### 2. Session Secret 安全加固

**方案**：在 `createSessionMiddleware()` 中，当 `NODE_ENV === 'production'` 且 `sessionSecret` 为空时，直接 `throw new Error()` 拒绝启动。

**替代方案**：
- 方案 B：自动生成随机 secret → 拒绝，重启后所有 session 失效，用户体验差
- 方案 C：从环境变量读取 → 已支持，问题是未配置时的行为

**选择方案 A**：fail-fast 策略，强制运维人员配置。

### 3. 优雅退出连接关闭

**方案**：在 SIGINT/SIGTERM 处理器中，依次调用各连接管理器的关闭方法。使用 try-catch 包裹每个关闭操作，确保一个失败不影响其他。

涉及的连接管理器：
- `MySQLConnectionManager.disconnect()`
- `RedisConnectionManager.disconnect()`
- `ChromaConnectionManager.disconnect()`

**替代方案**：
- 方案 B：使用 `async_hooks` 追踪资源 → 过度设计
- 方案 C：依赖进程退出时 OS 自动回收 → 不可靠，可能导致连接池未正确释放

**选择方案 A**：显式关闭，简单可靠。

### 4. 异步调用修复

**方案**：
- `generateDailySummary`/`checkAlerts`/`cleanOldLogs`：直接添加 `await`
- `AuthService`：添加静态工厂方法 `AuthService.create(api)`，在其中 await 初始化

**替代方案**：
- 方案 B：AuthService 使用 `async initialize()` 方法 → 需要调用方记得调用，容易遗漏
- 方案 C：懒初始化（首次使用时初始化）→ 增加复杂度，首次调用延迟不可预测

**选择方案 A**：工厂模式确保初始化完成才返回实例，调用方无需关心内部细节。

### 5. Web 安全中间件

**方案**：
- 添加 `helmet` 中间件（默认配置）
- 添加 `express-rate-limit`，仅对 `/api/auth/login` 应用（15 分钟窗口，最多 10 次）
- 修复 Session 配置：`resave: false`, `saveUninitialized: false`

**替代方案**：
- 方案 B：全局速率限制 → 可能影响正常 API 调用
- 方案 C：使用 Redis 存储速率限制计数 → 当前场景不需要分布式限流

**选择方案 A**：最小化引入，仅保护关键端点。

## 风险 / 权衡

- **Session `saveUninitialized: false` 变更**：未登录用户访问需要 session 的功能时可能受影响。当前认证中间件在 `auth.enabled === false` 时直接放行，不受影响。
- **AuthService 工厂模式变更**：需要修改 `src/index.ts` 中的调用方式，从 `new AuthService(api)` 改为 `await AuthService.create(api)`。
- **Helmet CSP 策略**：默认 CSP 可能阻止内联脚本。当前前端为纯 HTML，如有内联脚本需调整 CSP 配置。
- **速率限制内存存储**：使用默认内存存储，进程重启后计数清零。对于单实例部署可接受。
