import { getLogger } from '../utils/logger';
import { PostLog, LogQueryParams, LogQueryResponse, TriggerType, PostType } from '../types/post-logging';
import { getPostLogStorage, CreatePostLogInput } from '../storage/mysql/post-log-storage';

const logger = getLogger('post-logging-service');

/**
 * 发帖日志服务
 * 负责日志记录、查询、持久化、定期清理
 */
export class PostLoggingService {
  private static instance: PostLoggingService;
  private postLogStorage = getPostLogStorage();
  private readonly maxAgeDays: number = 30;  // 最多保留 30 天

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
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    // 每 10 分钟清理一次过期记录
    setInterval(() => {
      this.cleanupExpired();
    }, 10 * 60 * 1000);
  }

  /**
   * 清理过期记录
   */
  private async cleanupExpired(): Promise<void> {
    try {
      const cleaned = await this.postLogStorage.deleteExpiredLogs(this.maxAgeDays);
      if (cleaned > 0) {
        logger.info(`清理 ${cleaned} 条过期发帖日志记录`);
      }
    } catch (error: any) {
      logger.error(`清理过期发帖日志失败：${error.message}`);
    }
  }

  /**
   * 记录发帖日志
   * @param log 日志记录（不包含 id 和 createdAt）
   * @returns 创建的日志记录
   */
  async log(log: Omit<PostLog, 'id' | 'createdAt'>): Promise<PostLog> {
    // 转换为 MySQL 存储格式
    const input: CreatePostLogInput = {
      post_id: (log as any).postId,
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
    };
  }

  /**
   * 查询日志列表（分页）
   * @param params 查询参数
   * @returns 查询结果
   */
  async query(params: LogQueryParams = {}): Promise<LogQueryResponse> {
    const {
      page = 1,
      limit = 20,
      triggerType,
      postType,
      startDate,
      endDate
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
    };
  }

  /**
   * 获取日志统计信息
   */
  async getStats(): Promise<{
    total: number;
    byTriggerType: Record<TriggerType, number>;
    byStatus: Record<'success' | 'failed', number>;
  }> {
    // 获取所有日志进行统计（简化实现，可以优化为 SQL 聚合查询）
    const result = await this.postLogStorage.queryPostLogs({ page: 1, pageSize: 1000 });
    
    const stats = {
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

    result.data.forEach(log => {
      stats.byTriggerType[log.trigger_type]++;
      if (log.status !== 'pending') {
        stats.byStatus[log.status]++;
      }
    });

    return stats;
  }
}

// 导出单例
export const postLoggingService = PostLoggingService.getInstance();
