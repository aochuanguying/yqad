import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 待确认发帖 MySQL 存储
 */

export interface PendingPost {
  id: string;
  task_id: string;
  member_id?: string;
  title: string;
  content?: string;
  summary?: string;
  cover_image_url?: string;
  image_urls?: string;  // JSON 数组字符串
  topic_id?: string;
  topic_name?: string;
  mode: 'normal' | 'featured';
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  expires_at: Date;
  created_at: Date;
  confirmed_at?: Date;
}

export interface CreatePendingPostInput {
  task_id: string;
  member_id?: string;
  title: string;
  content?: string;
  summary?: string;
  cover_image_url?: string;
  image_urls?: string[];
  topic_id?: string;
  topic_name?: string;
  mode: 'normal' | 'featured';
  expires_at: Date;
}

export class PendingPostStorage extends BaseDAO {
  /**
   * 创建待确认发帖
   */
  async createPendingPost(input: CreatePendingPostInput): Promise<PendingPost> {
    const id = uuidv4();
    const imageUrls = input.image_urls ? JSON.stringify(input.image_urls) : null;
    
    const sql = `
      INSERT INTO pending_posts (id, task_id, member_id, title, content, summary, 
                                cover_image_url, image_urls, topic_id, topic_name, 
                                mode, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `;
    
    await this.insert(sql, [
      id,
      input.task_id,
      input.member_id || null,
      input.title,
      input.content || null,
      input.summary || null,
      input.cover_image_url || null,
      imageUrls,
      input.topic_id || null,
      input.topic_name || null,
      input.mode,
      input.expires_at,
    ]);
    
    const post = await this.getPendingPostById(id);
    if (!post) {
      throw new Error('创建待确认发帖失败');
    }
    return post;
  }

  /**
   * 根据 ID 查询
   */
  async getPendingPostById(id: string): Promise<PendingPost | null> {
    const sql = `SELECT * FROM pending_posts WHERE id = ?`;
    return await this.queryOne<PendingPost>(sql, [id]);
  }

  /**
   * 根据 task_id 查询
   */
  async getPendingPostByTaskId(taskId: string): Promise<PendingPost | null> {
    const sql = `SELECT * FROM pending_posts WHERE task_id = ?`;
    return await this.queryOne<PendingPost>(sql, [taskId]);
  }

  /**
   * 更新状态
   */
  async updateStatus(id: string, status: 'confirmed' | 'rejected' | 'expired'): Promise<void> {
    const sql = `UPDATE pending_posts SET status = ?, confirmed_at = ? WHERE id = ?`;
    const confirmedAt = status === 'confirmed' ? new Date() : null;
    await this.update(sql, [status, confirmedAt, id]);
  }

  /**
   * 查询所有待确认
   */
  async getAllPending(): Promise<PendingPost[]> {
    const sql = `SELECT * FROM pending_posts WHERE status = 'pending' ORDER BY created_at DESC`;
    return await this.queryMany<PendingPost>(sql, []);
  }

  /**
   * 删除过期记录
   */
  async deleteExpired(): Promise<number> {
    const sql = `DELETE FROM pending_posts WHERE expires_at < NOW() AND status = 'pending'`;
    return await this.delete(sql, []);
  }
}

// 单例模式
let instance: PendingPostStorage | null = null;

export const getPendingPostStorage = (): PendingPostStorage => {
  if (!instance) {
    instance = new PendingPostStorage();
  }
  return instance;
};
