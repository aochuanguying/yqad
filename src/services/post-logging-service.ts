import { getLogger } from '../utils/logger';
import { 
  PostLog, 
  LogQueryParams, 
  LogQueryResponse, 
  TriggerType, 
  PostType,
  PipelineTimings,
  ResourceUsage,
  ContextSnapshot,
  RetryRecord
} from '../types/post-logging';
import { getPostLogStorage, CreatePostLogInput } from '../storage/mysql/post-log-storage';
import { SensitiveDataSanitizer } from '../utils/post-log-utils';

const logger = getLogger('post-logging-service');

/**
 * 发帖日志服务
 * 负责日志记录、查询、持久化、定期清理
 */
export class PostLoggingService {
  private static instance: PostLoggingService;
  private postLogStorage = getPostLogStorage();
  private readonly maxAgeDays: number = 30;  // 最多保留 30 天
  private cleanupTimerId?: NodeJS.Timeout;  // 保存定时器 ID

  private constructor() {
    this.startCleanupTimer();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): PostLoggingService {
    if (!PostLoggingService.instance) {
      PostLoggingService.instance = new PostLoggingService();
    }
    return PostLoggingService.instance;
  }

  /**
   * 停止清理定时器（用于服务关闭）
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimerId) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = undefined;
      logger.info('已停止发帖日志清理定时器');
    }
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    // 每 10 分钟清理一次过期记录
    this.cleanupTimerId = setInterval(() => {
      this.cleanupExpired().catch((error) => {
        logger.error(`定时清理发帖日志异常：${error.message}`, { error });
      });
    }, 10 * 60 * 1000);
    
    logger.info('已启动发帖日志清理定时器（每 10 分钟执行一次）');
  }

  /**
   * 清理过期记录
   */
  private async cleanupExpired(): Promise<void> {
    const startTime = Date.now();
    try {
      logger.debug(`开始清理过期发帖日志（保留${this.maxAgeDays}天）`);
      const cleaned = await this.postLogStorage.deleteExpiredLogs(this.maxAgeDays);
      const duration = Date.now() - startTime;
      
      if (cleaned > 0) {
        logger.info(`清理 ${cleaned} 条过期发帖日志记录，耗时 ${duration}ms`);
      } else {
        logger.debug(`无过期发帖日志记录需要清理，耗时 ${duration}ms`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`清理过期发帖日志失败，耗时 ${duration}ms: ${error.message}`, {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
        },
      });
    }
  }

  /**
   * 记录发帖日志（支持性能指标和调试信息）
   * @param log 日志记录（不包含 id 和 createdAt）
   * @returns 创建的日志记录
   */
  async log(log: Omit<PostLog, 'id' | 'createdAt'>): Promise<PostLog> {
    // 敏感信息脱敏
    const sanitizedErrorStack = log.errorStack ? SensitiveDataSanitizer.sanitizeErrorStack(log.errorStack) : undefined;
    const sanitizedContextSnapshot = log.contextSnapshot ? SensitiveDataSanitizer.sanitizeContextSnapshot(log.contextSnapshot) : undefined;
    
    // 转换为 MySQL 存储格式
    const input: CreatePostLogInput = {
      post_id: (log as any).postId,
      task_id: log.taskId,  // AutoJS 任务 ID
      title: log.title,
      topic_id: log.topicId,
      topic_name: log.topicName,
      content: log.content,
      image_urls: log.imageUrls,
      status: log.status,
      error_message: log.errorMessage,
      mode: log.mode,
      trigger_type: log.triggerType,
      compliance_report_id: (log as any).complianceReportId,
      // === 新增：性能指标字段 ===
      pipeline_timings: log.pipelineTimings,
      total_duration: log.totalDuration,
      resource_usage: log.resourceUsage,
      // === 新增：调试信息字段 ===
      error_stack: sanitizedErrorStack,
      context_snapshot: sanitizedContextSnapshot,
      retry_history: log.retryHistory,
    };

    const newLog = await this.postLogStorage.createPostLog(input);
    
    logger.debug(`记录发帖日志：${newLog.id} (${newLog.title}, ${newLog.trigger_type}, ${log.postType})`);
    
    // 转换为 PostLog 格式返回
    return {
      id: newLog.id,
      title: newLog.title,
      topicId: newLog.topic_id,
      topicName: newLog.topic_name,
      content: newLog.content || '',
      imageUrls: Array.isArray(newLog.image_urls) ? newLog.image_urls : [],
      timestamp: newLog.created_at.getTime(),
      status: newLog.status,
      errorMessage: newLog.error_message,
      mode: newLog.mode,
      triggerType: newLog.trigger_type,
      postType: log.postType,
      createdAt: newLog.created_at.getTime(),
      // === 返回新增字段 ===
      pipelineTimings: (newLog.pipeline_timings as any) || log.pipelineTimings,
      totalDuration: newLog.total_duration || log.totalDuration,
      resourceUsage: (newLog.resource_usage as any) || log.resourceUsage,
      errorStack: newLog.error_stack || log.errorStack,
      contextSnapshot: (newLog.context_snapshot as any) || log.contextSnapshot,
      retryHistory: (newLog.retry_history as any) || log.retryHistory,
    };
  }

  /**
   * 查询日志列表（分页，支持性能指标筛选）
   * @param params 查询参数
   * @returns 查询结果
   */
  async query(params: LogQueryParams & { minDuration?: number; maxDuration?: number } = {}): Promise<LogQueryResponse> {
    const {
      page = 1,
      limit = 20,
      triggerType,
      postType,
      startDate,
      endDate,
      minDuration,
      maxDuration
    } = params;

    // 转换为 MySQL 查询选项
    const options = {
      page,
      pageSize: limit,
      triggerType: triggerType && triggerType !== 'all' ? triggerType : undefined,
      status: undefined,
      mode: undefined,
      postId: undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      minDuration,
      maxDuration,
    };

    const result = await this.postLogStorage.queryPostLogs(options);

    // 转换为 PostLog 格式
    const logs: PostLog[] = result.data.map(log => ({
      id: log.id,
      postId: log.post_id || undefined,
      title: log.title,
      topicId: log.topic_id || undefined,
      topicName: log.topic_name || undefined,
      content: log.content || '',
      imageUrls: Array.isArray(log.image_urls) ? log.image_urls : [],
      timestamp: log.created_at.getTime(),
      status: log.status,
      errorMessage: log.error_message || undefined,
      mode: log.mode,
      triggerType: log.trigger_type,
      complianceReportId: log.compliance_report_id || undefined,
      postType: (postType as any) || 'topic',
      createdAt: log.created_at.getTime(),
      // === 返回新增字段 ===
      pipelineTimings: (log.pipeline_timings as any),
      totalDuration: log.total_duration,
      resourceUsage: (log.resource_usage as any),
      errorStack: log.error_stack,
      contextSnapshot: (log.context_snapshot as any),
      retryHistory: (log.retry_history as any),
    }));

    return {
      success: true,
      data: {
        logs,
        total: result.total,
        page: result.page,
        limit: result.pageSize,
        totalPages: result.totalPages
      }
    };
  }

  /**
   * 获取日志详情
   * @param id 日志 ID
   * @returns 日志详情，不存在返回 null
   */
  async getDetail(id: string): Promise<PostLog | null> {
    const log = await this.postLogStorage.getPostLogById(id);
    if (!log) return null;

    return {
      id: log.id,
      title: log.title,
      topicId: log.topic_id,
      topicName: log.topic_name,
      content: log.content || '',
      imageUrls: Array.isArray(log.image_urls) ? log.image_urls : [],
      timestamp: log.created_at.getTime(),
      status: log.status,
      errorMessage: log.error_message,
      mode: log.mode,
      triggerType: log.trigger_type,
      postType: 'topic' as any,
      createdAt: log.created_at.getTime(),
      // === 返回新增字段 ===
      pipelineTimings: (log.pipeline_timings as any),
      totalDuration: log.total_duration,
      resourceUsage: (log.resource_usage as any),
      errorStack: log.error_stack,
      contextSnapshot: (log.context_snapshot as any),
      retryHistory: (log.retry_history as any),
    };
  }

  /**
   * 根据 taskId 查询日志
   * @param taskId 任务 ID
   * @returns 日志���录，不存在返回 null
   */
  async findByTaskId(taskId: string): Promise<PostLog | null> {
    const log = await this.postLogStorage.getPostLogByTaskId(taskId);
    if (!log) return null;

    return {
      id: log.id,
      title: log.title,
      topicId: log.topic_id,
      topicName: log.topic_name,
      content: log.content || '',
      imageUrls: Array.isArray(log.image_urls) ? log.image_urls : [],
      timestamp: log.created_at.getTime(),
      status: log.status,
      errorMessage: log.error_message,
      mode: log.mode,
      triggerType: log.trigger_type,
      postType: 'topic' as any,
      createdAt: log.created_at.getTime(),
      // === 返回新增字段 ===
      pipelineTimings: (log.pipeline_timings as any),
      totalDuration: log.total_duration,
      resourceUsage: (log.resource_usage as any),
      errorStack: log.error_stack,
      contextSnapshot: (log.context_snapshot as any),
      retryHistory: (log.retry_history as any),
    };
  }

  /**
   * 更新日志状态（支持性能指标和调试信息）
   * @param id 日志 ID
   * @param updates 更新内容
   */
  async update(id: string, updates: {
    status?: 'success' | 'failed' | 'pending';
    postId?: string;
    title?: string;
    content?: string;
    imageUrls?: string[];
    topicId?: string;
    topicName?: string;
    errorMessage?: string;
    pipelineTimings?: PipelineTimings;
    totalDuration?: number;
    resourceUsage?: ResourceUsage;
    errorStack?: string;
    contextSnapshot?: ContextSnapshot;
    retryHistory?: RetryRecord[];
  }): Promise<void> {
    await this.postLogStorage.updatePostLog(id, updates);
    logger.debug(`更新日志 ${id}: ${JSON.stringify(updates)}`);
  }

  /**
   * 获取日志统计信息（包含性能指标）
   */
  async getStats(): Promise<{
    total: number;
    byTriggerType: Record<TriggerType, number>;
    byStatus: Record<'success' | 'failed', number>;
    performance?: {
      averageDuration: number;      // 平均耗时（毫秒）
      minDuration: number;          // 最小耗时
      maxDuration: number;          // 最大耗时
      successRate: number;          // 成功率（百分比）
    };
  }> {
    // 获取所有日志进行统计（简化实现，可以优化为 SQL 聚合查询）
    const result = await this.postLogStorage.queryPostLogs({ page: 1, pageSize: 1000 });
    
    const stats: any = {
      total: result.total,
      byTriggerType: {
        auto: 0,
        manual: 0
      },
      byStatus: {
        success: 0,
        failed: 0
      }
    };

    let totalDuration = 0;
    let durationCount = 0;
    let minDuration = Infinity;
    let maxDuration = 0;

    result.data.forEach(log => {
      stats.byTriggerType[log.trigger_type]++;
      if (log.status !== 'pending') {
        stats.byStatus[log.status]++;
      }
      
      // 统计性能指标
      if (log.total_duration !== null && log.total_duration !== undefined) {
        totalDuration += log.total_duration;
        durationCount++;
        if (log.total_duration < minDuration) minDuration = log.total_duration;
        if (log.total_duration > maxDuration) maxDuration = log.total_duration;
      }
    });

    // 计算性能统计
    if (durationCount > 0) {
      const successCount = result.data.filter(log => log.status === 'success').length;
      stats.performance = {
        averageDuration: Math.round(totalDuration / durationCount),
        minDuration: minDuration === Infinity ? 0 : minDuration,
        maxDuration: maxDuration,
        successRate: Math.round((successCount / result.data.length) * 100 * 100) / 100,
      };
    }

    return stats;
  }

  /**
   * 获取性能指标（包含 P50/P90/P99）
   */
  async getPerformanceMetrics(timeRange?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    averageDuration: number;
    p50Duration: number;
    p90Duration: number;
    p99Duration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    totalPosts: number;
  }> {
    const result = await this.postLogStorage.queryPostLogs({
      page: 1,
      pageSize: 10000,
      startDate: timeRange?.startDate,
      endDate: timeRange?.endDate,
    });

    const durations = result.data
      .filter(log => log.total_duration !== null && log.total_duration !== undefined)
      .map(log => log.total_duration!)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return {
        averageDuration: 0,
        p50Duration: 0,
        p90Duration: 0,
        p99Duration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        totalPosts: result.total,
      };
    }

    // 计算百分位数
    const percentile = (p: number) => {
      const index = Math.floor((p / 100) * (durations.length - 1));
      return durations[index];
    };

    const successCount = result.data.filter(log => log.status === 'success').length;

    return {
      averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p50Duration: percentile(50),
      p90Duration: percentile(90),
      p99Duration: percentile(99),
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: Math.round((successCount / result.data.length) * 100 * 100) / 100,
      totalPosts: result.total,
    };
  }

  /**
   * 获取环节转化率
   */
  async getConversionRates(timeRange?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    subDirectionSelection: number;      // 子方向选择成功率
    contentGeneration: number;          // 内容生成成功率
    materialSelection: number;          // 素材选择成功率
    imageUpload: number;                // 图片上传成功率
    topicMatching: number;              // 话题匹配成功率
    diversityTransform: number;         // 多样化变换成功率
    complianceCheck: number;            // 合规检查通过率
    publish: number;                    // 发布成功率
    overallSuccessRate: number;         // 总体成功率
  }> {
    const result = await this.postLogStorage.queryPostLogs({
      page: 1,
      pageSize: 10000,
      startDate: timeRange?.startDate,
      endDate: timeRange?.endDate,
    });

    const logs = result.data.filter(log => log.pipeline_timings);

    if (logs.length === 0) {
      return {
        subDirectionSelection: 0,
        contentGeneration: 0,
        materialSelection: 0,
        imageUpload: 0,
        topicMatching: 0,
        diversityTransform: 0,
        complianceCheck: 0,
        publish: 0,
        overallSuccessRate: 0,
      };
    }

    // 统计各环节成功次数
    const stepStats: Record<string, { total: number; success: number }> = {
      subDirectionSelection: { total: 0, success: 0 },
      contentGeneration: { total: 0, success: 0 },
      materialSelection: { total: 0, success: 0 },
      imageUpload: { total: 0, success: 0 },
      topicMatching: { total: 0, success: 0 },
      diversityTransform: { total: 0, success: 0 },
      complianceCheck: { total: 0, success: 0 },
      publish: { total: 0, success: 0 },
    };

    logs.forEach(log => {
      const timings = log.pipeline_timings as any;
      Object.keys(stepStats).forEach(step => {
        if (timings[step]) {
          stepStats[step].total++;
          if (timings[step].status === 'success') {
            stepStats[step].success++;
          }
        }
      });
    });

    // 计算转化率
    const conversionRates: any = {};
    Object.keys(stepStats).forEach(step => {
      conversionRates[step] = stepStats[step].total > 0
        ? Math.round((stepStats[step].success / stepStats[step].total) * 100 * 100) / 100
        : 0;
    });

    // 总体成功率
    const successCount = result.data.filter(log => log.status === 'success').length;
    conversionRates.overallSuccessRate = Math.round((successCount / result.data.length) * 100 * 100) / 100;

    return conversionRates;
  }

  /**
   * 获取实时监控指标（当前小时、今日累计）
   */
  async getRealTimeMetrics(): Promise<{
    currentHour: {
      totalPosts: number;
      successRate: number;
      averageDuration: number;
      errorCount: number;
    };
    today: {
      totalPosts: number;
      successRate: number;
      averageDuration: number;
      errorCount: number;
    };
  }> {
    const now = new Date();
    const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0).toISOString();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();

    // 当前小时数据
    const currentHourResult = await this.postLogStorage.queryPostLogs({
      page: 1,
      pageSize: 1000,
      startDate: startOfHour,
    });

    // 今日数据
    const todayResult = await this.postLogStorage.queryPostLogs({
      page: 1,
      pageSize: 10000,
      startDate: startOfDay,
    });

    const calculateMetrics = (result: any) => {
      const successCount = result.data.filter((log: any) => log.status === 'success').length;
      const errorCount = result.data.filter((log: any) => log.status === 'failed').length;
      const durations = result.data
        .filter((log: any) => log.total_duration !== null && log.total_duration !== undefined)
        .map((log: any) => log.total_duration);
      const averageDuration = durations.length > 0
        ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
        : 0;

      return {
        totalPosts: result.total,
        successRate: result.data.length > 0
          ? Math.round((successCount / result.data.length) * 100 * 100) / 100
          : 0,
        averageDuration,
        errorCount,
      };
    };

    return {
      currentHour: calculateMetrics(currentHourResult),
      today: calculateMetrics(todayResult),
    };
  }

  /**
   * 异常告警检查
   */
  async checkAlerts(thresholds?: {
    minSuccessRate?: number;       // 最低成功率（百分比）
    maxAverageDuration?: number;   // 最大平均耗时（毫秒）
    maxErrorCount?: number;        // 最大错误数
  }): Promise<{
    hasAlerts: boolean;
    alerts: Array<{
      type: string;
      severity: 'critical' | 'severe' | 'warning';
      message: string;
      value: number;
      threshold: number;
    }>;
  }> {
    const defaultThresholds = {
      minSuccessRate: 80,
      maxAverageDuration: 120000, // 2 分钟
      maxErrorCount: 10,
    };

    const actualThresholds = { ...defaultThresholds, ...thresholds };
    const alerts: any[] = [];

    // 获取当前小时的指标
    const metrics = await this.getRealTimeMetrics();

    // 检查成功率
    if (metrics.currentHour.successRate < actualThresholds.minSuccessRate) {
      alerts.push({
        type: 'low_success_rate',
        severity: 'severe',
        message: `当前小时成功率低于阈值：${metrics.currentHour.successRate}% < ${actualThresholds.minSuccessRate}%`,
        value: metrics.currentHour.successRate,
        threshold: actualThresholds.minSuccessRate,
      });
    }

    // 检查平均耗时
    if (metrics.currentHour.averageDuration > actualThresholds.maxAverageDuration) {
      alerts.push({
        type: 'high_duration',
        severity: 'warning',
        message: `当前小时平均耗时超过阈值：${metrics.currentHour.averageDuration}ms > ${actualThresholds.maxAverageDuration}ms`,
        value: metrics.currentHour.averageDuration,
        threshold: actualThresholds.maxAverageDuration,
      });
    }

    // 检查错误数
    if (metrics.currentHour.errorCount > actualThresholds.maxErrorCount) {
      alerts.push({
        type: 'high_error_count',
        severity: 'critical',
        message: `当前小时错误数超过阈值：${metrics.currentHour.errorCount} > ${actualThresholds.maxErrorCount}`,
        value: metrics.currentHour.errorCount,
        threshold: actualThresholds.maxErrorCount,
      });
    }

    return {
      hasAlerts: alerts.length > 0,
      alerts,
    };
  }

  /**
   * 手动触发清理过期日志（用于测试和管理）
   * @param maxAgeDays 保留天数，默认 30 天
   * @returns 清理的记录数量
   */
  async triggerCleanup(maxAgeDays: number = this.maxAgeDays): Promise<number> {
    logger.info(`手动触发清理过期发帖日志（保留${maxAgeDays}天）`);
    const startTime = Date.now();
    
    try {
      const cleaned = await this.postLogStorage.deleteExpiredLogs(maxAgeDays);
      const duration = Date.now() - startTime;
      
      logger.info(`手动清理完成：清理 ${cleaned} 条记录，耗时 ${duration}ms`);
      return cleaned;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`手动清理过期发帖日志失败，耗时 ${duration}ms: ${error.message}`, {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
        },
      });
      throw error;
    }
  }
}

// 导出单例
export const postLoggingService = PostLoggingService.getInstance();
