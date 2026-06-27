/**
 * 任务缓存存储测试
 */

import { taskCacheStorage } from '../../src/storage/redis/task-cache-storage';
import { AsyncTask } from '../../src/types/api-remote-post';

describe('TaskCacheStorage', () => {
  const testTaskId = 'test-task-001';
  const testTask: AsyncTask = {
    taskId: testTaskId,
    taskType: 'post',
    status: 'pending',
    content: '测试内容',
    images: [],
    platform: 'xiaohongshu',
    createdAt: Date.now(),
  };

  beforeAll(async () => {
    const { initializeRedisStorage } = await import('../../src/storage/redis/init');
    try {
      await initializeRedisStorage();
    } catch (error) {
      console.warn('Redis 不可用，将使用降级模式');
    }
  });

  beforeEach(async () => {
    await taskCacheStorage.deleteTask(testTaskId);
  });

  describe('saveTask() / getTask()', () => {
    it('应该保存和获取任务', async () => {
      await taskCacheStorage.saveTask(testTaskId, testTask);
      const task = await taskCacheStorage.getTask(testTaskId);
      
      expect(task).toBeDefined();
      expect(task?.taskId).toBe(testTaskId);
      expect(task?.content).toBe(testTask.content);
    });

    it('应该返回 null 如果任务不存在', async () => {
      const task = await taskCacheStorage.getTask('non-existent-task');
      expect(task).toBeNull();
    });
  });

  describe('updateTaskStatus()', () => {
    it('应该更新任务状态', async () => {
      await taskCacheStorage.saveTask(testTaskId, testTask);
      await taskCacheStorage.updateTaskStatus(testTaskId, 'processing');
      
      const task = await taskCacheStorage.getTask(testTaskId);
      expect(task?.status).toBe('processing');
    });
  });

  describe('deleteTask()', () => {
    it('应该删除任务', async () => {
      await taskCacheStorage.saveTask(testTaskId, testTask);
      await taskCacheStorage.deleteTask(testTaskId);
      
      const task = await taskCacheStorage.getTask(testTaskId);
      expect(task).toBeNull();
    });
  });

  describe('hasTask()', () => {
    it('应该检查任务是否存在', async () => {
      await taskCacheStorage.saveTask(testTaskId, testTask);
      const hasTask = await taskCacheStorage.hasTask(testTaskId);
      expect(hasTask).toBe(true);
    });

    it('应该返回 false 如果任务不存在', async () => {
      const hasTask = await taskCacheStorage.hasTask('non-existent-task');
      expect(hasTask).toBe(false);
    });
  });

  describe('TTL 自动过期', () => {
    it('应该设置 30 分钟 TTL', async () => {
      await taskCacheStorage.saveTask(testTaskId, testTask);
      
      const { getRedisClient, formatKey } = await import('../../src/utils/redis-connection-manager');
      const client = getRedisClient();
      const key = formatKey(`task:${testTaskId}`);
      const ttl = await client.ttl(key);
      
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1800); // 30 分钟 = 1800 秒
    });
  });

  describe('降级策略', () => {
    it('应该在 Redis 不可用时降级到内存存储', async () => {
      taskCacheStorage['useRedis'] = false;
      
      await taskCacheStorage.saveTask(testTaskId, testTask);
      const task = await taskCacheStorage.getTask(testTaskId);
      
      expect(task).toBeDefined();
      expect(task?.taskId).toBe(testTaskId);
      
      taskCacheStorage.resetToRedis();
    });
  });
});
