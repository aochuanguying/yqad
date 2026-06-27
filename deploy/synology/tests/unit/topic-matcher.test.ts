import { HotTopic } from '../../src/types/posting-optimization';
import fc from 'fast-check';

// Mock the AI client
jest.mock('../../src/ai/client', () => ({
  generateContent: jest.fn(),
}));

const mockGetHotTopics = jest.fn();

// Mock the RealAudiApi - must be before the import of topic-matcher
jest.mock('../../src/api/real-client', () => ({
  RealAudiApi: jest.fn().mockImplementation(() => ({
    getHotTopics: mockGetHotTopics,
  })),
}));

import { matchTopics, fetchHotTopics } from '../../src/services/topic-matcher';
import { generateContent } from '../../src/ai/client';

const mockGenerateContent = generateContent as jest.MockedFunction<typeof generateContent>;

describe('TopicMatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchHotTopics', () => {
    it('should return hot topics from API', async () => {
      const mockTopics: HotTopic[] = [
        { id: '1', name: '#奥迪日常#', heatDegree: 100 },
        { id: '2', name: '#自驾游#', heatDegree: 80 },
      ];

      mockGetHotTopics.mockResolvedValue(mockTopics);

      const result = await fetchHotTopics('test-token');
      expect(result).toEqual(mockTopics);
      expect(mockGetHotTopics).toHaveBeenCalledWith('test-token');
    });

    it('should return empty array on API failure', async () => {
      mockGetHotTopics.mockRejectedValue(new Error('Network error'));

      const result = await fetchHotTopics('test-token');
      expect(result).toEqual([]);
    });
  });

  describe('matchTopics', () => {
    const candidates: HotTopic[] = [
      { id: '101', name: '#奥迪A6L#', heatDegree: 200 },
      { id: '102', name: '#自驾游#', heatDegree: 150 },
      { id: '103', name: '#冬季保养#', heatDegree: 120 },
      { id: '104', name: '#新能源#', heatDegree: 100 },
      { id: '105', name: '#车友会#', heatDegree: 90 },
      { id: '106', name: '#改装#', heatDegree: 80 },
      { id: '107', name: '#洗车#', heatDegree: 70 },
    ];

    it('should return matched topics from AI response', async () => {
      mockGenerateContent.mockResolvedValue(
        '[{"id": "101", "name": "#奥迪A6L#"}, {"id": "102", "name": "#自驾游#"}]'
      );

      const result = await matchTopics('周末自驾游', '开着A6L去了一趟郊外', candidates);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '101', name: '#奥迪A6L#' });
      expect(result[1]).toEqual({ id: '102', name: '#自驾游#' });
    });

    it('should return empty array when no candidates', async () => {
      const result = await matchTopics('测试标题', '测试内容', []);
      expect(result).toEqual([]);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should cap results at 5 topics maximum', async () => {
      mockGenerateContent.mockResolvedValue(
        JSON.stringify([
          { id: '101', name: '#奥迪A6L#' },
          { id: '102', name: '#自驾游#' },
          { id: '103', name: '#冬季保养#' },
          { id: '104', name: '#新能源#' },
          { id: '105', name: '#车友会#' },
          { id: '106', name: '#改装#' },
          { id: '107', name: '#洗车#' },
        ])
      );

      const result = await matchTopics('测试', '内容', candidates);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when AI returns empty array', async () => {
      mockGenerateContent.mockResolvedValue('[]');

      const result = await matchTopics('无关内容', '完全不相关的话题', candidates);
      expect(result).toEqual([]);
    });

    it('should return empty array when AI call fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('AI服务不可用'));

      const result = await matchTopics('测试', '内容', candidates);
      expect(result).toEqual([]);
    });

    it('should parse JSON from markdown code blocks', async () => {
      mockGenerateContent.mockResolvedValue(
        '```json\n[{"id": "103", "name": "#冬季保养#"}]\n```'
      );

      const result = await matchTopics('保养', '冬季保养技巧', candidates);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '103', name: '#冬季保养#' });
    });

    it('should handle malformed AI response gracefully', async () => {
      mockGenerateContent.mockResolvedValue('这不是有效的JSON响应');

      const result = await matchTopics('测试', '内容', candidates);
      expect(result).toEqual([]);
    });

    it('should extract JSON from mixed text response', async () => {
      mockGenerateContent.mockResolvedValue(
        '根据帖子内容，匹配的话题如下：\n[{"id": "101", "name": "#奥迪A6L#"}]\n以上是匹配结果。'
      );

      const result = await matchTopics('A6L', 'A6L驾驶感受', candidates);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '101', name: '#奥迪A6L#' });
    });

    // Feature: posting-optimization, Property 3: 话题关联数量上限
    // **Validates: Requirements 2.3**
    it('Property 3: matchTopics output length is always 0-5 regardless of AI response size', async () => {
      const topicArb = fc.record({
        id: fc.stringOf(fc.char(), { minLength: 1, maxLength: 10 }),
        name: fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 }).map((s) => `#${s}#`),
      });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 15 }),
          fc.array(topicArb, { minLength: 1, maxLength: 7 }),
          async (n, candidateTopics) => {
            // Generate N random topics as the AI response
            const aiTopics = Array.from({ length: n }, (_, i) => ({
              id: `topic-${i}`,
              name: `#话题${i}#`,
            }));

            // Mock AI to return N topics as JSON
            mockGenerateContent.mockResolvedValue(JSON.stringify(aiTopics));

            // Build candidates with heatDegree for the function signature
            const candidates: HotTopic[] = candidateTopics.map((t, i) => ({
              id: t.id,
              name: t.name,
              heatDegree: 100 - i,
            }));

            const result = await matchTopics('测试标题', '测试内容', candidates);

            // Property: output length is always between 0 and 5 inclusive
            expect(result.length).toBeGreaterThanOrEqual(0);
            expect(result.length).toBeLessThanOrEqual(5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
