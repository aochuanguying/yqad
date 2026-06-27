import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 发帖日志 MySQL 存储
 */

export interface PostLog {
  id: string;
  post_id?: string;
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
      INSERT INTO post_logs (id, post_id, title, topic_id, topic_name, content, image_urls, 
                            status, error_message, mode, trigger_type, compliance_report_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.insert(sql, [
      id,
      input.post_id || null,
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
