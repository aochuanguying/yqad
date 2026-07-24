/**
 * 合规性检查报告服务
 * 
 * 功能：
 * 1. 生成和保存合规性检查报告
 * 2. 报告查询（按帖子 ID、按时间范围、按状态）
 * 3. 报告统计（通过率、平均评分、拒绝原因分布）
 * 4. 过期报告定期清理
 */

import { getLogger } from '../utils/logger';
import { SimilarityCheckResult } from './content-deduplication-service';
import { SensitiveWordDetectionResult } from './sensitive-word-filter-service';
import { EnhancedDetectionResult } from './enhanced-sensitive-word-service';
import { ScoringDetails } from './content-quality-scoring-service';
import { PostingIntervalCheckResult } from './posting-interval-control-service';
import { complianceReportStorage, CreateComplianceReportInput, MySQLComplianceReport } from '../storage/mysql/compliance-report-storage';
import { getComplianceReportConfigStorage } from '../storage/mysql/compliance-report-config-storage';

const logger = getLogger('compliance-check-report');

/**
 * 合规性检查报告
 */
export interface ComplianceCheckReport {
  id: string;
  createdAt: string;
  postId: string;
  title: string;
  content: string;
  topicId?: string;
  topicName?: string;
  triggerType: 'auto' | 'manual';
  similarityCheck?: SimilarityCheckResult;
  sensitiveWordCheck?: EnhancedDetectionResult;
  qualityScore?: ScoringDetails;
  postingIntervalCheck?: PostingIntervalCheckResult;
  passed: boolean;
  rejectReasons: string[];
  checkDuration: number;
}

/**
 * 报告查询选项
 */
export interface ReportQueryOptions {
  postId?: string;
  startDate?: string;
  endDate?: string;
  passed?: boolean;
  topicId?: string;
  limit?: number;
  offset?: number;
}

/**
 * 报告统计信息
 */
export interface ReportStatistics {
  totalReports: number;
  passedReports: number;
  rejectedReports: number;
  passRate: number;
  averageScore?: number;
  averageCheckDuration: number;
  rejectReasonsDistribution: Array<{
    reason: string;
    count: number;
  }>;
}

/**
 * 合规性检查报告服务类
 */
class ComplianceCheckReportService {
  private lastCleanupTime = 0;
  private cleanupInterval = 24 * 60 * 60 * 1000; // 24 小时清理一次

  constructor() {
    logger.info('合规性检查报告服务已初始化（使用 MySQL 存储）');
  }

  /**
   * 保存报告
   */
  async saveReport(report: Omit<ComplianceCheckReport, 'id' | 'createdAt'>): Promise<string> {
    const id = `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const input: CreateComplianceReportInput = {
      id,
      postId: report.postId,
      title: report.title,
      content: report.content,
      topicId: report.topicId || null,
      topicName: report.topicName || null,
      triggerType: report.triggerType,
      similarityCheck: report.similarityCheck || null,
      sensitiveWordCheck: report.sensitiveWordCheck || null,
      qualityScore: report.qualityScore || null,
      postingIntervalCheck: report.postingIntervalCheck || null,
      passed: report.passed,
      rejectReasons: report.rejectReasons,
      checkDuration: report.checkDuration,
    };

    try {
      await complianceReportStorage.createReport(input);
      logger.debug(`已保存合规性检查报告：${id}`);
      return id;
    } catch (error) {
      logger.error(`保存合规性检查报告失败：${error instanceof Error ? error.message : String(error)}`);
      return id;
    }
  }

  /**
   * 查询单个报告
   */
  async getReport(reportId: string): Promise<ComplianceCheckReport | null> {
    try {
      const mysqlReport = await complianceReportStorage.getReportById(reportId);
      if (!mysqlReport) {
        return null;
      }
      return this.convertToReport(mysqlReport);
    } catch (error) {
      logger.error(`读取报告失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 查询报告列表
   */
  async queryReports(options: ReportQueryOptions = {}): Promise<{
    reports: ComplianceCheckReport[];
    total: number;
  }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const startDate = options.startDate ? new Date(options.startDate) : undefined;
    const endDate = options.endDate ? new Date(options.endDate) : undefined;

    try {
      const result = await complianceReportStorage.queryReports({
        postId: options.postId,
        topicId: options.topicId,
        passed: options.passed,
        startDate,
        endDate,
        limit,
        offset,
      });

      const reports = result.reports.map(r => this.convertToReport(r));
      return { reports, total: result.total };
    } catch (error) {
      logger.error(`查询报告失败：${error instanceof Error ? error.message : String(error)}`);
      return { reports: [], total: 0 };
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics(options: { startDate?: string; endDate?: string } = {}): Promise<ReportStatistics> {
    const startDate = options.startDate ? new Date(options.startDate) : undefined;
    const endDate = options.endDate ? new Date(options.endDate) : undefined;

    try {
      const stats = await complianceReportStorage.getStatistics(startDate, endDate);
      
      // 获取详细报告用于计算评分和拒绝原因分布
      const { reports } = await this.queryReports({
        startDate: options.startDate,
        endDate: options.endDate,
        limit: 10000,
      });

      const passRate = stats.totalReports > 0 
        ? (stats.passedReports / stats.totalReports) * 100 
        : 0;

      // 计算平均评分
      const scores = reports
        .filter(r => r.qualityScore)
        .map(r => r.qualityScore!.finalScore);
      const averageScore = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : undefined;

      // 统计拒绝原因分布
      const reasonMap = new Map<string, number>();
      for (const report of reports) {
        for (const reason of report.rejectReasons) {
          const simplifiedReason = reason.split(',')[0].trim();
          reasonMap.set(simplifiedReason, (reasonMap.get(simplifiedReason) || 0) + 1);
        }
      }

      const rejectReasonsDistribution = Array.from(reasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalReports: stats.totalReports,
        passedReports: stats.passedReports,
        rejectedReports: stats.rejectedReports,
        passRate,
        averageScore,
        averageCheckDuration: stats.averageCheckDuration,
        rejectReasonsDistribution,
      };
    } catch (error) {
      logger.error(`获取统计信息失败：${error instanceof Error ? error.message : String(error)}`);
      return {
        totalReports: 0,
        passedReports: 0,
        rejectedReports: 0,
        passRate: 0,
        averageCheckDuration: 0,
        rejectReasonsDistribution: [],
      };
    }
  }

  /**
   * 清理过期报告
   */
  async cleanupExpiredReports(): Promise<void> {
    let retainDays = 30;
    try {
      const reportConfig = await getComplianceReportConfigStorage().getConfig();
      if (reportConfig) {
        retainDays = reportConfig.retainDays || 30;
      }
    } catch (error: any) {
      // 使用默认值
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retainDays);

    try {
      await complianceReportStorage.deleteExpiredReports(cutoffDate);
    } catch (error) {
      logger.error(`清理过期报告失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 转换 MySQL 记录到应用层格式
   */
  private convertToReport(mysql: MySQLComplianceReport): ComplianceCheckReport {
    return {
      id: mysql.id,
      createdAt: mysql.created_at.toISOString(),
      postId: mysql.post_id || '',
      title: mysql.title,
      content: mysql.content,
      topicId: mysql.topic_id || undefined,
      topicName: mysql.topic_name || undefined,
      triggerType: mysql.trigger_type,
      similarityCheck: mysql.similarity_check ? JSON.parse(mysql.similarity_check) : undefined,
      sensitiveWordCheck: mysql.sensitive_word_check ? JSON.parse(mysql.sensitive_word_check) : undefined,
      qualityScore: mysql.quality_score ? JSON.parse(mysql.quality_score) : undefined,
      postingIntervalCheck: mysql.posting_interval_check ? JSON.parse(mysql.posting_interval_check) : undefined,
      passed: mysql.passed === 1,
      rejectReasons: mysql.reject_reasons ? JSON.parse(mysql.reject_reasons) : [],
      checkDuration: mysql.check_duration,
    };
  }
}

// 导出单例
export const complianceCheckReportService = new ComplianceCheckReportService();
