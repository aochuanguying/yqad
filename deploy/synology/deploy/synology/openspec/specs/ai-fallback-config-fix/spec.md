# ai-fallback-config-fix 规范

## 目的
待定 - 由归档变更 fix-top5-issues 创建。归档后请更新目的。
## 需求
### 需求:FallbackChain 必须使用配置参数初始化 RateLimiter 和 CircuitBreaker

`FallbackChain.initProviders()` 方法在创建每个 AI Provider 的 RateLimiter 和 CircuitBreaker 实例时，必须使用构造函数传入的 `rateLimitConfig` 和 `circuitBreakerConfig` 参数，禁止使用硬编码默认值。

#### 场景:使用配置中的速率限制参数
- **当** FallbackChain 初始化 provider 列表
- **那么** 每个 provider 的 RateLimiter 使用 `rateLimitConfig` 中的 `tokensPerMinute`、`burstSize`、`whitelist` 参数

#### 场景:使用配置中的熔断器参数
- **当** FallbackChain 初始化 provider 列表
- **那么** 每个 provider 的 CircuitBreaker 使用 `circuitBreakerConfig` 中的 `failureThreshold`、`resetTimeout`、`halfOpenMaxRequests` 参数

#### 场景:配置缺失时使用合理默认值
- **当** `rateLimitConfig` 或 `circuitBreakerConfig` 未提供
- **那么** 使用合理的默认值（tokensPerMinute: 60, failureThreshold: 5 等），而非硬编码

