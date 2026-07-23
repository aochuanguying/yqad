/**
 * Property-Based Test: FallbackChain vision provider 过滤
 * 
 * Feature: ai-provider-vision-support, Property 5: FallbackChain vision provider 过滤
 * 
 * 对任意 provider 列表（混合 supportsVision=true/false），当 requireVision=true 时，
 * FallbackChain 仅尝试调用 supportsVision=true 的 provider，
 * 不调用任何 supportsVision=false 的 provider。
 * 
 * **Validates: Requirements 4.1**
 */

// Mock logger
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock metrics
jest.mock('../../ai/middleware/metrics', () => ({
  metricsCollector: {
    recordRequest: jest.fn(),
    updateCircuitState: jest.fn(),
    getMetrics: jest.fn(() => ({})),
    getHealthStatus: jest.fn(() => ({})),
  },
}));

import * as fc from 'fast-check';
import { FallbackChain, FallbackConfig } from '../../ai/middleware/fallback-chain';
import { AIProviderConfig } from '../../utils/config';

// Feature: ai-provider-vision-support, Property 5: FallbackChain vision provider 过滤

/**
 * 生成随机 provider 配置的 arbitrary
 */
const providerConfigArb = (name: string, supportsVision: boolean): fc.Arbitrary<AIProviderConfig> =>
  fc.record({
    name: fc.constant(name),
    apiKey: fc.constant('test-key'),
    baseUrl: fc.constant('http://test.api'),
    model: fc.constant('test-model'),
    supportsVision: fc.constant(supportsVision),
  });

/**
 * 生成混合 vision/non-vision provider 列表的 arbitrary
 * 至少 1 个 provider，最多 10 个
 */
const providerListArb: fc.Arbitrary<AIProviderConfig[]> = fc
  .array(
    fc.record({
      nameIndex: fc.nat({ max: 99 }),
      supportsVision: fc.boolean(),
    }),
    { minLength: 1, maxLength: 10 }
  )
  .map((items) =>
    items.map((item, idx) => ({
      name: `provider-${idx}-${item.nameIndex}`,
      apiKey: 'test-key',
      baseUrl: 'http://test.api',
      model: 'test-model',
      supportsVision: item.supportsVision,
    }))
  );

function createFallbackChain(providers: AIProviderConfig[]): FallbackChain {
  const fallbackConfig: FallbackConfig = {
    enabled: true,
    mode: 'fast',
    maxRetries: 0,
    baseDelay: 100,
    maxDelay: 1000,
    providerOrder: providers.map((p) => p.name),
  };

  const chain = new FallbackChain(
    fallbackConfig,
    { timeout: 30000 },
    { tokensPerMinute: 60, burstSize: 10 },
    { failureThreshold: 5, resetTimeout: 60000, halfOpenMaxRequests: 3 }
  );

  chain.initProviders(providers);
  return chain;
}

describe('Property 5: FallbackChain vision provider 过滤', () => {
  it('当 requireVision=true 时，仅调用 supportsVision=true 的 provider', async () => {
    await fc.assert(
      fc.asyncProperty(providerListArb, async (providers) => {
        const chain = createFallbackChain(providers);
        const calledProviders: string[] = [];

        const executeFn = async (provider: AIProviderConfig, _timeout: number): Promise<string> => {
          calledProviders.push(provider.name);
          return 'success';
        };

        await chain.execute(executeFn, undefined, true);

        const visionProviderNames = new Set(
          providers.filter((p) => p.supportsVision === true).map((p) => p.name)
        );

        // 所有被调用的 provider 必须是 supportsVision=true 的
        for (const called of calledProviders) {
          expect(visionProviderNames.has(called)).toBe(true);
        }

        // 没有任何 supportsVision=false 的 provider 被调用
        const nonVisionProviderNames = new Set(
          providers.filter((p) => p.supportsVision !== true).map((p) => p.name)
        );
        for (const called of calledProviders) {
          expect(nonVisionProviderNames.has(called)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('当 requireVision=true 且无 supportsVision=true 的 provider 时，立即返回 success: false 且不调用任何 provider', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成仅含 supportsVision=false 的 provider 列表
        fc
          .array(fc.nat({ max: 99 }), { minLength: 1, maxLength: 10 })
          .map((indices) =>
            indices.map((idx, i) => ({
              name: `non-vision-${i}-${idx}`,
              apiKey: 'test-key',
              baseUrl: 'http://test.api',
              model: 'test-model',
              supportsVision: false,
            }))
          ),
        async (providers) => {
          const chain = createFallbackChain(providers);
          const calledProviders: string[] = [];

          const executeFn = async (provider: AIProviderConfig, _timeout: number): Promise<string> => {
            calledProviders.push(provider.name);
            return 'success';
          };

          const result = await chain.execute(executeFn, undefined, true);

          // 应立即返回 success: false
          expect(result.success).toBe(false);
          // 不应调用任何 provider
          expect(calledProviders).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('当 requireVision=false 时，可以调用所有 provider（不过滤）', async () => {
    await fc.assert(
      fc.asyncProperty(providerListArb, async (providers) => {
        const chain = createFallbackChain(providers);
        const calledProviders: string[] = [];

        const executeFn = async (provider: AIProviderConfig, _timeout: number): Promise<string> => {
          calledProviders.push(provider.name);
          return 'success';
        };

        await chain.execute(executeFn, undefined, false);

        // 当 requireVision=false 时，第一个 provider 被调用（因为成功即停止）
        // 重要的是它不受 supportsVision 限制
        expect(calledProviders.length).toBeGreaterThan(0);
        // 第一个被调用的应该是 providerOrder 中第一个
        expect(calledProviders[0]).toBe(providers[0].name);
      }),
      { numRuns: 100 }
    );
  });
});
