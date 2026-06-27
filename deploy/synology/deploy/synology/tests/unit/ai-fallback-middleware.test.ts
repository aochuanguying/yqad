/**
 * AI 兜底中间件单元测试
 */

import { RateLimiter } from '../../src/ai/middleware/rate-limiter';
import { CircuitBreaker } from '../../src/ai/middleware/circuit-breaker';
import { ErrorClassifier, ClassifiedError } from '../../src/ai/middleware/error-classifier';
import { TimeoutController } from '../../src/ai/middleware/timeout-controller';
import { metricsCollector } from '../../src/ai/middleware/metrics';

describe('AI Fallback Middleware', () => {
  describe('RateLimiter', () => {
    it('应该正确初始化 token', () => {
      const limiter = new RateLimiter({
        tokensPerMinute: 60,
        burstSize: 10,
      });

      const status = limiter.getStatus('test');
      expect(status.availableTokens).toBe(10);
      expect(status.isWhitelisted).toBe(false);
    });

    it('应该对白名单 provider 跳过限流', async () => {
      const limiter = new RateLimiter({
        tokensPerMinute: 60,
        burstSize: 1,
        whitelist: ['higpt'],
      });

      const beforeStatus = limiter.getStatus('higpt');
      expect(beforeStatus.isWhitelisted).toBe(true);

      // 白名单 provider 不应该消耗 token
      await limiter.acquire('higpt');
      const afterStatus = limiter.getStatus('higpt');
      expect(afterStatus.availableTokens).toBe(1);
    });

    it('应该正确消耗 token', async () => {
      const limiter = new RateLimiter({
        tokensPerMinute: 60,
        burstSize: 5,
      });

      // 消耗 1 个 token
      await limiter.acquire('gpt');
      const status = limiter.getStatus('gpt');
      expect(status.availableTokens).toBe(4);
    });
  });

  describe('CircuitBreaker', () => {
    it('应该初始化为 CLOSED 状态', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenMaxRequests: 3,
      });

      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.consecutiveFailures).toBe(0);
    });

    it('应该在连续失败时触发熔断', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenMaxRequests: 3,
      });

      // 模拟 3 次失败
      for (let i = 0; i < 3; i++) {
        breaker.onFailure();
      }

      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.consecutiveFailures).toBe(3);
      expect(breaker.canRequest()).toBe(false);
    });

    it('应该在成功后重置状态', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenMaxRequests: 3,
      });

      // 2 次失败
      breaker.onFailure();
      breaker.onFailure();

      // 1 次成功
      breaker.onSuccess();

      const status = breaker.getStatus();
      expect(status.consecutiveFailures).toBe(0);
      expect(status.state).toBe('CLOSED');
    });

    it('应该在 OPEN 超时后切换到 HALF_OPEN', (done) => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100, // 100ms 后恢复
        halfOpenMaxRequests: 3,
      });

      // 触发熔断
      breaker.onFailure();
      expect(breaker.getStatus().state).toBe('OPEN');

      // 等待 150ms
      setTimeout(() => {
        const status = breaker.getStatus();
        expect(status.state).toBe('HALF_OPEN');
        expect(breaker.canRequest()).toBe(true);
        done();
      }, 150);
    });
  });

  describe('ErrorClassifier', () => {
    const classifier = new ErrorClassifier();

    it('应该正确分类 429 限流错误', () => {
      const error = {
        status: 429,
        message: 'Too Many Requests',
        response: {
          headers: {
            'retry-after': '5',
          },
        },
      };

      const classified = classifier.classify(error);
      expect(classified.type).toBe('RateLimitError');
      expect(classified.isRetryable).toBe(true);
      expect(classified.shouldFallback).toBe(false);
      expect(classified.waitBeforeRetry).toBe(5000);
    });

    it('应该正确分类 401 认证错误', () => {
      const error = {
        status: 401,
        message: 'Unauthorized',
      };

      const classified = classifier.classify(error);
      expect(classified.type).toBe('AuthError');
      expect(classified.isRetryable).toBe(false);
      expect(classified.shouldFallback).toBe(true);
    });

    it('应该正确分类 500 服务器错误', () => {
      const error = {
        status: 503,
        message: 'Service Unavailable',
      };

      const classified = classifier.classify(error);
      expect(classified.type).toBe('ServerError');
      expect(classified.isRetryable).toBe(true);
      expect(classified.shouldFallback).toBe(true);
    });

    it('应该正确分类网络错误', () => {
      const error = new Error('Connection timeout');

      const classified = classifier.classify(error);
      expect(classified.type).toBe('NetworkError');
      expect(classified.isRetryable).toBe(true);
      expect(classified.shouldFallback).toBe(true);
    });
  });

  describe('TimeoutController', () => {
    it('应该使用 provider 级别的超时配置', () => {
      const controller = new TimeoutController({
        global: 30000,
        scene: {
          comment: 15000,
          post: 60000,
        },
      });

      const result = controller.getTimeout('gpt', 45000, 'comment');
      expect(result.timeout).toBe(45000);
      expect(result.source).toBe('provider');
    });

    it('应该使用场景级别的超时配置', () => {
      const controller = new TimeoutController({
        global: 30000,
        scene: {
          comment: 15000,
          post: 60000,
        },
      });

      const result = controller.getTimeout('gpt', undefined, 'comment');
      expect(result.timeout).toBe(15000);
      expect(result.source).toBe('scene');
    });

    it('应该使用全局超时配置', () => {
      const controller = new TimeoutController({
        global: 30000,
      });

      const result = controller.getTimeout('gpt');
      expect(result.timeout).toBe(30000);
      expect(result.source).toBe('global');
    });

    it('应该动态调整超时', () => {
      const controller = new TimeoutController({
        global: 30000,
        dynamicAdjustment: true,
      });

      // 模拟 3 次接近超时的响应（都超过 30000 的 80%=24000）
      controller.recordResponseTime('gpt', 25000);
      controller.recordResponseTime('gpt', 26000);
      controller.recordResponseTime('gpt', 27000);

      const result = controller.getTimeout('gpt');
      expect(result.timeout).toBe(36000); // 应该增加 20% 到 36000
      expect(result.adjusted).toBe(true);
    });
  });

  describe('MetricsCollector', () => {
    it('应该正确记录请求指标', () => {
      metricsCollector.recordRequest('gpt', true, 1500);
      const metrics = metricsCollector.getMetrics('gpt');

      expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
      expect(metrics.successfulRequests).toBeGreaterThanOrEqual(1);
      expect(metrics.avgResponseTime).toBeGreaterThan(0);
    });

    it('应该正确计算健康状态', () => {
      metricsCollector.recordRequest('higpt', false, 0);
      metricsCollector.recordRequest('higpt', false, 0);
      metricsCollector.recordRequest('higpt', false, 0);

      const health = metricsCollector.getHealthStatus('higpt');
      expect(health.consecutiveFailures).toBeGreaterThanOrEqual(3);
      expect(health.status).toBe('warning');
    });
  });
});
