/**
 * AI 兜底链
 * 协调速率限制、熔断器、错误分类、重试和 fallback
 */

import { RateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';
import { ErrorClassifier, ClassifiedError, ErrorType } from './error-classifier';
import { TimeoutController } from './timeout-controller';
import { metricsCollector } from './metrics';
import { AIProviderConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';

const logger = getLogger('ai-fallback');

export type FallbackMode = 'fast' | 'robust';

export interface FallbackConfig {
  enabled: boolean;
  mode: FallbackMode;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  providerOrder: string[];
}

export interface FallbackResult {
  success: boolean;
  content?: string;
  usedProvider: string;
  responseTime: number;
  fallbacks: string[];
  errors: ClassifiedError[];
}

interface ProviderInstance {
  config: AIProviderConfig;
  rateLimiter: RateLimiter;
  circuitBreaker: CircuitBreaker;
}

/**
 * 兜底链
 */
export class FallbackChain {
  private providers: Map<string, ProviderInstance> = new Map();
  private readonly config: FallbackConfig;
  private readonly timeoutController: TimeoutController;
  private readonly errorClassifier: ErrorClassifier;

  private readonly rateLimitConfig: any;
  private readonly circuitBreakerConfig: any;

  constructor(
    config: FallbackConfig,
    timeoutConfig: any,
    rateLimitConfig: any,
    circuitBreakerConfig: any
  ) {
    this.config = config;
    this.rateLimitConfig = rateLimitConfig || {};
    this.circuitBreakerConfig = circuitBreakerConfig || {};
    this.timeoutController = new TimeoutController(timeoutConfig);
    this.errorClassifier = new ErrorClassifier();
  }

  /**
   * 初始化 provider 实例
   */
  initProviders(providers: AIProviderConfig[]): void {
    this.providers.clear();
    
    for (const provider of providers) {
      const rateLimiter = new RateLimiter({
        tokensPerMinute: this.rateLimitConfig.tokensPerMinute ?? 60,
        burstSize: this.rateLimitConfig.burstSize ?? 10,
        whitelist: this.rateLimitConfig.whitelist ?? [],
      });

      const circuitBreaker = new CircuitBreaker({
        failureThreshold: this.circuitBreakerConfig.failureThreshold ?? 5,
        resetTimeout: this.circuitBreakerConfig.resetTimeout ?? 60000,
        halfOpenMaxRequests: this.circuitBreakerConfig.halfOpenMaxRequests ?? 3,
      });

      this.providers.set(provider.name, {
        config: provider,
        rateLimiter,
        circuitBreaker,
      });
    }

    logger.info(`初始化 ${providers.length} 个 AI provider`);
  }

  /**
   * 执行兜底链调用
   */
  async execute(
    executeFn: (provider: AIProviderConfig, timeout: number) => Promise<string>,
    scene?: 'comment' | 'post' | 'analysis'
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    const fallbacks: string[] = [];
    const errors: ClassifiedError[] = [];

    // 确定 provider 顺序
    const providerOrder = this.config.providerOrder.length > 0
      ? this.config.providerOrder
      : Array.from(this.providers.keys());

    // 遍历 provider
    for (const providerName of providerOrder) {
      const providerInstance = this.providers.get(providerName);
      if (!providerInstance) {
        logger.warn(`Provider "${providerName}" 未找到，跳过`);
        continue;
      }

      const { config: provider, rateLimiter, circuitBreaker } = providerInstance;

      // 检查熔断器状态
      if (!circuitBreaker.canRequest()) {
        const status = circuitBreaker.getStatus();
        logger.warn(`Provider "${providerName}" 熔断器处于 ${status.state} 状态，跳过`);
        metricsCollector.updateCircuitState(providerName, status.state);
        continue;
      }

      try {
        // 速率限制
        const rateLimitStatus = rateLimiter.getStatus(providerName);
        if (!rateLimitStatus.isWhitelisted && rateLimitStatus.availableTokens < 1) {
          logger.debug(`Provider "${providerName}" 等待速率限制 token...`);
          metricsCollector.recordRequest(providerName, false, 0, { triggeredRateLimit: true });
        }
        
        await rateLimiter.acquire(providerName);

        // 获取超时配置
        const timeoutResult = this.timeoutController.getTimeout(
          providerName,
          provider.requestTimeout,
          scene
        );

        logger.debug(
          `使用 Provider "${providerName}" (mode=${this.config.mode}, timeout=${timeoutResult.timeout}ms, source=${timeoutResult.source})`
        );

        // 执行调用
        const content = await this.executeWithRetry(
          provider,
          timeoutResult.timeout,
          executeFn,
          circuitBreaker,
          providerName
        );

        // 成功
        const responseTime = Date.now() - startTime;
        this.timeoutController.recordResponseTime(providerName, responseTime);
        metricsCollector.recordRequest(providerName, true, responseTime);
        circuitBreaker.onSuccess();

        logger.info(
          `✓ AI 生成成功 (provider=${providerName}, time=${responseTime}ms, fallbacks=${fallbacks.length})`
        );

        return {
          success: true,
          content,
          usedProvider: providerName,
          responseTime,
          fallbacks,
          errors,
        };
      } catch (error: any) {
        const errorType = this.errorClassifier.classify(error);
        const classifiedError = new ClassifiedError(error?.message || 'Unknown error', errorType, error);
        errors.push(classifiedError);
        circuitBreaker.onFailure();
        metricsCollector.updateCircuitState(providerName, circuitBreaker.getStatus().state);

        logger.warn(
          `Provider "${providerName}" 失败：${errorType} - ${error?.message || 'Unknown error'}`
        );

        // 记录 fallback
        if (fallbacks.length === 0 || fallbacks[fallbacks.length - 1] !== providerName) {
          fallbacks.push(providerName);
        }

        // 判断是否切换到下一个 provider
        // 简单策略：所有错误都 fallback 到下一个 provider
        const isRetryable = errorType === ErrorType.NETWORK || errorType === ErrorType.TIMEOUT;
        const shouldFallback = true;
        
        if (!isRetryable && !shouldFallback) {
          logger.warn(`Provider "${providerName}" 错误不可重试且不 fallback，停止`);
          break;
        }
        
        // 如果是认证错误（401/403），虽然不可重试，但应该切换到下一个 provider
        if (errorType === ErrorType.API) {
          logger.warn(`Provider "${providerName}" 认证失败，切换到下一个 provider`);
          // 继续循环，尝试下一个 provider
        }
      }
    }

    // 所有 provider 均失败
    const responseTime = Date.now() - startTime;
    logger.error(
      `✗ 所有 provider 均失败 (time=${responseTime}ms, fallbacks=${fallbacks.length}, errors=${errors.length})`
    );

    return {
      success: false,
      usedProvider: '',
      responseTime,
      fallbacks,
      errors,
    };
  }

  /**
   * 执行带重试的调用
   */
  private async executeWithRetry(
    provider: AIProviderConfig,
    timeout: number,
    executeFn: (provider: AIProviderConfig, timeout: number) => Promise<string>,
    circuitBreaker: CircuitBreaker,
    providerName: string
  ): Promise<string> {
    const maxRetries = this.config.mode === 'robust' ? this.config.maxRetries : 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 执行调用
        const content = await this.executeWithTimeout(executeFn, provider, timeout);
        return content;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          // 计算等待时间（指数退避）
          const delay = Math.min(
            this.config.maxDelay,
            this.config.baseDelay * Math.pow(2, attempt)
          );
          
          logger.debug(
            `Provider "${providerName}" 重试 (${attempt + 1}/${maxRetries})，等待 ${delay}ms`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 执行带超时的调用
   */
  private async executeWithTimeout(
    executeFn: (provider: AIProviderConfig, timeout: number) => Promise<string>,
    provider: AIProviderConfig,
    timeout: number
  ): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`请求超时 (${timeout}ms)`));
      }, timeout);
    });

    return Promise.race([
      executeFn(provider, timeout),
      timeoutPromise,
    ]);
  }

  /**
   * 等待指定毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取所有 provider 的健康状态
   */
  getHealthStatus(): Map<string, any> {
    const result = new Map();
    
    for (const [name, instance] of this.providers.entries()) {
      const circuitStatus = instance.circuitBreaker.getStatus();
      const rateLimitStatus = instance.rateLimiter.getStatus(name);
      const metrics = metricsCollector.getMetrics(name);
      const health = metricsCollector.getHealthStatus();
      
      result.set(name, {
        ...health,
        rateLimit: rateLimitStatus,
        metrics,
      });
    }
    
    return result;
  }
}
