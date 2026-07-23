import * as cron from 'node-cron';
import { resetConfigCache } from '../utils/config';
import { getLogger } from '../utils/logger';
import { sleep, randomDelay } from '../utils/retry';
import { configEvents, ConfigChangeEvent } from '../web/services/config-events';
import { runVehicleMonitor } from '../services/vehicle-monitor-service';
import { getSchedulerConfigStorage, SchedulerConfig } from '../storage/mysql/scheduler-config-storage';

const logger = getLogger('scheduler');

export type TaskHandler = () => Promise<void>;

interface ScheduledTask {
  name: string;
  cronExpression: string;
  randomOffsetMin: number; // 分钟
  randomOffsetMax: number; // 分钟
  handler: TaskHandler;
  job?: cron.ScheduledTask;
  lastRun?: string; // ISO date string (YYYY-MM-DD)
}

export class Scheduler {
  private tasks: ScheduledTask[] = [];
  private configChangeHandler: ((event: ConfigChangeEvent) => void) | null = null;
  private materialInterval: NodeJS.Timeout | null = null; // 素材整理间隔定时器
  private materialRunning = false; // 素材整理任务运行标志
  private vehicleMonitorInterval: NodeJS.Timeout | null = null; // 车辆监控间隔定时器

  /**
   * 注册定时任务
   */
  registerTask(
    name: string,
    cronExpression: string,
    randomOffsetMin: number,
    randomOffsetMax: number,
    handler: TaskHandler
  ): void {
    this.tasks.push({
      name,
      cronExpression,
      randomOffsetMin,
      randomOffsetMax,
      handler,
    });
  }

  /**
   * 启动所有已注册的定时任务
   */
  start(): void {
    for (const task of this.tasks) {
      task.job = cron.schedule(task.cronExpression, async () => {
        await this.executeWithRandomOffset(task);
      });
      logger.info(`已调度任务 "${task.name}" (${task.cronExpression}, 偏移 ${task.randomOffsetMin}-${task.randomOffsetMax}分钟)`);
    }
    logger.info(`调度器已启动，共 ${this.tasks.length} 个任务`);

    // 订阅配置变更事件
    this.configChangeHandler = (event: ConfigChangeEvent) => {
      if (event.group === 'scheduler') {
        this.handleSchedulerConfigChange(event.newConfig);
      }
    };
    configEvents.onConfigChanged(this.configChangeHandler);
  }

  /**
   * 停止所有任务
   */
  stop(): void {
    for (const task of this.tasks) {
      task.job?.stop();
    }
    // 清除素材整理间隔定时器
    if (this.materialInterval) {
      clearInterval(this.materialInterval);
      this.materialInterval = null;
      logger.info('素材整理间隔定时器已清除');
    }
    // 清除车辆监控间隔定时器
    if (this.vehicleMonitorInterval) {
      clearInterval(this.vehicleMonitorInterval);
      this.vehicleMonitorInterval = null;
      logger.info('车辆监控间隔定时器已清除');
    }
    // 取消事件订阅
    if (this.configChangeHandler) {
      configEvents.offConfigChanged(this.configChangeHandler);
      this.configChangeHandler = null;
    }
    logger.info('调度器已停止');
  }

  /**
   * 获取素材整理运行状态
   */
  getMaterialRunning(): boolean {
    return this.materialRunning;
  }

  /**
   * 设置素材整理运行状态
   */
  setMaterialRunning(running: boolean): void {
    this.materialRunning = running;
  }

  /**
   * 设置素材整理间隔定时器
   */
  setMaterialInterval(interval: NodeJS.Timeout): void {
    this.materialInterval = interval;
  }

  /**
   * 设置车辆监控间隔定时器
   */
  setVehicleMonitorInterval(interval: NodeJS.Timeout): void {
    this.vehicleMonitorInterval = interval;
  }

  /**
   * 处理调度配置热重载
   * 取消旧任务，使用新配置重新注册，保留当天已执行记录
   */
  private handleSchedulerConfigChange(newSchedulerConfig: Record<string, any>): void {
    logger.info('检测到调度配置变更，重新调度任务...');

    try {
      // 保存当天已执行记录
      const executionRecords = new Map<string, string | undefined>();
      for (const task of this.tasks) {
        executionRecords.set(task.name, task.lastRun);
      }

      // 停止所有现有 cron 任务
      for (const task of this.tasks) {
        task.job?.stop();
      }

      // 任务名称到配置键的映射（发帖任务已移除，仅保留评论和素材）
      const taskConfigMap: Record<string, string> = {
        '自动评论': 'comment',
        '素材梳理': 'materialProcessing',
      };

      // 使用新配置重新注册
      for (const task of this.tasks) {
        const configKey = taskConfigMap[task.name];
        if (configKey && newSchedulerConfig[configKey]) {
          const taskConfig = newSchedulerConfig[configKey];
          task.cronExpression = taskConfig.cron;
          task.randomOffsetMin = taskConfig.randomOffsetMin;
          task.randomOffsetMax = taskConfig.randomOffsetMax;
        }

        // 恢复执行记录
        task.lastRun = executionRecords.get(task.name);

        // 重新创建 cron 任务
        task.job = cron.schedule(task.cronExpression, async () => {
          await this.executeWithRandomOffset(task);
        });
        logger.info(`已重新调度任务 "${task.name}" (${task.cronExpression}, 偏移 ${task.randomOffsetMin}-${task.randomOffsetMax}分钟)`);
      }

      logger.info('调度器热重载完成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`调度器热重载失败: ${errorMsg}`);
      throw error; // 让 config-service 处理回滚
    }
  }

  /**
   * 检查并执行今天遗漏的任务
   */
  async checkMissedTasks(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    logger.info('检查今日遗漏任务...');

    for (const task of this.tasks) {
      if (task.lastRun !== today) {
        // 检查当前时间是否已过任务的调度时间
        if (this.isTaskOverdue(task)) {
          // 特殊处理：评论任务需要检查今日是否已超过限制
          if (task.name === '自动评论') {
            const shouldExecute = await this.shouldExecuteCommentTask();
            if (!shouldExecute) {
              logger.info('今日评论次数已达上限，跳过补偿执行');
              task.lastRun = today; // 标记为已执行，避免下次重启再次检查
              continue;
            }
          }
          
          logger.info(`发现遗漏任务: "${task.name}"，立即执行`);
          await this.executeTask(task);
        }
      }
    }
  }

  /**
   * 检查是否应该执行评论任务（检查今日评论次数是否超过限制）
   */
  private async shouldExecuteCommentTask(): Promise<boolean> {
    try {
      const { getCommentLogStorage } = await import('../storage/mysql/comment-log-storage');
      const commentLogStorage = getCommentLogStorage();
      
      // 获取今日评论次数
      const today = new Date().toISOString().split('T')[0];
      const todayCount = await commentLogStorage.getTodayCommentCount();
      
      // 获取评论配置中的每日限制
      const { getCommentConfigStorage } = await import('../storage/mysql/comment-config-storage');
      const commentConfig = await getCommentConfigStorage().getConfig();
      const dailyLimit = commentConfig?.dailyLimit || 3; // 默认 3 条
      
      logger.info(`今日已评论 ${todayCount} 条，限制 ${dailyLimit} 条`);
      
      if (todayCount >= dailyLimit) {
        logger.warn(`今日评论次数已达上限 (${todayCount}/${dailyLimit})，跳过补偿执行`);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`检查评论限制失败：${error instanceof Error ? error.message : String(error)}`);
      // 如果检查失败，保守处理：不执行补偿
      return false;
    }
  }

  /**
   * 带随机偏移执行任务
   */
  private async executeWithRandomOffset(task: ScheduledTask): Promise<void> {
    const minMs = (task.randomOffsetMin || 0) * 60 * 1000;
    const maxMs = (task.randomOffsetMax || 0) * 60 * 1000;
    const offsetMs = randomDelay(minMs, maxMs);

    if (offsetMs > 0 && !isNaN(offsetMs)) {
      logger.info(`任务 "${task.name}" 将在 ${Math.round(offsetMs / 60000)} 分钟后执行`);
      await sleep(offsetMs);
    }
    await this.executeTask(task);
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    logger.info(`开始执行任务: "${task.name}"`);

    try {
      await task.handler();
      task.lastRun = today;
      logger.info(`任务 "${task.name}" 执行完成`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`任务 "${task.name}" 执行失败: ${errorMsg}`);
    }
  }

  /**
   * 解析 cron 字段中的单个值，支持：
   * - 具体数字: "8"
   * - 通配符: "*"
   * - 步进: "* /5"（每 N 分钟/小时）
   * - 列表: "1,2,3"
   * - 范围: "1-5"
   * 返回该字段可能的最小值，无法解析时返回 null
   */
  private parseCronField(field: string, min: number, max: number): number | null {
    if (field === '*') return min;
    // 步进: */N
    const stepMatch = field.match(/^\*\/(\d+)$/);
    if (stepMatch) return min;
    // 列表: a,b,c
    if (field.includes(',')) {
      const values = field.split(',').map(v => parseInt(v, 10)).filter(v => !isNaN(v));
      return values.length > 0 ? Math.min(...values) : null;
    }
    // 范围: a-b
    if (field.includes('-')) {
      const [start] = field.split('-').map(v => parseInt(v, 10));
      return isNaN(start) ? null : start;
    }
    // 具体数字
    const num = parseInt(field, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * 判断任务是否已过期（当前时间已超过cron调度时间）
   */
  private isTaskOverdue(task: ScheduledTask): boolean {
    const parts = task.cronExpression.trim().split(/\s+/);
    if (parts.length < 5) return false;

    const minute = this.parseCronField(parts[0], 0, 59);
    const hour = this.parseCronField(parts[1], 0, 23);

    if (minute === null || hour === null) return false;

    const now = new Date();
    const scheduledMinutes = hour * 60 + minute;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 加上最大偏移后的时间也已过去
    return currentMinutes > scheduledMinutes + task.randomOffsetMax;
  }
}

/**
 * 创建并配置调度器
 */
export async function createScheduler(handlers: {
  comment: TaskHandler;
  materialProcessing: TaskHandler;
  refreshXiaohongshuCookie?: TaskHandler;
  refreshZhihuCookie?: TaskHandler;
}): Promise<Scheduler> {
  const schedulerConfig = await getSchedulerConfigStorage().getConfig();
  
  const scheduler = new Scheduler();
  const mpCfg = schedulerConfig?.materialProcessing;
  
  // 检查是否使用间隔模式（新配置）
  const useIntervalMode = mpCfg && typeof mpCfg.intervalMinutes === 'number';

  const commentCfg = schedulerConfig?.comment;
  if (commentCfg) {
    scheduler.registerTask(
      '自动评论',
      commentCfg.cron,
      commentCfg.randomOffsetMin,
      commentCfg.randomOffsetMax,
      handlers.comment
    );
  }

  // 发帖任务已移除：所有发帖动作由外部 autojs 脚本通过 API 触发
  logger.info('发帖模式：API 触发（定时发帖任务已移除）');

  // 素材整理任务：使用间隔模式或传统 Cron 模式
  if (useIntervalMode && mpCfg.enabled !== false) {
    // 间隔模式：启动时立即执行一次，然后按间隔执行
    logger.info(`素材整理使用间隔模式：每隔 ${mpCfg.intervalMinutes} 分钟执行一次`);
    
    // 启动时立即执行
    (async () => {
      logger.info('素材整理：启动时立即执行');
      if (!scheduler.getMaterialRunning()) {
        scheduler.setMaterialRunning(true);
        try {
          await handlers.materialProcessing();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`素材整理启动执行失败：${errorMsg}`);
        } finally {
          scheduler.setMaterialRunning(false);
        }
      } else {
        logger.warn('素材整理：任务正在运行，跳过启动时执行');
      }
    })();
    
    // 设置间隔定时器
    const intervalMs = mpCfg.intervalMinutes * 60 * 1000;
    scheduler.setMaterialInterval(setInterval(async () => {
      if (!scheduler.getMaterialRunning()) {
        scheduler.setMaterialRunning(true);
        logger.info(`素材整理：间隔执行（每隔 ${mpCfg.intervalMinutes} 分钟）`);
        try {
          await handlers.materialProcessing();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`素材整理间隔执行失败：${errorMsg}`);
        } finally {
          scheduler.setMaterialRunning(false);
        }
      } else {
        logger.warn('素材整理：任务正在运行，跳过本次执行');
      }
    }, intervalMs));
  } else {
    // 传统 Cron 模式（向后兼容）
    const mpCfgLegacy = mpCfg || { cron: '0 7 * * *', randomOffsetMin: 0, randomOffsetMax: 30 } as any;
    scheduler.registerTask(
      '素材梳理',
      mpCfgLegacy.cron,
      mpCfgLegacy.randomOffsetMin,
      mpCfgLegacy.randomOffsetMax,
      handlers.materialProcessing
    );
  }

  // 车辆监控任务：使用间隔模式（从数据库读取）
  const { vehicleMonitorStorage } = await import('../storage/mysql/vehicle-monitor-storage');
  const vehicleMonitorCfg = await vehicleMonitorStorage.getConfig().catch(() => null);
  if (vehicleMonitorCfg && vehicleMonitorCfg.enabled !== false && typeof vehicleMonitorCfg.intervalMinutes === 'number') {
    logger.info(`车辆监控使用间隔模式：每隔 ${vehicleMonitorCfg.intervalMinutes} 分钟执行一次`);
    
    // 启动时立即执行一次（可选）
    (async () => {
      logger.info('车辆监控：启动时立即执行');
      try {
        await runVehicleMonitor();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`车辆监控启动执行失败：${errorMsg}`);
      }
    })();
    
    // 设置间隔定时器（保存到 vehicleMonitorInterval，确保 stop() 时能清理）
    const intervalMs = vehicleMonitorCfg.intervalMinutes * 60 * 1000;
    scheduler.setVehicleMonitorInterval(setInterval(async () => {
      logger.info(`车辆监控：间隔执行（每隔 ${vehicleMonitorCfg.intervalMinutes} 分钟）`);
      try {
        await runVehicleMonitor();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`车辆监控间隔执行失败：${errorMsg}`);
      }
    }, intervalMs));
  } else {
    logger.info('车辆监控：未启用或配置不完整');
  }

  // Cookie 刷新任务：小红书和知乎（从数据库读取配置）
  const cookieSchedulerCfg = schedulerConfig?.cookieRefresh;
  if (cookieSchedulerCfg && cookieSchedulerCfg.enabled !== false) {
    logger.info(`Cookie 刷新使用 Cron 模式：${cookieSchedulerCfg.cron}`);
    
    // 注册小红书 Cookie 刷新
    if (handlers.refreshXiaohongshuCookie) {
      scheduler.registerTask(
        '小红书 Cookie 刷新',
        cookieSchedulerCfg.cron,
        cookieSchedulerCfg.randomOffsetMin || 0,
        cookieSchedulerCfg.randomOffsetMax || 30,
        handlers.refreshXiaohongshuCookie
      );
      logger.info('已注册小红书 Cookie 自动刷新任务');
    } else {
      logger.warn('未提供小红书 Cookie 刷新 handler，跳过注册');
    }
    
    // 注册知乎 Cookie 刷新
    if (handlers.refreshZhihuCookie) {
      scheduler.registerTask(
        '知乎 Cookie 刷新',
        cookieSchedulerCfg.cron,
        cookieSchedulerCfg.randomOffsetMin || 0,
        cookieSchedulerCfg.randomOffsetMax || 30,
        handlers.refreshZhihuCookie
      );
      logger.info('已注册知乎 Cookie 自动刷新任务');
    } else {
      logger.warn('未提供知乎 Cookie 刷新 handler，跳过注册');
    }
  } else {
    logger.info('Cookie 自动刷新：未启用');
  }

  return scheduler;
}
