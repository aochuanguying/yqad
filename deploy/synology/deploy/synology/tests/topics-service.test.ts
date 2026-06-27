import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';

// Mock fs and logger before importing service
jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const TOPICS_PATH = path.resolve(process.cwd(), 'data/topics.json');

import {
  getAllTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  markTopicUsed,
  resetTopic,
  resetAllTopics,
  getNextAvailableTopic,
  incrementUseCount,
} from '../src/web/services/topics-service';

describe('topics-service', () => {
  beforeEach(() => {
    // 确保测试前清理
    if (fs.existsSync(TOPICS_PATH)) {
      fs.unlinkSync(TOPICS_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TOPICS_PATH)) {
      fs.unlinkSync(TOPICS_PATH);
    }
  });

  describe('CRUD 操作', () => {
    it('应创建主题', () => {
      const topic = createTopic({
        title: '测试主题',
        direction: '分享奥迪驾驶体验',
        outline: '1.准备 2.出发 3.总结',
        materialPaths: ['travel/photo1.jpg'],
      });

      expect(topic.id).toBeDefined();
      expect(topic.title).toBe('测试主题');
      expect(topic.status).toBe('unused');
      expect(topic.materialPaths).toHaveLength(1);
    });

    it('应读取所有主题', () => {
      createTopic({ title: '主题1', direction: '方向1' });
      createTopic({ title: '主题2', direction: '方向2' });

      const topics = getAllTopics();
      expect(topics).toHaveLength(2);
    });

    it('应更新主题', () => {
      const topic = createTopic({ title: '原标题', direction: '原方向' });
      const updated = updateTopic(topic.id, { title: '新标题' });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('新标题');
      expect(updated!.direction).toBe('原方向');
    });

    it('应删除主题', () => {
      const topic = createTopic({ title: '待删除', direction: '方向' });
      expect(deleteTopic(topic.id)).toBe(true);
      expect(getAllTopics()).toHaveLength(0);
    });

    it('删除不存在的主题应返回 false', () => {
      expect(deleteTopic('nonexistent')).toBe(false);
    });
  });

  describe('状态管理', () => {
    it('应标记主题为已使用', () => {
      const topic = createTopic({ title: '主题', direction: '方向' });
      const used = markTopicUsed(topic.id);

      expect(used).not.toBeNull();
      expect(used!.status).toBe('used');
      expect(used!.usedAt).toBeDefined();
    });

    it('应重置单个主题', () => {
      const topic = createTopic({ title: '主题', direction: '方向' });
      markTopicUsed(topic.id);

      const reset = resetTopic(topic.id);
      expect(reset).not.toBeNull();
      expect(reset!.status).toBe('unused');
    });

    it('应重置所有主题', () => {
      const t1 = createTopic({ title: '主题1', direction: '方向1' });
      const t2 = createTopic({ title: '主题2', direction: '方向2' });
      markTopicUsed(t1.id);
      markTopicUsed(t2.id);

      const count = resetAllTopics();
      expect(count).toBe(2);

      const topics = getAllTopics();
      expect(topics.every(t => t.status === 'unused')).toBe(true);
    });
  });

  describe('FIFO 选取', () => {
    it('应返回最早创建的未使用主题', () => {
      const t1 = createTopic({ title: '第一个', direction: '方向1' });
      createTopic({ title: '第二个', direction: '方向2' });

      const next = getNextAvailableTopic();
      expect(next).not.toBeNull();
      expect(next!.id).toBe(t1.id);
    });

    it('应跳过已使用的主题', () => {
      const t1 = createTopic({ title: '第一个', direction: '方向1' });
      const t2 = createTopic({ title: '第二个', direction: '方向2' });
      markTopicUsed(t1.id);

      const next = getNextAvailableTopic();
      expect(next).not.toBeNull();
      expect(next!.id).toBe(t2.id);
    });

    it('所有主题已使用时应返回 null', () => {
      const t1 = createTopic({ title: '主题', direction: '方向' });
      markTopicUsed(t1.id);

      const next = getNextAvailableTopic();
      expect(next).toBeNull();
    });

    it('无主题时应返回 null', () => {
      const next = getNextAvailableTopic();
      expect(next).toBeNull();
    });
  });

  describe('主题复用与 incrementUseCount', () => {
    it('创建主题时默认 useCount=0, maxUseCount=1, postHistory=[]', () => {
      const topic = createTopic({ title: '主题', direction: '方向' });
      expect(topic.useCount).toBe(0);
      expect(topic.maxUseCount).toBe(1);
      expect(topic.postHistory).toEqual([]);
    });

    it('创建主题时可指定 maxUseCount', () => {
      const topic = createTopic({ title: '主题', direction: '方向', maxUseCount: 5 });
      expect(topic.maxUseCount).toBe(5);
    });

    it('incrementUseCount 应递增 useCount 并记录 postSummary', () => {
      const topic = createTopic({ title: '主题', direction: '方向', maxUseCount: 3 });
      const summary = { title: '帖子1', contentSnippet: '内容摘要...', timestamp: new Date().toISOString() };

      const updated = incrementUseCount(topic.id, summary);
      expect(updated).not.toBeNull();
      expect(updated!.useCount).toBe(1);
      expect(updated!.postHistory).toHaveLength(1);
      expect(updated!.postHistory[0].title).toBe('帖子1');
    });

    it('incrementUseCount 达到 maxUseCount 时应标记 status 为 used', () => {
      const topic = createTopic({ title: '主题', direction: '方向', maxUseCount: 1 });
      const summary = { title: '帖子', contentSnippet: '摘要', timestamp: new Date().toISOString() };

      const updated = incrementUseCount(topic.id, summary);
      expect(updated!.useCount).toBe(1);
      expect(updated!.status).toBe('used');
      expect(updated!.usedAt).toBeDefined();
    });

    it('incrementUseCount 未达到 maxUseCount 时 status 保持 unused', () => {
      const topic = createTopic({ title: '主题', direction: '方向', maxUseCount: 3 });
      const summary = { title: '帖子', contentSnippet: '摘要', timestamp: new Date().toISOString() };

      const updated = incrementUseCount(topic.id, summary);
      expect(updated!.useCount).toBe(1);
      expect(updated!.status).toBe('unused');
    });

    it('incrementUseCount 对不存在的 id 应返回 null', () => {
      const result = incrementUseCount('nonexistent', { title: '帖', contentSnippet: '摘', timestamp: '' });
      expect(result).toBeNull();
    });

    it('maxUseCount > 1 的主题在使用次数未满时应保持可用', () => {
      const topic = createTopic({ title: '复用主题', direction: '方向', maxUseCount: 3 });
      const summary = { title: '帖', contentSnippet: '摘要', timestamp: new Date().toISOString() };

      incrementUseCount(topic.id, summary);
      incrementUseCount(topic.id, { ...summary, title: '帖2' });

      const next = getNextAvailableTopic();
      expect(next).not.toBeNull();
      expect(next!.id).toBe(topic.id);
      expect(next!.useCount).toBe(2);
    });

    it('maxUseCount 达到时主题不再被 getNextAvailableTopic 返回', () => {
      const topic = createTopic({ title: '复用主题', direction: '方向', maxUseCount: 2 });
      const summary = { title: '帖', contentSnippet: '摘要', timestamp: new Date().toISOString() };

      incrementUseCount(topic.id, summary);
      incrementUseCount(topic.id, { ...summary, title: '帖2' });

      const next = getNextAvailableTopic();
      expect(next).toBeNull();
    });

    it('向后兼容：旧格式 topics.json 中无 useCount 字段时应默认处理', () => {
      // 直接写入旧格式的 topics.json
      const oldFormatTopics = [
        {
          id: 'old-topic-1',
          title: '旧主题',
          direction: '旧方向',
          outline: '',
          materialPaths: [],
          status: 'unused',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      fs.writeFileSync(TOPICS_PATH, JSON.stringify(oldFormatTopics, null, 2), 'utf-8');

      const topics = getAllTopics();
      expect(topics[0].useCount).toBe(0);
      expect(topics[0].maxUseCount).toBe(1);
      expect(topics[0].postHistory).toEqual([]);

      // 旧格式主题应被视为可用
      const next = getNextAvailableTopic();
      expect(next).not.toBeNull();
      expect(next!.id).toBe('old-topic-1');
    });
  });

  // Feature: posting-optimization, Property 6: 主题可用性不变量
  // **Validates: Requirements 4.2, 4.3**
  describe('Property 6: 主题可用性不变量', () => {
    it('useCount < maxUseCount 等价于主题在 getNextAvailableTopic 候选列表中', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),   // useCount
          fc.integer({ min: 1, max: 100 }),   // maxUseCount
          (useCount, maxUseCount) => {
            // 清理数据文件
            if (fs.existsSync(TOPICS_PATH)) {
              fs.unlinkSync(TOPICS_PATH);
            }

            // 创建一个主题并手动设置 useCount 和 maxUseCount
            const topicData = [
              {
                id: 'pbt-topic-1',
                title: '属性测试主题',
                direction: '测试方向',
                outline: '',
                materialPaths: [],
                status: useCount >= maxUseCount ? 'used' : 'unused',
                createdAt: '2026-01-01T00:00:00.000Z',
                useCount,
                maxUseCount,
                postHistory: [],
              },
            ];
            fs.writeFileSync(TOPICS_PATH, JSON.stringify(topicData, null, 2), 'utf-8');

            const result = getNextAvailableTopic();

            if (useCount < maxUseCount) {
              // 主题可用：应被返回
              expect(result).not.toBeNull();
              expect(result!.id).toBe('pbt-topic-1');
            } else {
              // 主题不可用：应返回 null
              expect(result).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: posting-optimization, Property 7: 使用计数递增
  // **Validates: Requirements 4.7**
  describe('Property 7: 使用计数递增', () => {
    it('初始 useCount=n 时成功发帖后 useCount=n+1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),  // maxUseCount
          fc.nat(),                          // seed for generating startCount
          (maxUseCount, seed) => {
            // Generate startCount in range [0, maxUseCount - 1]
            const startCount = seed % maxUseCount;

            // Clean up before each iteration
            if (fs.existsSync(TOPICS_PATH)) {
              fs.unlinkSync(TOPICS_PATH);
            }

            // Create a topic with the given maxUseCount
            const topic = createTopic({
              title: `属性测试主题-${maxUseCount}-${startCount}`,
              direction: '测试方向',
              maxUseCount,
            });

            // Increment useCount to reach startCount
            for (let i = 0; i < startCount; i++) {
              incrementUseCount(topic.id, {
                title: `历史帖子${i}`,
                contentSnippet: `历史内容${i}`,
                timestamp: new Date().toISOString(),
              });
            }

            // Verify useCount is at startCount before the final increment
            const before = getAllTopics().find(t => t.id === topic.id);
            expect(before!.useCount).toBe(startCount);

            // Call incrementUseCount one more time
            const result = incrementUseCount(topic.id, {
              title: '新帖子',
              contentSnippet: '新内容摘要',
              timestamp: new Date().toISOString(),
            });

            // Verify: result.useCount === startCount + 1
            expect(result).not.toBeNull();
            expect(result!.useCount).toBe(startCount + 1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
