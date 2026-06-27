import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 评论日志 MySQL 存储
 */

export interface CommentLog {
  id: string;
  post_id: string;
  post_title?: string;
  post_content?: string;
  content_type?: string;
  comment_content: string;
  comment_id?: string;
  success: boolean;
  error?: string;
  mode: 'normal' | 'fallback';
  source: 'auto' | 'manual';
  publish_time?: Date;
  created_at: Date;
}

export interface CreateCommentLogInput {
  post_id: string;
  post_title?: string;
  post_content?: string;
  content_type?: string;
  comment_content: string;
  comment_id?: string;
  success: boolean;
  error?: string;
  mode: 'normal' | 'fallback';
  source: 'auto' | 'manual';
  publish_time?: string;
}

export interface CommentLogQueryOptions {
  postId?: string;
  success?: boolean;
  mode?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export class CommentLogStorage extends BaseDAO {
  /**
   * 创建评论日志
   */
  async createCommentLog(input: CreateCommentLogInput): Promise<CommentLog> {
    const id = uuidv4();
    
    const sql = `
      INSERT INTO comment_logs (id, post_id, post_title, post_content, content_type, 
                                comment_content, comment_id, success, error, mode, source, publish_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.insert(sql, [
      id,
      input.post_id,
      input.post_title || null,
      input.post_content || null,
      input.content_type || null,
      input.comment_content,
      input.comment_id || null,
      input.success,
      input.error || null,
      input.mode,
      input.source,
      input.publish_time || null,
    ]);
    
    const log = await this.getCommentLogById(id);
    if (!log) throw new Error('创建评论日志失败');
    return log;
  }

  /**
   * 根据 ID 查询评论日志
   */
  async getCommentLogById(id: string): Promise<CommentLog | null> {
    const sql = `SELECT * FROM comment_logs WHERE id = ?`;
    return await this.queryOne<CommentLog>(sql, [id]);
  }

  /**
   * 查询评论日志列表
   */
  async queryCommentLogs(options?: CommentLogQueryOptions): Promise<{
    data: CommentLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let sql = `SELECT * FROM comment_logs WHERE 1=1`;
    const params: any[] = [];

    if (options?.postId) {
      sql += ` AND post_id = ?`;
      params.push(options.postId);
    }
    if (options?.success !== undefined) {
      sql += ` AND success = ?`;
      params.push(options.success);
    }
    if (options?.mode) {
      sql += ` AND mode = ?`;
      params.push(options.mode);
    }
    if (options?.source) {
      sql += ` AND source = ?`;
      params.push(options.source);
    }
    if (options?.startDate) {
      sql += ` AND created_at >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND created_at <= ?`;
      params.push(options.endDate);
    }

    sql += ` ORDER BY created_at DESC`;

    return await this.queryPaginated<CommentLog>(sql, params, options?.page || 1, options?.pageSize || 20);
  }

  /**
   * 删除过期日志 (30 天前)
   */
  async deleteExpiredLogs(daysOld: number = 30): Promise<number> {
    const sql = `DELETE FROM comment_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`;
    return await this.delete(sql, [daysOld]);
  }
}

// 导出单例
let commentLogStorageInstance: CommentLogStorage | null = null;

export const getCommentLogStorage = (): CommentLogStorage => {
  if (!commentLogStorageInstance) {
    commentLogStorageInstance = new CommentLogStorage();
  }
  return commentLogStorageInstance;
};
