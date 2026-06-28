import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../utils/logger';

const logger = getLogger('post-log-storage');

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
  image_urls?: string | string[];  // 兼容旧数据：可能是字符串或数组
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  mode: 'normal' | 'featured';
  trigger_type: 'auto' | 'manual';
  compliance_report_id?: string;
  created_at: Date;
  
  // === 新增：性能指标字段 ===
  pipeline_timings?: string | any;       // JSON 字符串或解析后的对象
  total_duration?: number;         // 总执行时长（毫秒）
  resource_usage?: string | any;   // JSON 字符串或解析后的对象
  
  // === 新增：调试信息字段 ===
  error_stack?: string;            // 错误堆栈信息
  context_snapshot?: string | any; // JSON 字符串或解析后的对象
  retry_history?: string | any;    // JSON 字符串或解析后的对象
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
  
  // === 新增：性能指标字段 ===
  pipeline_timings?: any;          // Pipeline 各步骤耗时
  total_duration?: number;         // 总执行时长（毫秒）
  resource_usage?: any;            // 资源使用情况
  
  // === 新增：调试信息字段 ===
  error_stack?: string;            // 错误堆栈信息
  context_snapshot?: any;          // 上下文快照
  retry_history?: any;             // 重试历史记录
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
  minDuration?: number;  // 按执行时长筛选（>=）
  maxDuration?: number;  // 按执行时长筛选（<=）
}

export class PostLogStorage extends BaseDAO {
  async createPostLog(input: CreatePostLogInput): Promise<PostLog> {
    const id = uuidv4();
    const imageUrls = input.image_urls ? JSON.stringify(input.image_urls) : null;
    const pipelineTimings = input.pipeline_timings ? JSON.stringify(input.pipeline_timings) : null;
    const resourceUsage = input.resource_usage ? JSON.stringify(input.resource_usage) : null;
    const contextSnapshot = input.context_snapshot ? JSON.stringify(input.context_snapshot) : null;
    const retryHistory = input.retry_history ? JSON.stringify(input.retry_history) : null;
    
    const sql = `
      INSERT INTO post_logs (id, post_id, task_id, title, topic_id, topic_name, content, image_urls, 
                            status, error_message, mode, trigger_type, compliance_report_id,
                            pipeline_timings, total_duration, resource_usage,
                            error_stack, context_snapshot, retry_history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      pipelineTimings,
      input.total_duration || null,
      resourceUsage,
      input.error_stack || null,
      contextSnapshot,
      retryHistory,
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
    pipeline_timings?: any;
    total_duration?: number;
    resource_usage?: any;
    error_stack?: string;
    context_snapshot?: any;
    retry_history?: any;
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
    if (updates.pipeline_timings !== undefined) {
      setClauses.push('pipeline_timings = ?');
      params.push(JSON.stringify(updates.pipeline_timings));
    }
    if (updates.total_duration !== undefined) {
      setClauses.push('total_duration = ?');
      params.push(updates.total_duration);
    }
    if (updates.resource_usage !== undefined) {
      setClauses.push('resource_usage = ?');
      params.push(JSON.stringify(updates.resource_usage));
    }
    if (updates.error_stack !== undefined) {
      setClauses.push('error_stack = ?');
      params.push(updates.error_stack);
    }
    if (updates.context_snapshot !== undefined) {
      setClauses.push('context_snapshot = ?');
      params.push(JSON.stringify(updates.context_snapshot));
    }
    if (updates.retry_history !== undefined) {
      setClauses.push('retry_history = ?');
      params.push(JSON.stringify(updates.retry_history));
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
    if (options?.minDuration !== undefined) {
      sql += ` AND total_duration >= ?`;
      params.push(options.minDuration);
    }
    if (options?.maxDuration !== undefined) {
      sql += ` AND total_duration <= ?`;
      params.push(options.maxDuration);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.queryPaginated<PostLog>(sql, params, options?.page || 1, options?.pageSize || 20);
    
    // 解析 JSON 字段
    result.data.forEach(log => {
      // 解析 image_urls（兼容旧数据：可能是字符串或 JSON 数组）
      if (log.image_urls) {
        try {
          const imageUrlsStr = log.image_urls as any;
          // 如果已经是数组，直接返回
          if (Array.isArray(imageUrlsStr)) {
            log.image_urls = imageUrlsStr;
          } else if (typeof imageUrlsStr === 'string') {
            // 如果是字符串，先尝试 JSON 解析
            if (imageUrlsStr.trim().startsWith('[')) {
              // JSON 数组格式
              log.image_urls = JSON.parse(imageUrlsStr);
            } else if (imageUrlsStr.trim().length > 0) {
              // 单个 URL 或逗号分隔的多个 URL
              if (imageUrlsStr.includes(',')) {
                log.image_urls = imageUrlsStr.split(',').map((url: string) => url.trim());
              } else {
                log.image_urls = [imageUrlsStr];
              }
            } else {
              log.image_urls = [];
            }
          }
        } catch (error: any) {
          logger.warn(`解析 image_urls 失败：${error.message}`, { id: log.id, raw: log.image_urls });
          log.image_urls = [];
        }
      }
      // 解析 pipeline_timings
      if (log.pipeline_timings) {
        try {
          log.pipeline_timings = JSON.parse(log.pipeline_timings as any);
        } catch (error: any) {
          logger.warn(`解析 pipeline_timings 失败：${error.message}`, { id: log.id });
          log.pipeline_timings = null as any;
        }
      }
      // 解析 resource_usage
      if (log.resource_usage) {
        try {
          log.resource_usage = JSON.parse(log.resource_usage as any);
        } catch (error: any) {
          logger.warn(`解析 resource_usage 失败：${error.message}`, { id: log.id });
          log.resource_usage = null as any;
        }
      }
      // 解析 context_snapshot
      if (log.context_snapshot) {
        try {
          log.context_snapshot = JSON.parse(log.context_snapshot as any);
        } catch (error: any) {
          logger.warn(`解析 context_snapshot 失败：${error.message}`, { id: log.id });
          log.context_snapshot = null as any;
        }
      }
      // 解析 retry_history
      if (log.retry_history) {
        try {
          log.retry_history = JSON.parse(log.retry_history as any);
        } catch (error: any) {
          logger.warn(`解析 retry_history 失败：${error.message}`, { id: log.id });
          log.retry_history = null as any;
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
