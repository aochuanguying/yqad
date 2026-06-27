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
    const posts = await this.storage.getAllPending();
    const now = Date.now();
    let cleaned = 0;

    for (const mysqlPost of posts) {
      if (now - mysqlPost.created_at.getTime() >= this.expiryMs) {
        const post = this.convertToPendingPost(mysqlPost);
        try {
          const log = await (postLoggingService as any).findByTaskId(post.taskId);
          if (log && log.status === 'pending') {
            logger.warn(`级联更新日志状态为失败：${post.taskId}`);
          }
        } catch (error: any) {
          logger.error(`更新日志状态失败：${error.message}`);
        }
        
        cleaned++;
      }
    }

    await this.storage.deleteExpired();
    logger.info(`清理 ${cleaned} 条过期待确认记录`);
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
