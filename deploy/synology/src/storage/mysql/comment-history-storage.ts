import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 评论历史 MySQL 存储
 */

export interface CommentHistory {
  id: string;
  post_id: string;
  comment_id: string;
  content: string;
  post_title?: string;
  post_content?: string;
  content_type?: string;
  publish_time?: Date;
  created_at: Date;
}

export interface CreateCommentHistoryInput {
  post_id: string;
  comment_id: string;
  content: string;
  post_title?: string;
  post_content?: string;
  content_type?: string;
  publish_time?: string;
}

export class CommentHistoryStorage extends BaseDAO {
  /**
   * 创建评论历史
   */
  async createCommentHistory(input: CreateCommentHistoryInput): Promise<CommentHistory> {
    const id = uuidv4();
    
    const sql = `
      INSERT INTO comment_history (id, post_id, comment_id, content, post_title, post_content, content_type, publish_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.insert(sql, [
      id,
      input.post_id,
      input.comment_id,
      input.content,
      input.post_title || null,
      input.post_content || null,
      input.content_type || null,
      input.publish_time || null,
    ]);
    
    const history = await this.getCommentHistoryByPostId(input.post_id);
    if (!history) throw new Error('创建评论历史失败');
    return history;
  }

  /**
   * 根据帖子 ID 查询评论历史
   */
  async getCommentHistoryByPostId(postId: string): Promise<CommentHistory | null> {
    const sql = `SELECT * FROM comment_history WHERE post_id = ?`;
    return await this.queryOne<CommentHistory>(sql, [postId]);
  }

  /**
   * 根据评论 ID 查询评论历史
   */
  async getCommentHistoryByCommentId(commentId: string): Promise<CommentHistory | null> {
    const sql = `SELECT * FROM comment_history WHERE comment_id = ?`;
    return await this.queryOne<CommentHistory>(sql, [commentId]);
  }

  /**
   * 查询评论历史列表
   */
  async getCommentHistoryList(options?: {
    page?: number;
    pageSize?: number;
  }): Promise<{
    data: CommentHistory[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const sql = `SELECT * FROM comment_history ORDER BY created_at DESC`;
    return await this.queryPaginated<CommentHistory>(sql, [], options?.page || 1, options?.pageSize || 50);
  }

  /**
   * 更新评论历史 (重新评论时使用)
   */
  async updateCommentHistory(postId: string, input: Partial<CreateCommentHistoryInput>): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    if (input.comment_id !== undefined) {
      fields.push('comment_id = ?');
      params.push(input.comment_id);
    }
    if (input.content !== undefined) {
      fields.push('content = ?');
      params.push(input.content);
    }
    if (input.post_title !== undefined) {
      fields.push('post_title = ?');
      params.push(input.post_title);
    }
    if (input.post_content !== undefined) {
      fields.push('post_content = ?');
      params.push(input.post_content);
    }
    if (input.content_type !== undefined) {
      fields.push('content_type = ?');
      params.push(input.content_type);
    }
    if (input.publish_time !== undefined) {
      fields.push('publish_time = ?');
      params.push(input.publish_time);
    }

    if (fields.length === 0) {
      return true;
    }

    fields.push('created_at = NOW()');
    params.push(postId);

    const sql = `UPDATE comment_history SET ${fields.join(', ')} WHERE post_id = ?`;
    const affected = await this.update(sql, params);
    return affected > 0;
  }

  /**
   * 检查帖子是否已评论
   */
  async hasCommented(postId: string): Promise<boolean> {
    const sql = `SELECT COUNT(*) as count FROM comment_history WHERE post_id = ?`;
    const result = await this.queryOne<{ count: number }>(sql, [postId]);
    return (result?.count || 0) > 0;
  }

  /**
   * 获取最近 N 天内的评论开头 (用于避免重复)
   */
  async getRecentOpenings(days: number): Promise<string[]> {
    const sql = `SELECT content FROM comment_history WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY created_at DESC`;
    const results = await this.queryMany<{ content: string }>(sql, [days]);
    return results.map(r => r.content.substring(0, 15));
  }

  /**
   * 获取所有已评论的帖子 ID 集合（用于去重，不分页）
   */
  async getCommentedPostIds(): Promise<Set<string>> {
    const sql = `SELECT DISTINCT post_id FROM comment_history`;
    const results = await this.queryMany<{ post_id: string }>(sql, []);
    return new Set(results.map(r => r.post_id));
  }

  /**
   * 获取所有评论历史 (用于兜底模式)
   */
  async getAllCommentHistory(): Promise<CommentHistory[]> {
    const sql = `SELECT * FROM comment_history ORDER BY publish_time DESC`;
    return await this.queryMany<CommentHistory>(sql, []);
  }
}

// 导出单例
let commentHistoryStorageInstance: CommentHistoryStorage | null = null;

export const getCommentHistoryStorage = (): CommentHistoryStorage => {
  if (!commentHistoryStorageInstance) {
    commentHistoryStorageInstance = new CommentHistoryStorage();
  }
  return commentHistoryStorageInstance;
};
