/**
 * 主题可用次数存储测试
 */

import { topicUsesStorage } from '../../src/storage/redis/topic-uses-storage';

describe('TopicUsesStorage', () => {
  const testTopicId = 'test-topic-001';

  beforeAll(async () => {
    // 初始化 Redis 连接
    const { initializeRedisStorage } = await import('../../src/storage/redis/init');
    try {
      await initializeRedisStorage();
    } catch (error) {
      console.warn('Redis 不可用，将使用降级模式');
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await topicUsesStorage.deleteUses(testTopicId);
  });

  describe('setUses() / getUses()', () => {
    it('应该设置和获取主题可用次数', async () => {
      await topicUsesStorage.setUses(testTopicId, 5);
      const uses = await topicUsesStorage.getUses(testTopicId);
      expect(uses).toBe(5);
    });

    it('应该返回 0 如果主题不存在', async () => {
      const uses = await topicUsesStorage.getUses('non-existent-topic');
      expect(uses).toBe(0);
    });
  });

  describe('incrementUses()', () => {
    it('应该递增主题可用次数', async () => {
      await topicUsesStorage.setUses(testTopicId, 3);
      const newValue = await topicUsesStorage.incrementUses(testTopicId, 2);
      expect(newValue).toBe(5);
      
      const uses = await topicUsesStorage.getUses(testTopicId);
      expect(uses).toBe(5);
    });
  });

  describe('decrementUses()', () => {
    it('应该递减主题可用次数', async () => {
      await topicUsesStorage.setUses(testTopicId, 5);
      const newValue = await topicUsesStorage.decrementUses(testTopicId, 2);
      expect(newValue).toBe(3);
    });

    it('应该确保不会减到负数', async () => {
      await topicUsesStorage.setUses(testTopicId, 1);
      const newValue = await topicUsesStorage.decrementUses(testTopicId, 5);
      expect(newValue).toBe(0);
    });
  });

  describe('hasUses()', () => {
    it('应该检查主题是否有可用次数', async () => {
      await topicUsesStorage.setUses(testTopicId, 1);
      const hasUses = await topicUsesStorage.hasUses(testTopicId);
      expect(hasUses).toBe(true);
    });

    it('应该返回 false 如果次数为 0', async () => {
      await topicUsesStorage.setUses(testTopicId, 0);
      const hasUses = await topicUsesStorage.hasUses(testTopicId);
      expect(hasUses).toBe(false);
    });
  });

  describe('deleteUses()', () => {
    it('应该删除主题可用次数', async () => {
      await topicUsesStorage.setUses(testTopicId, 5);
      await topicUsesStorage.deleteUses(testTopicId);
      const uses = await topicUsesStorage.getUses(testTopicId);
      expect(uses).toBe(0);
    });
  });

  describe('降级策略', () => {
    it('应该在 Redis 不可用时降级到内存存储', async () => {
      // 模拟 Redis 不可用
      topicUsesStorage['useRedis'] = false;
      
      await topicUsesStorage.setUses(testTopicId, 10);
      const uses = await topicUsesStorage.getUses(testTopicId);
      expect(uses).toBe(10);
      
      // 恢复 Redis 模式
      topicUsesStorage.resetToRedis();
    });
  });
});
