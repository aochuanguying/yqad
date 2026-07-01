/**
 * 发帖失败重试服务
 * 
 * 功能：
 * 1. 自动重试失败的发帖请求
 * 2. 指数退避策略
 * 3. 最大重试次数限制
 * 4. 重试队列管理
 */

import { getLogger } from '../utils/logger';
import { postLoggingService } from './post-logging-service';
import { RedisConnectionManager } from '../utils/redis-connection-manager';

const logger = getLogger('post-retry-service');

/**
 * 重试任务
 */
export interface RetryTask {
  id: string;
  postId?: string;
  title: string;
  content: string;
  imageUrls?: string[];
  topicId?: string;
  mode: string;
  failedReason: string;
  retryCount: number;
  maxRetries: number;
  nextRetryTime: number;
  createdAt: number;
  lastFailedAt: number;
}

/**
 * 发帖失败重试服务类
 */
class PostRetryService {
  private redisClient = RedisConnectionManager.getInstance();
  private readonly RETRY_QUEUE_KEY = 'post:retry:queue';
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 60000; // 1 分钟基础延迟

  /**
   * 添加重试任务到队列
   */
  async addRetryTask(task: Omit<RetryTask, 'retryCount' | 'nextRetryTime' | 'maxRetries' | 'createdAt' | 'lastFailedAt'>): Promise<string> {
    const retryTask: RetryTask = {
      ...task,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      nextRetryTime: Date.now() + this.BASE_DELAY_MS,
      createdAt: Date.now(),
      lastFailedAt: Date.now(),
    };

    try {
      const redis = this.redisClient.getClient();
      // 添加到 Redis 有序集合（按下次重试时间排序）
      await redis.zAdd(
        this.RETRY_QUEUE_KEY,
        { score: retryTask.nextRetryTime, value: JSON.stringify(retryTask) }
      );

      logger.info(`添加重试任务到队列：${retryTask.id}, 下次重试时间：${new Date(retryTask.nextRetryTime).toISOString()}`);
      return retryTask.id;
    } catch (error) {
      logger.error(`添加重试任务失败：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 获取可重试的任务
   */
  async getRetryableTasks(limit: number = 10): Promise<RetryTask[]> {
    try {
      const now = Date.now();
      const redis = this.redisClient.getClient();
      
      // 获取所有到期需要重试的任务
      const tasks = await redis.zRangeByScore(
        this.RETRY_QUEUE_KEY,
        0,
        now
      );
      
      // 手动限制数量
      const limitedTasks = tasks.slice(0, limit);

      const retryTasks: RetryTask[] = limitedTasks.map((taskStr: string) => JSON.parse(taskStr));
      
      if (retryTasks.length > 0) {
        logger.info(`获取到 ${retryTasks.length} 个可重试任务`);
      }

      return retryTasks;
    } catch (error) {
      logger.error(`获取重试任务失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 更新重试任务
   */
  async updateRetryTask(task: RetryTask, success: boolean): Promise<void> {
    try {
      const redis = this.redisClient.getClient();
      
      if (success) {
        // 成功则从队列中移除
        await this.removeRetryTask(task.id);
        logger.info(`重试任务成功，已从队列移除：${task.id}`);
      } else {
        // 失败则增加重试次数，计算下次重试时间
        task.retryCount++;
        
        if (task.retryCount >= task.maxRetries) {
          // 超过最大重试次数，从队列移除并记录失败
          await this.removeRetryTask(task.id);
          await this.recordFinalFailure(task);
          logger.warn(`重试任务达到最大次数，标记为最终失败：${task.id}`);
        } else {
          // 指数退避：delay = baseDelay * 2^(retryCount-1)
          const delay = this.BASE_DELAY_MS * Math.pow(2, task.retryCount - 1);
          task.nextRetryTime = Date.now() + delay;
          task.lastFailedAt = Date.now();

          // 更新队列中的任务
          await this.removeRetryTask(task.id);
          await redis.zAdd(
            this.RETRY_QUEUE_KEY,
            { score: task.nextRetryTime, value: JSON.stringify(task) }
          );

          logger.info(`更新重试任务：${task.id}, 重试次数：${task.retryCount}/${task.maxRetries}, 下次重试：${new Date(task.nextRetryTime).toISOString()}`);
        }
      }
    } catch (error) {
      logger.error(`更新重试任务失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 移除重试任务
   */
  private async removeRetryTask(taskId: string): Promise<void> {
    try {
      const redis = this.redisClient.getClient();
      // 先获取所有成员，找到要删除的那个
      const allTasks = await redis.zRange(this.RETRY_QUEUE_KEY, 0, -1);
      
      for (const taskStr of allTasks) {
        const task = JSON.parse(taskStr);
        if (task.id === taskId) {
          await redis.zRem(this.RETRY_QUEUE_KEY, taskStr);
          break;
        }
      }
    } catch (error) {
      logger.error(`移除重试任务失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 记录最终失败
   */
  private async recordFinalFailure(task: RetryTask): Promise<void> {
    try {
      await postLoggingService.log({
        timestamp: Date.now(),
        triggerType: 'auto',
        postType: task.topicId ? 'topic' : 'free',
        mode: task.mode as any,
        topicId: task.topicId,
        title: task.title,
        content: task.content,
        imageUrls: task.imageUrls || [],
        status: 'failed',
        errorMessage: `重试${task.maxRetries}次后仍然失败：${task.failedReason}`,
        taskId: task.id,
      });

      logger.error(`记录最终失败日志：${task.id}`);
    } catch (error) {
      logger.error(`记录最终失败日志失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<{
    totalTasks: number;
    retryableNow: number;
    scheduledLater: number;
  }> {
    try {
      const now = Date.now();
      const redis = this.redisClient.getClient();
      const allTasks = await redis.zRangeWithScores(this.RETRY_QUEUE_KEY, 0, -1);
      
      let retryableNow = 0;
      let scheduledLater = 0;

      for (const { value, score } of allTasks) {
        if (score <= now) {
          retryableNow++;
        } else {
          scheduledLater++;
        }
      }

      return {
        totalTasks: allTasks.length,
        retryableNow,
        scheduledLater,
      };
    } catch (error) {
      logger.error(`获取队列统计失败：${error instanceof Error ? error.message : String(error)}`);
      return { totalTasks: 0, retryableNow: 0, scheduledLater: 0 };
    }
  }

  /**
   * 清空重试队列（用于测试）
   */
  async clearQueue(): Promise<void> {
    try {
      const redis = this.redisClient.getClient();
      await redis.del(this.RETRY_QUEUE_KEY);
      logger.info('重试队列已清空');
    } catch (error) {
      logger.error(`清空重试队列失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 启动定时重试任务检查
   */
  startPeriodicCheck(intervalMs: number = 30000): NodeJS.Timeout {
    logger.info(`启动定时重试检查，间隔：${intervalMs}ms`);
    
    return setInterval(async () => {
      try {
        const tasks = await this.getRetryableTasks(5);
        
        if (tasks.length > 0) {
          logger.info(`发现 ${tasks.length} 个待重试任务`);
          // 这里可以触发重试逻辑
          // 实际重试需要在 auto-post-service 中实现
        }
      } catch (error) {
        logger.error(`定时重试���查失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }, intervalMs);
  }
}

// 导出单例
export const postRetryService = new PostRetryService();
