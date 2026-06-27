# 实现计划：AI 模型兜底机制

## 概述

构建统一的 AI 模型兜底机制，通过中间件模式实现速率限制、熔断器、多级 fallback、超时控制和错误处理。变更涉及新增 6 个中间件模块、修改 generateContent 集成、扩展配置结构，覆盖 8 个文件。

## 任务

### 1. 创建中间件模块

- [ ] 1.1 创建 `src/ai/middleware/` 目录结构
  - 创建目录 `src/ai/middleware/`
  - 创建 `index.ts` 导出所有中间件
  - _Requirements: 需求 1_

- [ ] 1.2 实现 `rate-limiter.ts`（速率限制器）
  - 实现 `RateLimiter` 类，使用令牌桶算法
  - 实现 `acquire(providerName)` 方法，支持白名单
  - 实现 `getStatus()` 方法，返回当前 token 状态
  - 实现统计信息收集：`totalRequests`、`rateLimitedRequests`、`totalWaitTime`
  - _Requirements: 需求 3, 场景 1-5_

- [ ] 1.3 实现 `circuit-breaker.ts`（熔断器）
  - 实现 `CircuitBreaker` 类，三状态机（CLOSED/OPEN/HALF_OPEN）
  - 实现 `canRequest()`、`onSuccess()`、`onFailure()` 方法
  - 实现 `getStatus()` 方法，返回熔断器状态和统计
  - 实现状态切换日志记录
  - _Requirements: 需求 7, 场景 1-5_

- [ ] 1.4 实现 `error-classifier.ts`（错误分类器）
  - 定义 `ErrorType` 枚举（7 种错误类型）
  - 实现 `ErrorClassification` 接口
  - 实现 `classify(error)` 方法，识别错误类型并提供重试建议
  - 实现 HTTP 状态码解析逻辑
  - 实现 `parseRetryAfter()` 方法，从 header 解析等待时间
  - _Requirements: 需求 4, 场景 1-5_

- [ ] 1.5 实现 `timeout-controller.ts`（超时控制器）
  - 实现 `TimeoutController` 类，支持三级配置
  - 实现 `getTimeout()` 方法，按优先级返回超时值
  - 实现 `recordResponseTime()` 方法，记录响应时间历史
  - 实现 `getDynamicTimeout()` 方法，动态调整超时
  - _Requirements: 需求 2, 场景 1-4_

- [ ] 1.6 实现 `fallback-chain.ts`（兜底链）
  - 实现 `FallbackChain` 类，协调所有中间件
  - 实现 `execute()` 方法，执行带兜底的调用
  - 实现快速失败模式和稳健模式
  - 实现 fallback 历史记录
  - 实现指数退避逻辑
  - _Requirements: 需求 1, 5, 6, 场景 1-7_

- [ ] 1.7 实现 `metrics.ts`（监控指标）
  - 实现 `MetricsCollector` 类
  - 实现 `recordRequest()` 方法，记录调用指标
  - 实现 `getMetrics()` 方法，查询 provider 指标
  - 实现 `getHealthStatus()` 方法，健康检查
  - 实现 `exportJSON()` 方法，导出 JSON 格式
  - _Requirements: 需求 7, 场景 1-4_

### 2. 集成到 generateContent

- [ ] 2.1 修改 `src/ai/client.ts`
  - 导入所有中间件模块
  - 声明单例实例变量
  - _Requirements: 设计文档 3.1_

- [ ] 2.2 实现 `initFallbackMechanism()` 函数
  - 从配置加载各中间件配置
  - 初始化所有中间件实例（单例）
  - 在应用启动时调用（如 main.ts）
  - _Requirements: 需求 1, 场景 2_

- [ ] 2.3 修改 `generateContent()` 函数签名
  - 新增可选参数 `scene?: 'comment' | 'post' | 'analysis'`
  - 保持向后兼容（scene 参数可选）
  - _Requirements: 需求 6, 场景 1-2_

- [ ] 2.4 集成速率限制
  - 在调用前调用 `rateLimiter.acquire()`
  - 处理等待逻辑
  - _Requirements: 需求 3, 场景 3_

- [ ] 2.5 集成兜底链
  - 使用 `fallbackChain.execute()` 包装实际调用
  - 处理成功/失败结果
  - 记录 fallback 历史
  - _Requirements: 需求 1, 5, 场景 4-7_

- [ ] 2.6 集成超时控制
  - 在调用时传入 `timeout` 参数
  - 使用 `timeoutController.getTimeout()` 获取超时值
  - 记录响应时间
  - _Requirements: 需求 2, 场景 3-4_

- [ ] 2.7 集成监控指标
  - 在调用完成后调用 `metrics.recordRequest()`
  - 记录成功/失败、响应时间、fallback 等信息
  - _Requirements: 需求 7, 场景 1_

- [ ] 2.8 增强日志记录
  - 成功时记录：provider、attempts、fallbacks
  - 失败时记录：聚合错误、完整 fallback 链
  - 熔断器状态变化时记录警告
  - _Requirements: 需求 1, 7_

### 3. 扩展配置结构

- [ ] 3.1 更新 `src/utils/config.ts` 类型定义
  - 新增 `FallbackConfig` 接口
  - 新增 `TimeoutConfig` 接口（含 scene 子配置）
  - 新增 `RateLimitConfig` 接口
  - 新增 `CircuitBreakerConfig` 接口
  - 在 `AIConfig` 中添加对应字段
  - _Requirements: 需求 5, 场景 1_

- [ ] 3.2 更新 `config/default.yaml`
  - 添加 `ai.fallback` 配置块
  - 添加 `ai.timeout` 配置块（含 scene 子配置）
  - 添加 `ai.rateLimit` 配置块
  - 添加 `ai.circuitBreaker` 配置块
  - 设置合理的默认值
  - _Requirements: 需求 5, 场景 1_

- [ ] 3.3 实现配置验证
  - 在 `normalizeAIConfig()` 中添加验证逻辑
  - 检查配置冲突（如 mode 与 maxRetries）
  - 冲突时报警告日志
  - _Requirements: 需求 5, 场景 3_

### 4. 集成到业务服务

- [ ] 4.1 修改 `src/ai/content-generator.ts` 的 `generateComment()`
  - 调用 `generateContent()` 时传入 `scene: 'comment'`
  - 无需其他��改（中间件透明）
  - _Requirements: 需求 6, 场景 1_

- [ ] 4.2 修改 `src/ai/content-generator.ts` 的 `generatePost()`
  - 调用 `generateContent()` 时传入 `scene: 'post'`
  - 无需其他修改（中间件透明）
  - _Requirements: 需求 6, 场景 2_

- [ ] 4.3 验证 AutoCommentService 和 AutoPostService
  - 确认两个服务无需修改（通过 generateContent 间接使用）
  - 检查日志输出是否正确记录 provider 和场景
  - _Requirements: 需求 6, 场景 3-5_

### 5. 测试验证

- [ ] 5.1 单元测试：RateLimiter
  - 测试令牌补充逻辑
  - 测试白名单机制
  - 测试等待逻辑
  - 测试统计信息
  - 文件：`tests/unit/rate-limiter.test.ts`

- [ ] 5.2 单元测试：CircuitBreaker
  - 测试三状态转换
  - 测试阈值触发
  - 测试自动恢复
  - 文件：`tests/unit/circuit-breaker.test.ts`

- [ ] 5.3 单元测试：ErrorClassifier
  - 测试 7 种错误类型识别
  - 测试重试建议
  - 测试 Retry-After 解析
  - 文件：`tests/unit/error-classifier.test.ts`

- [ ] 5.4 单元测试：TimeoutController
  - 测试三级配置优先级
  - 测试动态调整
  - 文件：`tests/unit/timeout-controller.test.ts`

- [ ] 5.5 单元测试：FallbackChain
  - 测试快速失败模式
  - 测试稳健模式
  - 测试熔断器集成
  - 测试 fallback 历史
  - 文件：`tests/unit/fallback-chain.test.ts`

- [ ] 5.6 集成测试：模拟各种错误场景
  - 模拟主力 provider 网络失败，验证 fallback 到备用
  - 模拟限流错误，验证等待重试
  - 模拟认证错误，验证立即 fallback
  - 模拟熔断器触发，验证跳过 provider
  - 文件：`tests/integration/ai-fallback.test.ts`

- [ ] 5.7 压力测试：验证速率限制和熔断器
  - 高频调用，验证速率限制生效
  - 连续失败，验证熔断器触发
  - 文件：`tests/stress/rate-limit-circuit-breaker.test.ts`

- [ ] 5.8 运行所有测试
  - 执行 `npm test`
  - 确保所有测试通过
  - 检查测试覆盖率报告

### 6. 监控与文档

- [ ] 6.1 实现每小时统计报告
  - 使用 `setInterval()` 定时任务
  - 在整点时输出统计报告
  - 在应用关闭时清除定时器
  - _Requirements: 需求 7, 场景 4_

- [ ] 6.2 添加健康检查接口（可选）
  - 在 Web UI 中添加 `/api/health/ai` 端点
  - 返回各 provider 健康状态
  - _Requirements: 需求 7, 场景 3_

- [ ] 6.3 更新 README 或文档
  - 说明兜底机制配置项
  - 提供配置示例
  - 说明监控指标含义
  - 文件：`docs/ai-fallback-mechanism.md`

- [ ] 6.4 创建变更日志
  - 记录新增的配置项
  - 记录 Breaking Changes（如有）
  - 提供迁移指南
  - 文件：`CHANGELOG.md`（如存在）

## 验收标准

### 功能验收

- [ ] 主力 provider 失败时自动切换到备用 provider
- [ ] 速率限制生效，不触发 API 限流
- [ ] 熔断器在连续失败时触发，恢复后自动闭合
- [ ] 评论场景使用快速失败模式（15 秒超时）
- [ ] 发帖场景使用稳健模式（60 秒超时）
- [ ] 所有错误被正确分类并处理
- [ ] 监控指标可查询，健康检查正常

### 性能验收

- [ ] 中间件开销 < 1ms
- [ ] 速率限制不阻塞主线程（异步等待）
- [ ] 熔断器状态检查无性能损耗

### 代码质量验收

- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 测试覆盖率 > 80%
- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] 日志清晰、准确、无敏感信息

## 预计工时

- 中间件实现：2 天
- 集成到 generateContent：1 天
- 配置扩展：0.5 天
- 测试编写：1.5 天
- 文档与监控：0.5 天
- **总计**: 5.5 天

## 依赖与风险

### 依赖

- 无外部依赖（全部自研实现）
- Node.js 标准库（setTimeout、Map 等）

### 风险

1. **配置复杂度**: 配置项较多，用户可能配置错误
   - **缓解**: 提供默认值，启动时验证配置

2. **性能开销**: 多层中间件可能带来性能损耗
   - **缓解**: 使用轻量级数据结构，优化热点路径

3. **调试困难**: 多层封装可能导致调试困难
   - **缓解**: 完善的日志，每个环节独立记录

4. **向后兼容**: 旧配置可能缺少新字段
   - **缓解**: 所有新配置项都有默认值，normalize 函数处理
