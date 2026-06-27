import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 发帖日志 MySQL 存储
 */

export interface PostLog {
  id: string;
  post_id?: string;
  task_id?: string;  // AutoJS 任务 ID
  title: string;
  topic_id?: string;
  topic_name?: string;
  content?: string;
  image_urls?: string;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  mode: 'normal' | 'featured';
  trigger_type: 'auto' | 'manual';
  compliance_report_id?: string;
  created_at: Date;
}

export interface CreatePostLogInput {
  post_id?: string;
  task_id?: string;  // AutoJS 任务 ID
  title: string;
  topic_id?: string;
  topic_name?: string;
  content?: string;
  image_urls?: string[];
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  mode: 'normal' | 'featured';
  trigger_type: 'auto' | 'manual';
  compliance_report_id?: string;
}

export interface PostLogQueryOptions {
  postId?: string;
  taskId?: string;  // 按任务 ID 查询
  startDate?: string;
  endDate?: string;
  status?: string;
  mode?: string;
  triggerType?: string;
  page?: number;
  pageSize?: number;
}

export class PostLogStorage extends BaseDAO {
  async createPostLog(input: CreatePostLogInput): Promise<PostLog> {
    const id = uuidv4();
    const imageUrls = input.image_urls ? JSON.stringify(input.image_urls) : null;
    
    const sql = `
      INSERT INTO post_logs (id, post_id, task_id, title, topic_id, topic_name, content, image_urls, 
                            status, error_message, mode, trigger_type, compliance_report_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.insert(sql, [
      id,
      input.post_id || null,
      input.task_id || null,
      input.title,
      input.topic_id || null,
      input.topic_name || null,
      input.content || null,
      imageUrls,
      input.status,
      input.error_message || null,
      input.mode,
      input.trigger_type,
      input.compliance_report_id || null,
    ]);
    
    const log = await this.getPostLogById(id);
    if (!log) throw new Error('创建发帖日志失败');
    return log;
  }

  async getPostLogById(id: string): Promise<PostLog | null> {
    const sql = `SELECT * FROM post_logs WHERE id = ?`;
    const result = await this.queryOne<PostLog>(sql, [id]);
    if (result && result.image_urls) {
      try {
        result.image_urls = JSON.parse(result.image_urls as any);
      } catch {
        // 如果解析失败，保持原样
      }
    }
    return result;
  }

  /**
   * 根据 task_id 查询日志
   */
  async getPostLogByTaskId(taskId: string): Promise<PostLog | null> {
    const sql = `SELECT * FROM post_logs WHERE task_id = ?`;
    const result = await this.queryOne<PostLog>(sql, [taskId]);
    if (result && result.image_urls) {
      try {
        result.image_urls = JSON.parse(result.image_urls as any);
      } catch {
        // 如果解析失败，保持原样
      }
    }
    return result;
  }

  /**
   * 更新日志状态
   */
  async updatePostLog(id: string, updates: {
    status?: 'success' | 'failed' | 'pending';
    post_id?: string;
    title?: string;
    content?: string;
    image_urls?: string[];
    topic_id?: string;
    topic_name?: string;
    error_message?: string;
  }): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.post_id !== undefined) {
      setClauses.push('post_id = ?');
      params.push(updates.post_id);
    }
    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      params.push(updates.title);
    }
    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      params.push(updates.content);
    }
    if (updates.image_urls !== undefined) {
      setClauses.push('image_urls = ?');
      params.push(JSON.stringify(updates.image_urls));
    }
    if (updates.topic_id !== undefined) {
      setClauses.push('topic_id = ?');
      params.push(updates.topic_id);
    }
    if (updates.topic_name !== undefined) {
      setClauses.push('topic_name = ?');
      params.push(updates.topic_name);
    }
    if (updates.error_message !== undefined) {
      setClauses.push('error_message = ?');
      params.push(updates.error_message);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE post_logs SET ${setClauses.join(', ')} WHERE id = ?`;
    await this.update(sql, params);
  }

  async queryPostLogs(options?: PostLogQueryOptions): Promise<{
    data: PostLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let sql = `SELECT * FROM post_logs WHERE 1=1`;
    const params: any[] = [];

    if (options?.postId) {
      sql += ` AND post_id = ?`;
      params.push(options.postId);
    }
    if (options?.taskId) {
      sql += ` AND task_id = ?`;
      params.push(options.taskId);
    }
    if (options?.startDate) {
      sql += ` AND created_at >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND created_at <= ?`;
      params.push(options.endDate);
    }
    if (options?.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }
    if (options?.mode) {
      sql += ` AND mode = ?`;
      params.push(options.mode);
    }
    if (options?.triggerType) {
      sql += ` AND trigger_type = ?`;
      params.push(options.triggerType);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.queryPaginated<PostLog>(sql, params, options?.page || 1, options?.pageSize || 20);
    
    // 解析 image_urls 字段
    result.data.forEach(log => {
      if (log.image_urls) {
        try {
          log.image_urls = JSON.parse(log.image_urls as any);
        } catch {
          // 如果解析失败，保持原样
        }
      }
    });
    
    return result;
  }

  async deleteExpiredLogs(daysOld: number): Promise<number> {
    const sql = `DELETE FROM post_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`;
    return await this.delete(sql, [daysOld]);
  }
}

let instance: PostLogStorage | null = null;
export const getPostLogStorage = (): PostLogStorage => {
  if (!instance) instance = new PostLogStorage();
  return instance;
};
