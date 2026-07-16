import { getLogger } from '../utils/logger';
import { PendingPost as MySQLPendingPost, CreatePendingPostInput } from '../storage/mysql/pending-post-storage';
import { getPendingPostStorage } from '../storage/mysql/pending-post-storage';
import { PendingPost, ImageInfo } from '../types/api-remote-post';
import { postLoggingService } from './post-logging-service';

const logger = getLogger('pending-post-service');

export class PendingPostService {
  private static instance: PendingPostService;
  private storage = getPendingPostStorage();
  private readonly expiryMs: number = 30 * 60 * 1000;

  private constructor() {
    logger.info('待确认发帖服务已初始化（使用 MySQL 存储）');
  }

  static getInstance(): PendingPostService {
    if (!PendingPostService.instance) {
      PendingPostService.instance = new PendingPostService();
    }
    return PendingPostService.instance;
  }

  async save(post: PendingPost): Promise<void> {
    const imageUrls = post.images ? post.images.map(img => img.url) : [];
    const input: CreatePendingPostInput = {
      task_id: post.taskId,
      member_id: undefined,
      title: post.title,
      content: post.content,
      summary: undefined,
      cover_image_url: undefined,
      image_urls: imageUrls,
      topic_id: post.topicId || undefined,
      topic_name: undefined,
      mode: post.mode,
      expires_at: new Date(post.createdAt + this.expiryMs),
    };

    await this.storage.createPendingPost(input);
    logger.debug(`保存待确认记录：${post.taskId}`);
  }

  get(taskId: string): PendingPost | undefined {
    return undefined;
  }

  async getPendingPost(taskId: string): Promise<PendingPost | null> {
    const mysqlPost = await this.storage.getPendingPostByTaskId(taskId);
    if (!mysqlPost) return null;
    return this.convertToPendingPost(mysqlPost);
  }

  async confirm(taskId: string): Promise<void> {
    const mysqlPost = await this.storage.getPendingPostByTaskId(taskId);
    if (mysqlPost) {
      await this.storage.updateStatus(mysqlPost.id, 'confirmed');
      logger.info(`确认发帖：${taskId}`);
    }
  }

  async reject(taskId: string, reason?: string): Promise<void> {
    const mysqlPost = await this.storage.getPendingPostByTaskId(taskId);
    if (mysqlPost) {
      await this.storage.updateStatus(mysqlPost.id, 'rejected');
      logger.info(`拒绝发帖：${taskId}`);
    }
  }

  async isDuplicate(title: string, content: string): Promise<boolean> {
    const posts = await this.storage.getAllPending();
    return posts.some(p => p.title === title && p.content === content);
  }

  async cleanupExpired(): Promise<void> {
    // 清理 post_logs 中的超时 pending 记录（不依赖 pending_posts 表）
    await this.cleanupExpiredPostLogs();
    
    // 清理 pending_posts 表
    const posts = await this.storage.getAllPending();
    const now = Date.now();
    let cleaned = 0;
    let updatedLogs = 0;

    for (const mysqlPost of posts) {
      if (now - mysqlPost.created_at.getTime() >= this.expiryMs) {
        const post = this.convertToPendingPost(mysqlPost);
        try {
          const log = await postLoggingService.findByTaskId(post.taskId);
          if (log && log.status === 'pending') {
            await postLoggingService.update(log.id, {
              status: 'failed',
              errorMessage: '发帖任务超时未确认（30 分钟）',
            });
            logger.info(`级联更新日志状态为失败：${post.taskId}, 日志 ID: ${log.id}`);
            updatedLogs++;
          }
        } catch (error: any) {
          logger.error(`更新日志状态失败：${post.taskId}, 错误：${error.message}`);
        }
        
        cleaned++;
      }
    }

    await this.storage.deleteExpired();
    logger.info(`清理 ${cleaned} 条过期待确认记录，级联更新 ${updatedLogs} 条日志状态`);
  }

  /**
   * 清理 post_logs 中超时的 pending 记录
   * 直接按时间清理，不依赖 pending_posts 表
   * 
   * 修复时区问题：在应用层计算时间，避免 MySQL 时区不一致导致清理失败
   */
  private async cleanupExpiredPostLogs(): Promise<void> {
    try {
      const timeoutMinutes = 30;
      const { getPostLogStorage } = await import('../storage/mysql/post-log-storage');
      const postLogStorage = getPostLogStorage();
      
      // 在应用层计算超时时间阈值（使用 UTC 时间，避免时区问题）
      const thresholdTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
      const thresholdTimeStr = thresholdTime.toISOString().slice(0, 19).replace('T', ' ');
      
      const sql = `
        UPDATE post_logs 
        SET status = 'failed',
            error_message = 'AutoJS 回调超时（30 分钟未收到回调）'
        WHERE status = 'pending'
          AND created_at < ?
      `;
      
      // 使用 update 方法执行 SQL（返回受影响的行数）
      const affectedRows = await (postLogStorage as any).update(sql, [thresholdTimeStr]);
      
      if (affectedRows > 0) {
        logger.info(`清理 ${affectedRows} 条超时的 pending 日志记录（直接清理）`);
      }
    } catch (error: any) {
      logger.error(`清理超时 pending 日志失败：${error.message}`);
    }
  }

  async getAllPending(): Promise<PendingPost[]> {
    const mysqlPosts = await this.storage.getAllPending();
    return mysqlPosts.map(p => this.convertToPendingPost(p));
  }

  private convertToPendingPost(mysqlPost: MySQLPendingPost): PendingPost {
    let images: ImageInfo[] = [];
    if (mysqlPost.image_urls) {
      try {
        const urls: string[] = JSON.parse(mysqlPost.image_urls);
        images = urls.map(url => ({ url, relativePath: '', filename: url.split('/').pop() || '' }));
      } catch (e) {}
    }

    return {
      taskId: mysqlPost.task_id,
      topicId: mysqlPost.topic_id || undefined,
      title: mysqlPost.title,
      content: mysqlPost.content || '',
      images,
      mode: mysqlPost.mode,
      createdAt: mysqlPost.created_at.getTime(),
    };
  }
}

export const pendingPostService = PendingPostService.getInstance();
