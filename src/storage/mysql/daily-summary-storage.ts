/**
 * 每日摘要 MySQL 存储
 */

import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('daily-summary-storage');

/**
 * 每日摘要记录
 */
export interface DailySummary {
  id?: string;
  date: string;
  comments_total: number;
  comments_successful: number;
  comments_failed: number;
  posts_total: number;
  posts_successful: number;
  posts_failed: number;
  failed_tasks: string;  // JSON 数组
  created_at?: Date;
}

/**
 * 创建每日摘要输入
 */
export interface CreateDailySummaryInput {
  date: string;
  commentsTotal: number;
  commentsSuccessful: number;
  commentsFailed: number;
  postsTotal: number;
  postsSuccessful: number;
  postsFailed: number;
  failedTasks: string[];
}

/**
 * 每日摘要存储类
 */
export class DailySummaryStorage extends BaseDAO {
  /**
   * 初始化表结构
   */
  async initialize(): Promise<void> {
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS daily_summaries (
          id VARCHAR(36) PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          comments_total INT DEFAULT 0,
          comments_successful INT DEFAULT 0,
          comments_failed INT DEFAULT 0,
          posts_total INT DEFAULT 0,
          posts_successful INT DEFAULT 0,
          posts_failed INT DEFAULT 0,
          failed_tasks JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_date (date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      logger.info('每日摘要表初始化完成');
    } catch (error: any) {
      logger.error(`初始化表结构失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 创建或更新每日摘要
   */
  async upsertSummary(input: CreateDailySummaryInput): Promise<DailySummary> {
    const id = this.generateId();
    const failedTasksJson = JSON.stringify(input.failedTasks);
    
    const sql = `
      INSERT INTO daily_summaries 
        (id, date, comments_total, comments_successful, comments_failed, 
         posts_total, posts_successful, posts_failed, failed_tasks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        comments_total = VALUES(comments_total),
        comments_successful = VALUES(comments_successful),
        comments_failed = VALUES(comments_failed),
        posts_total = VALUES(posts_total),
        posts_successful = VALUES(posts_successful),
        posts_failed = VALUES(posts_failed),
        failed_tasks = VALUES(failed_tasks),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await this.insert(sql, [
      id,
      input.date,
      input.commentsTotal,
      input.commentsSuccessful,
      input.commentsFailed,
      input.postsTotal,
      input.postsSuccessful,
      input.postsFailed,
      failedTasksJson,
    ]);
    
    const result = await this.getSummaryByDate(input.date);
    return result!;
  }

  /**
   * 根据日期获取摘要
   */
  async getSummaryByDate(date: string): Promise<DailySummary | null> {
    const sql = `SELECT * FROM daily_summaries WHERE date = ?`;
    const result = await this.queryOne<DailySummary>(sql, [date]);
    return result || null;
  }

  /**
   * 获取最近的摘要
   */
  async getRecentSummaries(days: number): Promise<DailySummary[]> {
    const sql = `
      SELECT * FROM daily_summaries 
      ORDER BY date DESC 
      LIMIT ?
    `;
    return await this.queryMany<DailySummary>(sql, [days]);
  }

  /**
   * 获取指定日期的摘要
   */
  async getSummariesByDateRange(startDate: string, endDate: string): Promise<DailySummary[]> {
    const sql = `
      SELECT * FROM daily_summaries 
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC
    `;
    return await this.queryMany<DailySummary>(sql, [startDate, endDate]);
  }

  private generateId(): string {
    return require('uuid').v4();
  }
}

let instance: DailySummaryStorage | null = null;
export const getDailySummaryStorage = (): DailySummaryStorage => {
  if (!instance) {
    instance = new DailySummaryStorage();
  }
  return instance;
};
export const dailySummaryStorage = getDailySummaryStorage();
