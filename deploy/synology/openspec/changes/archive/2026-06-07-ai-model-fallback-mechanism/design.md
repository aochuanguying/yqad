# 设计文档

## 概述

构建统一的 AI 模型兜底机制，通过模块化设计实现多级 fallback、超时控制、速率限制、错误处理和熔断机制。变更集中在新增的中间件层，对现有业务代码（AutoCommentService、AutoPostService）保持透明。

## 架构变更

### 1. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│ 业务层 (AutoCommentService / AutoPostService)          │
│  调用 generateContent({ systemPrompt, userPrompt })     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ AI 兜底中间件层 (新增)                                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 1. RateLimiter (速率限制)                         │  │
│  │    - 令牌桶算法                                   │  │
│  │    - 白名单机制                                   │  │
│  │    - 等待队列                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 2. CircuitBreaker (熔断器)                        │  │
│  │    - 连续失败计数                                 │  │
│  │    - 熔断状态管理                                 │  │
│  │    - 自动恢复                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 3. FallbackChain (多级 Fallback)                  │  │
│  │    - Provider 迭代                                │  │
│  │    - 错误分类决策                                 │  │
│  │    - 重试策略                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 4. TimeoutController (超时控制)                   │  │
│  │    - 连接超时                                     │  │
│  │    - 读取超时                                     │  │
│  │    - 动态调整                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 5. ErrorClassifier (错误分类器)                   │  │
│  │    - 错误类型识别                                 │  │
│  │    - 重试建议                                     │  │
│  │    - 日志记录                                     │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ OpenAI SDK (实际调用层)                                │
│  client.chat.completions.create()                      │
└─────────────────────────────────────────────────────────┘
```

### 2. 模块设计

#### 2.1 RateLimiter（速率限制器）

```typescript
// src/ai/middleware/rate-limiter.ts

export interface RateLimiterConfig {
  enabled: boolean;
  tokensPerMinute: number;
  burstSize: number;
  whitelist: string[];  // provider name 白名单
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimiterConfig;
  private stats: {
    totalRequests: number;
    rateLimitedRequests: number;
    totalWaitTime: number;
  };

  constructor(config: RateLimiterConfig);
  
  /**
   * 获取 token，如不足则等待
   * @param providerName provider 名称
   */
  acquire(providerName: string): Promise<void>;
  
  /**
   * 查询当前状态
   */
  getStatus(): {
    availableTokens: number;
    lastRefill: Date;
    isWhitelisted: boolean;
  };
}
```

**实现要点：**
- 使用令牌桶算法：每秒补充 `tokensPerMinute / 60` 个 token
- 白名单 provider 直接返回，不消耗 token
- 触发限流时同步等待，不抛出错误
- 记录统计信息用于监控

#### 2.2 CircuitBreaker（熔断器）

```typescript
// src/ai/middleware/circuit-breaker.ts

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;      // 连续失败阈值
  resetTimeout: number;          // 熔断恢复时间 (ms)
  halfOpenMaxRequests: number;   // 半开状态允许的请求数
}

export interface CircuitStats {
  consecutiveFailures: number;
  lastFailureTime: number | null;
  state: CircuitState;
  totalRequests: number;
  totalFailures: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private nextAttempt: number = 0;
  private config: CircuitBreakerConfig;
  private stats: CircuitStats;

  constructor(config: CircuitBreakerConfig);

  /**
   * 检查是否允许请求
   */
  canRequest(): boolean;

  /**
   * 记录成功
   */
  onSuccess(): void;

  /**
   * 记录失败
   */
  onFailure(): void;

  /**
   * 获取状态
   */
  getStatus(): CircuitStats;
}
```

**实现要点：**
- **CLOSED 状态**: 正常请求，失败时累加 consecutiveFailures
- **OPEN 状态**: 拒绝所有请求，等待 resetTimeout 后切换到 HALF_OPEN
- **HALF_OPEN 状态**: 允许有限请求，成功则恢复 CLOSED，失败则回到 OPEN
- 每个 provider 独立的 CircuitBreaker 实例

#### 2.3 ErrorClassifier（错误分类器）

```typescript
// src/ai/middleware/error-classifier.ts

export enum ErrorType {
  NetworkError = 'NetworkError',
  RateLimitError = 'RateLimitError',
  AuthError = 'AuthError',
  ServerError = 'ServerError',
  ClientError = 'ClientError',
  EmptyResponseError = 'EmptyResponseError',
  UnknownError = 'UnknownError',
}

export interface ErrorClassification {
  type: ErrorType;
  isRetryable: boolean;
  shouldFallback: boolean;
  waitBeforeRetry?: number;  // 建议等待时间 (ms)
}

export class ErrorClassifier {
  /**
   * 分类错误
   */
  classify(error: unknown): ErrorClassification {
    // HTTP 状态码判断
    if (error instanceof APIError) {
      switch (error.status) {
        case 429:
          return {
            type: ErrorType.RateLimitError,
            isRetryable: true,
            shouldFallback: false,
            waitBeforeRetry: this.parseRetryAfter(error.headers),
          };
        case 401:
        case 403:
          return {
            type: ErrorType.AuthError,
            isRetryable: false,
            shouldFallback: true,
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: ErrorType.ServerError,
            isRetryable: true,
            shouldFallback: true,
          };
        default:
          return {
            type: ErrorType.ClientError,
            isRetryable: false,
            shouldFallback: true,
          };
      }
    }

    // 网络错误
    if (error instanceof NetworkError || error.message.includes('timeout')) {
      return {
        type: ErrorType.NetworkError,
        isRetryable: true,
        shouldFallback: true,
      };
    }

    // 空响应
    if (error.message.includes('空内容') || error.message.includes('empty')) {
      return {
        type: ErrorType.EmptyResponseError,
        isRetryable: true,
        shouldFallback: true,
      };
    }

    // 未知错误
    return {
      type: ErrorType.UnknownError,
      isRetryable: true,
      shouldFallback: true,
    };
  }
}
```

#### 2.4 TimeoutController（超时控制器）

```typescript
// src/ai/middleware/timeout-controller.ts

export interface TimeoutConfig {
  global: number;        // 全局默认超时 (ms)
  connect: number;       // 连接超时 (ms)
  read: number;          // 读取超时 (ms)
  dynamicAdjustment: boolean;
}

export interface SceneTimeoutConfig {
  comment: number;       // 评论场景超时
  post: number;          // 发帖场景超时
  analysis: number;      // 分析场景超时
}

export class TimeoutController {
  private config: TimeoutConfig;
  private sceneConfig: SceneTimeoutConfig;
  private responseTimes: Map<string, number[]>;  // provider -> 响应时间历史

  constructor(config: TimeoutConfig, sceneConfig?: SceneTimeoutConfig);

  /**
   * 获取超时配置
   * @param provider provider 名称
   * @param scene 场景名称
   * @param providerTimeout provider 级别的超时（可选）
   */
  getTimeout(provider: string, scene?: string, providerTimeout?: number): number {
    // 优先级：provider > scene > global
    if (providerTimeout) return providerTimeout;
    if (scene && this.sceneConfig[scene]) return this.sceneConfig[scene];
    return this.config.global;
  }

  /**
   * 记录响应时间，用于动态调整
   */
  recordResponseTime(provider: string, duration: number): void;

  /**
   * 动态调整超时（如果启用）
   */
  getDynamicTimeout(provider: string): number {
    if (!this.config.dynamicAdjustment) return this.config.global;
    
    const times = this.responseTimes.get(provider) || [];
    if (times.length < 3) return this.config.global;

    const avg = times.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (avg > this.config.global * 0.8) {
      // 连续 3 次接近超时阈值，增加 20%
      return Math.round(this.config.global * 1.2);
    }
    return this.config.global;
  }
}
```

#### 2.5 FallbackChain（兜底链）

```typescript
// src/ai/middleware/fallback-chain.ts

export interface FallbackConfig {
  enabled: boolean;
  mode: 'fast' | 'robust';
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  providerOrder: string[];
}

export interface FallbackResult<T> {
  success: boolean;
  result?: T;
  usedProvider: string;
  attempts: number;
  fallbacks: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
}

export class FallbackChain {
  private config: FallbackConfig;
  private providers: AIProviderConfig[];
  private circuitBreakers: Map<string, CircuitBreaker>;
  private errorClassifier: ErrorClassifier;

  constructor(
    providers: AIProviderConfig[],
    config: FallbackConfig,
    circuitBreakers: Map<string, CircuitBreaker>
  );

  /**
   * 执行带兜底的调用
   */
  async execute<T>(
    fn: (provider: AIProviderConfig) => Promise<T>,
    scene?: string
  ): Promise<FallbackResult<T>> {
    const errors: Array<{ provider: string; error: Error }> = [];
    const fallbacks: FallbackResult<T>['fallbacks'] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      
      // 检查熔断器
      const cb = this.circuitBreakers.get(provider.name);
      if (cb && !cb.canRequest()) {
        logger.warn(`provider ${provider.name} 处于熔断状态，跳过`);
        continue;
      }

      const maxRetries = this.config.mode === 'fast' ? 0 : this.config.maxRetries;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await fn(provider);
          
          // 成功：更新熔断器
          cb?.onSuccess();
          
          return {
            success: true,
            result,
            usedProvider: provider.name,
            attempts: i * (maxRetries + 1) + attempt + 1,
            fallbacks,
          };
        } catch (err) {
          const classification = this.errorClassifier.classify(err);
          errors.push({ provider: provider.name, error: err as Error });
          
          cb?.onFailure();
          
          // 不可重试错误：立即 fallback
          if (!classification.isRetryable) {
            logger.warn(
              `provider ${provider.name} 发生不可重试错误 (${classification.type})，立即切换`
            );
            break;
          }

          // 限流错误：等待后重试，不计入 fallback
          if (classification.type === ErrorType.RateLimitError) {
            const waitTime = classification.waitBeforeRetry || 5000;
            logger.warn(`provider ${provider.name} 触发限流，等待 ${waitTime}ms`);
            await sleep(waitTime);
            continue;
          }

          // 可重试错误：判断是否还有重试次数
          if (attempt < maxRetries) {
            const delay = Math.min(
              this.config.baseDelay * Math.pow(2, attempt),
              this.config.maxDelay
            );
            logger.warn(
              `provider ${provider.name} 第 ${attempt + 1} 次尝试失败，${delay}ms 后重试`
            );
            await sleep(delay);
            continue;
          }

          // 重试耗尽：fallback 到下一个 provider
          if (i < this.providers.length - 1) {
            const nextProvider = this.providers[i + 1];
            fallbacks.push({
              from: provider.name,
              to: nextProvider.name,
              reason: classification.type,
            });
            logger.warn(
              `provider ${provider.name} 重试耗尽，切换到 ${nextProvider.name}`
            );
          }
          break;
        }
      }
    }

    // 所有 provider 均失败
    return {
      success: false,
      usedProvider: '',
      attempts: errors.length,
      fallbacks,
    };
  }
}
```

### 3. 集成方案

#### 3.1 修改 generateContent 函数

```typescript
// src/ai/client.ts

import { RateLimiter } from './middleware/rate-limiter';
import { CircuitBreaker } from './middleware/circuit-breaker';
import { FallbackChain } from './middleware/fallback-chain';
import { TimeoutController } from './middleware/timeout-controller';
import { ErrorClassifier } from './middleware/error-classifier';

// 单例实例
let rateLimiter: RateLimiter;
let circuitBreakers: Map<string, CircuitBreaker>;
let fallbackChain: FallbackChain;
let timeoutController: TimeoutController;
let errorClassifier: ErrorClassifier;

/**
 * 初始化兜底机制（应用启动时调用）
 */
export function initFallbackMechanism(): void {
  const config = loadConfig();
  
  rateLimiter = new RateLimiter(config.ai.rateLimit);
  timeoutController = new TimeoutController(
    config.ai.timeout,
    config.ai.sceneTimeout
  );
  errorClassifier = new ErrorClassifier();
  
  circuitBreakers = new Map(
    config.ai.providers.map(p => [
      p.name,
      new CircuitBreaker(config.ai.circuitBreaker)
    ])
  );
  
  fallbackChain = new FallbackChain(
    config.ai.providers,
    config.ai.fallback,
    circuitBreakers
  );
}

export async function generateContent(
  options: GenerateOptions & { scene?: 'comment' | 'post' | 'analysis' }
): Promise<string> {
  const config = loadConfig();
  
  // 1. 速率限制
  await rateLimiter.acquire(config.ai.providers[0].name);
  
  // 2. 执行带兜底的调用
  const result = await fallbackChain.execute(async (provider) => {
    // 3. 超时控制
    const timeout = timeoutController.getTimeout(
      provider.name,
      options.scene,
      provider.requestTimeout
    );
    
    const client = getProviderClient(provider);
    
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: provider.model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      max_tokens: options.maxTokens || provider.maxTokens || config.ai.maxTokens,
      temperature: options.temperature ?? provider.temperature ?? config.ai.temperature,
    }, { timeout });
    
    // 4. 记录响应时间
    const duration = Date.now() - startTime;
    timeoutController.recordResponseTime(provider.name, duration);
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('大模型返回空内容');
    }
    return content.trim();
  }, options.scene);
  
  if (!result.success) {
    throw new Error(`所有 provider 均失败: ${JSON.stringify(result.fallbacks)}`);
  }
  
  logger.info(
    `AI 生成成功 (provider=${result.usedProvider}, ` +
    `attempts=${result.attempts}, ` +
    `fallbacks=${result.fallbacks.length})`
  );
  
  return result.result!;
}
```

#### 3.2 业务层调用（无需修改）

```typescript
// src/ai/content-generator.ts

// 评论生成 - 使用 comment 场景
export async function generateComment(...): Promise<GeneratedComment> {
  // ... 构建 prompts ...
  let content = await generateContent({ 
    systemPrompt, 
    userPrompt,
    scene: 'comment'  // 新增场景参数
  });
  // ...
}

// 帖子生成 - 使用 post 场景
export async function generatePost(...): Promise<GeneratedPost> {
  // ... 构建 prompts ...
  const rawContent = await generateContent({ 
    systemPrompt, 
    userPrompt,
    scene: 'post'  // 新增场景参数
  });
  // ...
}
```

### 4. 配置扩展

```yaml
# config/default.yaml

ai:
  # 原有的 providers 配置保持不变
  providers:
    - name: "gpt"
      model: "gpt-5.4-mini"
      baseUrl: "http://47.104.95.133:16781/v1"
      apiKey: "sk-xxx"
      requestTimeout: 30000
    
    - name: "higpt"
      model: "higpt"
      baseUrl: "https://higpt.hxfssc.com:8088/v1"
      apiKey: "xxx"
      requestTimeout: 60000
  
  # 新增：兜底策略配置
  fallback:
    enabled: true
    mode: 'robust'           # 'fast' | 'robust'
    maxRetries: 2
    baseDelay: 2000
    maxDelay: 10000
    providerOrder: ['gpt', 'higpt']
  
  # 新增：超时配置
  timeout:
    global: 30000
    connect: 5000
    read: 25000
    dynamicAdjustment: true
    scene:
      comment: 15000         # 评论场景 15 秒
      post: 60000            # 发帖场景 60 秒
      analysis: 30000        # 分析场景 30 秒
  
  # 新增：速率限制
  rateLimit:
    enabled: true
    tokensPerMinute: 60
    burstSize: 10
    whitelist: ['higpt']     # 内网 provider 不限流
  
  # 新增：熔断器
  circuitBreaker:
    enabled: true
    failureThreshold: 5
    resetTimeout: 60000
    halfOpenMaxRequests: 3
```

### 5. 监控与日志

#### 5.1 监控指标

```typescript
// src/ai/middleware/metrics.ts

export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackCount: number;
  rateLimitCount: number;
  circuitBreakerTrips: number;
  avgResponseTime: number;
  p95ResponseTime: number;
}

export class MetricsCollector {
  private metrics: Map<string, ProviderMetrics>;

  recordRequest(provider: string, success: boolean, duration: number): void {
    // 更新指标
  }

  getMetrics(provider?: string): ProviderMetrics | ProviderMetrics[] {
    // 查询指标
  }

  exportJSON(): string {
    // 导出为 JSON
  }
}
```

#### 5.2 日志记录

```typescript
// 关键日志点

// 1. 速率限制触发
logger.warn(`[RateLimit] provider=${name}, waitTime=${waitTime}ms, tokens=${tokens}`);

// 2. 熔断器状态变化
logger.warn(`[CircuitBreaker] provider=${name}, state=${oldState}->${newState}`);

// 3. Fallback 切换
logger.warn(`[Fallback] from=${from}, to=${to}, reason=${reason}`);

// 4. 错误分类
logger.error(`[ErrorClassifier] type=${type}, provider=${provider}, action=${action}`);

// 5. 超时事件
logger.warn(`[Timeout] provider=${provider}, scene=${scene}, duration=${duration}ms, threshold=${threshold}ms`);

// 6. 每小时统计报告
logger.info(`[HourlyReport] ${JSON.stringify(metrics)}`);
```

## 风险与权衡

### 风险

1. **复杂度增加**: 引入多层中间件，调试难度增加
   - **缓解**: 完善的日志和监控，每个环节独立记录

2. **性能开销**: 速率限制、熔断器检查带来额外开销
   - **缓解**: 使用轻量级数据结构，开销 < 1ms

3. **配置错误**: 配置项增多，容易配置错误
   - **缓解**: 启动时配置验证，冲突时报警告

4. **向后兼容**: 旧配置可能缺少新增字段
   - **缓解**: 所有新增配置项都有默认值，normalizeAIConfig 处理

### 权衡

1. **快速失败 vs 稳健模式**: 无法同时满足低延迟和高成功率
   - **解决**: 通过场景参数区分，评论用快速，发帖用稳健

2. **全局配置 vs 场景配置**: 配置粒度选择
   - **解决**: 三级优先级：���景 > provider > 全局

3. **同步等待 vs 异步重试**: 速率限制触发时的处理
   - **解决**: 同步等待简化实现，日志明确记录等待时间

## 迁移计划

1. **阶段 1**: 新增中间件模块（不修改现有代码）
   - 创建 `src/ai/middleware/` 目录
   - 实现 5 个核心模块

2. **阶段 2**: 修改 generateContent 集成兜底机制
   - 保持接口兼容，scene 参数可选
   - 添加 initFallbackMechanism 初始化

3. **阶段 3**: 更新配置文件
   - 在 default.yaml 中添加新配置项
   - 更新 config.ts 类型定义

4. **阶段 4**: 测试验证
   - 单元测试：每个中间件模块
   - 集成测试：模拟各种错误场景
   - 压力测试：验证速率限制和熔断器

5. **阶段 5**: 监控告警
   - 实现 MetricsCollector
   - 添加每小时统计报告

无需停机，无需数据库迁移。
