import fc from 'fast-check';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock config
jest.mock('../../src/utils/config', () => ({
  loadConfig: () => ({
    internetReference: {
      enabled: true,
      searchKeywords: ['奥迪', '奥迪A6L', '奥迪用车'],
      maxResults: 5,
      timeout: 15000,
      rateLimitPerHour: 10,
      platform: 'xiaohongshu',
    },
  }),
}));

// Mock AI client
jest.mock('../../src/ai/client', () => ({
  generateContent: jest.fn(),
}));

import { canQuery, search, resetRateLimiter, getQueryCount } from '../../src/services/internet-reference-service';
import { generateContent } from '../../src/ai/client';

const mockGenerateContent = generateContent as jest.MockedFunction<typeof generateContent>;

describe('InternetReferenceService', () => {
  beforeEach(() => {
    resetRateLimiter();
    mockGenerateContent.mockReset();
  });

  describe('canQuery()', () => {
    it('初始状态下应返回 true', () => {
      expect(canQuery()).toBe(true);
    });

    it('查询次数未超限时应返回 true', () => {
      // 模拟进行几次查询
      mockGenerateContent.mockResolvedValue('[]');
      expect(canQuery()).toBe(true);
    });
  });

  describe('search()', () => {
    it('AI返回有效JSON时应解析出参考帖子', async () => {
      const mockResponse = JSON.stringify([
        { title: '奥迪A6L提车记', content: '今天终于提到了心心念念的A6L...', source: 'xiaohongshu' },
        { title: '奥迪保养攻略', content: '分享一下我的保养心得...', source: 'xiaohongshu' },
      ]);
      mockGenerateContent.mockResolvedValue(mockResponse);

      const results = await search(['奥迪']);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('奥迪A6L提车记');
      expect(results[0].source).toBe('xiaohongshu');
    });

    it('返回结果不超过 maxResults (5)', async () => {
      const mockResponse = JSON.stringify(
        Array.from({ length: 8 }, (_, i) => ({
          title: `帖子${i + 1}`,
          content: `内容${i + 1}`,
          source: 'xiaohongshu',
        }))
      );
      mockGenerateContent.mockResolvedValue(mockResponse);

      const results = await search(['奥迪']);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('AI调用失败时应返回空数组', async () => {
      mockGenerateContent.mockRejectedValue(new Error('网络错误'));

      const results = await search(['奥迪']);
      expect(results).toEqual([]);
    });

    it('AI返回无效JSON时应返回空数组', async () => {
      mockGenerateContent.mockResolvedValue('这不是一个有效的JSON响应');

      const results = await search(['奥迪']);
      expect(results).toEqual([]);
    });

    it('AI返回混合文本和JSON时应提取JSON部分', async () => {
      const mockResponse = `以下是搜索结果：
[{"title": "奥迪提车", "content": "提车记录...", "source": "xiaohongshu"}]
以上是相关帖子。`;
      mockGenerateContent.mockResolvedValue(mockResponse);

      const results = await search(['奥迪']);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('奥迪提车');
    });

    it('频率超限时应直接返回空数组且不调用AI', async () => {
      // 消耗所有配额
      mockGenerateContent.mockResolvedValue('[]');
      for (let i = 0; i < 10; i++) {
        await search(['奥迪']);
      }

      mockGenerateContent.mockClear();
      const results = await search(['奥迪']);
      expect(results).toEqual([]);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('使用自定义关键词时应传递给AI', async () => {
      mockGenerateContent.mockResolvedValue('[]');
      await search(['自定义关键词', '测试']);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain('自定义关键词');
      expect(callArgs.userPrompt).toContain('测试');
    });

    it('未指定关键词时应使用配置中的默认关键词', async () => {
      mockGenerateContent.mockResolvedValue('[]');
      await search();

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain('奥迪');
    });
  });

  describe('频率限制', () => {
    it('第10次查询后 canQuery 应返回 false', async () => {
      mockGenerateContent.mockResolvedValue('[]');

      for (let i = 0; i < 10; i++) {
        expect(canQuery()).toBe(true);
        await search(['奥迪']);
      }

      expect(canQuery()).toBe(false);
    });

    it('getQueryCount 应正确反映查询次数', async () => {
      mockGenerateContent.mockResolvedValue('[]');
      expect(getQueryCount()).toBe(0);

      await search(['奥迪']);
      expect(getQueryCount()).toBe(1);

      await search(['奥迪']);
      expect(getQueryCount()).toBe(2);
    });

    it('resetRateLimiter 应清除所有记录', async () => {
      mockGenerateContent.mockResolvedValue('[]');

      for (let i = 0; i < 5; i++) {
        await search(['奥迪']);
      }
      expect(getQueryCount()).toBe(5);

      resetRateLimiter();
      expect(getQueryCount()).toBe(0);
      expect(canQuery()).toBe(true);
    });
  });

  // Feature: posting-optimization, Property 11: 频率限制不变量
  // **Validates: Requirements 6.8**
  describe('Property 11: 频率限制不变量', () => {
    it('1小时窗口内前10次 canQuery() 返回 true，第11次返回 false，窗口重置后重新允许', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 15 }),
          async (n: number) => {
            // Reset before each iteration
            resetRateLimiter();
            mockGenerateContent.mockResolvedValue('[]');

            // Perform N searches
            for (let i = 0; i < n; i++) {
              await search(['奥迪']);
            }

            // Verify: canQuery() reflects whether we've exhausted the limit
            if (n < 10) {
              expect(canQuery()).toBe(true);
            } else {
              // n >= 10: rate limit reached
              expect(canQuery()).toBe(false);
            }

            // After reset, canQuery() should always return true
            resetRateLimiter();
            expect(canQuery()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
