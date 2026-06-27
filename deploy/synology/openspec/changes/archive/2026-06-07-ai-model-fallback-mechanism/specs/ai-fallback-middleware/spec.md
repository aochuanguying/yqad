## 新增需求

### 需求：系统必须实现 AI 兜底中间件层
系统必须通过中间件模式实现速率限制、熔断器、多级 fallback、超时控制和错误分类，对业务代码透明。

#### 场景：中间件模块组织
- **当** 创建中间件模块时
- **那么** 必须在 `src/ai/middleware/` 目录下组织以下模块：
  - `rate-limiter.ts`: 速率限制器
  - `circuit-breaker.ts`: 熔断器
  - `fallback-chain.ts`: 兜底链
  - `timeout-controller.ts`: 超时控制器
  - `error-classifier.ts`: 错误分类器
  - `metrics.ts`: 监控指标收集器

#### 场景：中间件初始化
- **当** 应用启动时
- **那么** 必须调用 `initFallbackMechanism()` 初始化所有中间件实例
- **并且** 中间件实例必须为单例，全局共享

### 需求：速率限制器必须使用令牌桶算法
速率限制器必须通过令牌桶算法控制请求频率，避免触发 API 提供商的限流机制。

#### 场景：令牌补充
- **当** 每次请求 token 时
- **那么** 系统必须先补充 token：`tokens += (elapsedSeconds * tokensPerMinute / 60)`
- **并且** token 数量不能超过 burstSize

#### 场景：获取 token
- **当** 请求获取 token 且 token 充足时
- **那么** 系统必须立即返回，消耗 1 个 token
- **当** token 不足且未在白名单中时
- **那么** 系统必须同步等待直到有可用 token
- **当** provider 在白名单中时
- **那么** 系统必须跳过速率限制，不消耗 token

#### 场景：速率限制状态查询
- **当** 调用 `getStatus()` 时
- **那么** 系统必须返回：
  - `availableTokens`: 当前可用 token 数
  - `lastRefill`: 上次补充时间
  - `isWhitelisted`: 是否在白名单中

### 需求：熔断器必须实现三状态机
熔断器必须实现 CLOSED、OPEN、HALF_OPEN 三种状态，防止连续失败导致资源浪费。

#### 场景：CLOSED 状态（正常）
- **当** 熔断器处于 CLOSED 状态时
- **那么** 系统必须允许所有请求通过
- **当** 请求失败时
- **那么** 系统必须累加 `consecutiveFailures`
- **当** `consecutiveFailures >= failureThreshold` 时
- **那么** 系统必须切换到 OPEN 状态，记录 `nextAttempt = now + resetTimeout`

#### 场景：OPEN 状态（熔断）
- **当** 熔断器处于 OPEN 状态时
- **那么** 系统必须拒绝所有请求，返回 `canRequest() = false`
- **当** `now >= nextAttempt` 时
- **那么** 系统必须切换到 HALF_OPEN 状态

#### 场景：HALF_OPEN 状态（恢复尝试）
- **当** 熔断器处于 HALF_OPEN 状态时
- **那么** 系统必须允许最多 `halfOpenMaxRequests` 个请求通过
- **当** 请求成功时
- **那么** 系统必须切换到 CLOSED 状态，重置 `consecutiveFailures = 0`
- **当** 请求失败时
- **那么** 系统必须切换回 OPEN 状态，重新计算 `nextAttempt`

#### 场景：熔断器状态查询
- **当** 调用 `getStatus()` 时
- **那么** 系统必须返回：
  - `state`: 当前状态
  - `consecutiveFailures`: 连续失败次数
  - `lastFailureTime`: 上次失败时间
  - `totalRequests`: 总请求数
  - `totalFailures`: 总失败次数

### 需求：错误分类器必须统一错误处理
错误分类器必须将各种错误归类为预定义的类型，并提供重试建议。

#### 场景：错误类型定义
- **当** 分类错误时
- **那么** 系统必须识别为以下类型之一：
  - `NetworkError`: 网络错误（超时、连接失败）
  - `RateLimitError`: 限流错误（HTTP 429）
  - `AuthError`: 认证错误（HTTP 401/403）
  - `ServerError`: 服务端错误（HTTP 5xx）
  - `ClientError`: 客户端错误（HTTP 4xx，除 401/403/429）
  - `EmptyResponseError`: 空响应
  - `UnknownError`: 未知错误

#### 场景：限流错误处理
- **当** 错误为 HTTP 429 时
- **那么** 系统必须返回：
  - `type: RateLimitError`
  - `isRetryable: true`
  - `shouldFallback: false`
  - `waitBeforeRetry`: 从 `Retry-After` header 解析，或默认 5000ms

#### 场景：认证错误处理
- **当** 错误为 HTTP 401/403 时
- **那么** 系统必须返回：
  - `type: AuthError`
  - `isRetryable: false`
  - `shouldFallback: true`

#### 场景：网络错误处理
- **当** 错误包含 "timeout"、"connection failed"、"ENOTFOUND" 等关键字时
- **那么** 系统必须返回：
  - `type: NetworkError`
  - `isRetryable: true`
  - `shouldFallback: true`

### 需求：超时控制器必须支持三级配置
超时控制器必须支持全局、provider、场景三级配置，并支持动态调整。

#### 场景：超时优先级
- **当** 获取超时配置时
- **那么** 系统必须按以下优先级选择：
  1. provider 级别的 `requestTimeout`
  2. 场景级别的超时（comment/post/analysis）
  3. 全局默认超时

#### 场景：动态超时调整
- **当** `dynamicAdjustment` 启用时
- **那么** 系统必须记录每个 provider 的响应时间历史（最近 3 次）
- **当** 某 provider 连续 3 次响应时间超过阈值的 80% 时
- **那么** 系统必须自动增加超时时间 20%

### 需求：兜底链必须协调所有中间件
兜底链必须按顺序协调速率限制、熔断器、错误分类、重试和 fallback。

#### 场景：执行流程
- **当** 调用 `execute()` 时
- **那么** 系统必须按以下顺序执行：
  1. 检查速率限制（等待 token）
  2. 遍历 provider 列表（按 providerOrder）
  3. 检查熔断器状态（跳过 OPEN 的 provider）
  4. 根据 mode 决定重试次数（fast=0, robust=maxRetries）
  5. 执行调用并捕获错误
  6. 分类错误并决定下一步（重试/fallback/跳过）
  7. 记录 fallback 历史

#### 场景：快速失败模式
- **当** `mode = 'fast'` 时
- **那么** 系统必须在某 provider 失败后立即切换到下一个，不重试
- **并且** 适用于评论生成场景

#### 场景：稳健模式
- **当** `mode = 'robust'` 时
- **那么** 系统必须在某 provider 失败后重试 `maxRetries` 次
- **并且** 使用指数退避：`delay = baseDelay * 2^attempt`
- **并且** 适用于发帖生成场景

#### 场景：限流错误特殊处理
- **当** 错误为 `RateLimitError` 时
- **那么** 系统必须等待 `waitBeforeRetry` 后重试
- **并且** 不计入 fallback，不切换到下一个 provider

#### 场景：不可重试错误处理
- **当** 错误分类为 `isRetryable = false` 时
- **那么** 系统必须立即停止当前 provider 的重试
- **并且** 切换到下一个 provider（如果有）

#### 场景：所有 provider 均失败
- **当** 所有 provider 均已尝试并失败时
- **那么** 系统必须返回：
  - `success: false`
  - `usedProvider: ''`
  - `fallbacks`: 完整的 fallback 历史
- **并且** 调用方必须抛出聚合错误

### 需求：监控指标必须可查询
系统必须收集和暴露 AI 调用的各项指标，用于监控和告警。

#### 场景：指标收集
- **当** 每次 AI 调用完成时
- **那么** 系统必须记录：
  - provider 名称
  - 成功/失败状态
  - 响应时间
  - 是否触发 fallback
  - 是否触发速率限制
  - 是否触发熔断器

#### 场景：指标查询
- **当** 调用 `getMetrics(provider)` 时
- **那么** 系统必须返回该 provider 的指标：
  - `totalRequests`: 总请求数
  - `successfulRequests`: 成功请求数
  - `failedRequests`: 失败请求数
  - `fallbackCount`: fallback 触发次数
  - `rateLimitCount`: 速率限制触发次数
  - `circuitBreakerTrips`: 熔断器触发次��
  - `avgResponseTime`: 平均响应时间
  - `p95ResponseTime`: P95 响应时间

#### 场景：健康检查
- **当** 调用 `getHealthStatus()` 时
- **那么** 系统必须返回每个 provider 的健康状态：
  - `status`: 'healthy' | 'warning' | 'unhealthy'
  - `lastSuccessTime`: 上次成功时间
  - `consecutiveFailures`: 连续失败次数
  - `circuitState`: 熔断器状态

#### 场景：每小时统计报告
- **当** 每小时整点时
- **那么** 系统必须以 info 级别记录统计报告：
  - 各 provider 的调用次数和成功率
  - 平均响应时间和 P95
  - fallback 和熔断器事件汇总
