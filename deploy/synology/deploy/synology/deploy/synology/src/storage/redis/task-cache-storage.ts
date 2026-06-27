import { getRedisClient, formatKey } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';
import { AsyncTask } from '../../types/api-remote-post';

const logger = getLogger('task-cache-storage');

/**
 * 任务缓存存储
 * 
 * 使用 Redis Hash 存储任务缓存
 * Key 格式：{prefix}task:{task_id}
 * TTL: 30 分钟
 */
export class TaskCacheStorage {
  private useRedis: boolean = true;
  private memoryStore: Map<string, AsyncTask> = new Map();
  private readonly TTL_SECONDS = 30 * 60; // 30 分钟

  /**
   * 保存任务
   */
  async saveTask(taskId: string, task: AsyncTask): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`task:${taskId}`);
        
        // 将任务序列化为 Hash 字段
        await client.hSet(key, {
          id: task.id,
          status: task.status,
          request: JSON.stringify(task.request),
          results: JSON.stringify(task.results),
          error: task.error || '',
          created_at: task.createdAt.toString(),
          completed_at: task.completedAt?.toString() || '',
          progress_total: task.progress.total.toString(),
          progress_completed: task.progress.completed.toString(),
        });
        
        // 设置 30 分钟过期
        await client.expire(key, this.TTL_SECONDS);
        
        logger.debug(`保存任务缓存：${taskId}`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryStore.set(taskId, task);
    logger.debug(`[内存] 保存任务缓存：${taskId}`);
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string): Promise<AsyncTask | null> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`task:${taskId}`);
        
        const data = await client.hGetAll(key);
        
        if (!data || Object.keys(data).length === 0) {
          return null;
        }
        
        // 反序列化为 AsyncTask
        const task: AsyncTask = {
          id: data.id,
          status: data.status as any,
          request: JSON.parse(data.request || '{}'),
          results: JSON.parse(data.results || '[]'),
          error: data.error || undefined,
          createdAt: parseInt(data.created_at, 10),
          completedAt: data.completed_at ? parseInt(data.completed_at, 10) : undefined,
          progress: {
            total: parseInt(data.progress_total, 10) || 0,
            completed: parseInt(data.progress_completed, 10) || 0,
          },
        };
        
        return task;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return this.memoryStore.get(taskId) || null;
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`task:${taskId}`);
        await client.hSet(key, 'status', status);
        logger.debug(`更新任务 ${taskId} 状态为${status}`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    const task = this.memoryStore.get(taskId);
    if (task) {
      task.status = status as any;
      this.memoryStore.set(taskId, task);
      logger.debug(`[内存] 更新任务 ${taskId} 状态：${status}`);
    }
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`task:${taskId}`);
        await client.del(key);
        logger.debug(`删除任务缓存：${taskId}`);
        return;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    this.memoryStore.delete(taskId);
    logger.debug(`[内存] 删除任务缓存：${taskId}`);
  }

  /**
   * 检查任务是否存在
   */
  async hasTask(taskId: string): Promise<boolean> {
    try {
      if (this.useRedis) {
        const client = getRedisClient();
        const key = formatKey(`task:${taskId}`);
        const exists = await client.exists(key);
        return exists === 1;
      }
    } catch (error) {
      logger.warn('Redis 不可用，降级到内存存储:', error);
      this.useRedis = false;
    }

    // 降级到内存存储
    return this.memoryStore.has(taskId);
  }

  /**
   * 重置为 Redis 模式
   */
  resetToRedis(): void {
    this.useRedis = true;
    logger.info('已重置为 Redis 存储模式');
  }
}

// 导出单例
export const taskCacheStorage = new TaskCacheStorage();
