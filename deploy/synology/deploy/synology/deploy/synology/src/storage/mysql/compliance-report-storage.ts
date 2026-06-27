/**
 * 合规性报告 MySQL 存储层
 */

import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('compliance-report-storage');

/**
 * 合规性报告数据库记录
 */
export interface MySQLComplianceReport {
  id: string;
  post_id: string | null;
  title: string;
  content: string;
  topic_id: string | null;
  topic_name: string | null;
  trigger_type: 'auto' | 'manual';
  similarity_check: string | null;  // JSON 字符串
  sensitive_word_check: string | null;  // JSON 字符串
  quality_score: string | null;  // JSON 字符串
  posting_interval_check: string | null;  // JSON 字符串
  passed: number;  // MySQL BOOLEAN 实际上是 TINYINT
  reject_reasons: string | null;  // JSON 字符串
  check_duration: number;
  created_at: Date;
}

/**
 * 创建合规性报告输入
 */
export interface CreateComplianceReportInput {
  id: string;
  postId: string | null;
  title: string;
  content: string;
  topicId: string | null;
  topicName: string | null;
  triggerType: 'auto' | 'manual';
  similarityCheck: any | null;
  sensitiveWordCheck: any | null;
  qualityScore: any | null;
  postingIntervalCheck: any | null;
  passed: boolean;
  rejectReasons: string[];
  checkDuration: number;
}

/**
 * 合规性报告查询选项
 */
export interface ComplianceReportQueryOptions {
  postId?: string;
  topicId?: string;
  passed?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class ComplianceReportStorage {
  /**
   * 创建合规性报告
   */
  async createReport(input: CreateComplianceReportInput): Promise<void> {
    const sql = `
      INSERT INTO compliance_reports (
        id, post_id, title, content, topic_id, topic_name, 
        trigger_type, similarity_check, sensitive_word_check, 
        quality_score, posting_interval_check, passed, 
        reject_reasons, check_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      input.id,
      input.postId,
      input.title,
      input.content,
      input.topicId,
      input.topicName,
      input.triggerType,
      input.similarityCheck ? JSON.stringify(input.similarityCheck) : null,
      input.sensitiveWordCheck ? JSON.stringify(input.sensitiveWordCheck) : null,
      input.qualityScore ? JSON.stringify(input.qualityScore) : null,
      input.postingIntervalCheck ? JSON.stringify(input.postingIntervalCheck) : null,
      input.passed ? 1 : 0,
      input.rejectReasons.length > 0 ? JSON.stringify(input.rejectReasons) : null,
      input.checkDuration,
    ];

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      await connection.execute(sql, params);
      logger.debug(`创建合规性报告：${input.id}`);
    } finally {
      await connection.release();
    }
  }

  /**
   * 根据 ID 获取合规性报告
   */
  async getReportById(id: string): Promise<MySQLComplianceReport | null> {
    const sql = 'SELECT * FROM compliance_reports WHERE id = ?';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql, [id]);
      const result = Array.isArray(rows) ? (rows as any[])[0] : rows;
      return result || null;
    } finally {
      await connection.release();
    }
  }

  /**
   * 根据帖子 ID 获取合规性报告
   */
  async getReportByPostId(postId: string): Promise<MySQLComplianceReport | null> {
    const sql = 'SELECT * FROM compliance_reports WHERE post_id = ? ORDER BY created_at DESC LIMIT 1';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql, [postId]);
      const result = Array.isArray(rows) ? (rows as any[])[0] : rows;
      return result || null;
    } finally {
      await connection.release();
    }
  }

  /**
   * 查询合规性报告
   */
  async queryReports(
    options: ComplianceReportQueryOptions
  ): Promise<{ total: number; reports: MySQLComplianceReport[] }> {
    let sql = 'SELECT * FROM compliance_reports WHERE 1=1';
    const params: any[] = [];

    if (options.postId) {
      sql += ' AND post_id = ?';
      params.push(options.postId);
    }

    if (options.topicId) {
      sql += ' AND topic_id = ?';
      params.push(options.topicId);
    }

    if (options.passed !== undefined) {
      sql += ' AND passed = ?';
      params.push(options.passed ? 1 : 0);
    }

    if (options.startDate) {
      sql += ' AND created_at >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      sql += ' AND created_at <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY created_at DESC';

    const limit = options.limit || 100;
    const offset = options.offset || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql, params);
      const reports = Array.isArray(rows) ? rows : [];

      // 获取总数
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count').replace('LIMIT ? OFFSET ?', '');
      const [countRows] = await connection.execute(countSql, params.slice(0, params.length - 2));
      const total = Array.isArray(countRows) ? (countRows as any)[0]?.count : 0;

      return { total, reports: reports as MySQLComplianceReport[] };
    } finally {
      await connection.release();
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalReports: number;
    passedReports: number;
    rejectedReports: number;
    averageCheckDuration: number;
  }> {
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as rejected,
        AVG(check_duration) as avg_duration
      FROM compliance_reports
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate);
    }

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql, params);
      const stats = Array.isArray(rows) ? (rows as any)[0] : rows;

      return {
        totalReports: parseInt(stats.total) || 0,
        passedReports: parseInt(stats.passed) || 0,
        rejectedReports: parseInt(stats.rejected) || 0,
        averageCheckDuration: parseFloat(stats.avg_duration) || 0,
      };
    } finally {
      await connection.release();
    }
  }

  /**
   * 删除过期的合规性报告
   */
  async deleteExpiredReports(olderThan: Date): Promise<number> {
    const sql = 'DELETE FROM compliance_reports WHERE created_at < ?';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [result] = await connection.execute(sql, [olderThan]);
      const deleted = (result as any).affectedRows || 0;
      logger.info(`删除 ${deleted} 条过期合规性报告`);
      return deleted;
    } finally {
      await connection.release();
    }
  }
}

export const complianceReportStorage = new ComplianceReportStorage();
