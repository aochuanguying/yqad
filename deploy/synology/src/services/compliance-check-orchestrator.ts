/**
 * 合规性检查协调器
 * 
 * 功能：
 * 1. 统一执行所有合规性检查（去重、敏感词、质量评分、发帖间隔）
 * 2. 生成合规性检查报告
 * 3. 提供通过/拒绝决策
 */

import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { contentDeduplicationService, SimilarityCheckResult } from './content-deduplication-service';
import { contentQualityScoringService, ScoringDetails } from './content-quality-scoring-service';
import { postingIntervalControlService, PostingIntervalCheckResult } from './posting-interval-control-service';
import { complianceCheckReportService, ComplianceCheckReport } from './compliance-check-report-service';
import { enhancedSensitiveWordService, EnhancedDetectionResult } from './enhanced-sensitive-word-service';

const logger = getLogger('compliance-check-orchestrator');

/**
 * 合规性检查输入
 */
export interface ComplianceCheckInput {
  title: string;
  content: string;
  imageCount?: number;
  topicId?: string;
  topicName?: string;
  triggerType?: 'auto' | 'manual';
}

/**
 * 合规���检查结果
 */
export interface ComplianceCheckResult {
  passed: boolean;
  similarityCheck?: SimilarityCheckResult;
  sensitiveWordCheck?: EnhancedDetectionResult;
  qualityScore?: ScoringDetails;
  postingIntervalCheck?: PostingIntervalCheckResult;
  rejectReasons: string[];
  reportId?: string;
  filteredTitle?: string;
  filteredContent?: string;
}

/**
 * 合规性检查协调器类
 */
class ComplianceCheckOrchestrator {
  /**
   * 执行完整的合规性检查
   */
  async performComplianceCheck(input: ComplianceCheckInput): Promise<ComplianceCheckResult> {
    const config = loadConfig();
    const result: ComplianceCheckResult = {
      passed: true,
      rejectReasons: [],
    };

    const startTime = Date.now();

    try {
      // 1. 内容去重检查
      if (config.contentDeduplication?.enabled !== false) {
        logger.debug(`开始内容去重检查："${input.title}"`);
        const similarityResult = await contentDeduplicationService.checkSimilarity(input.title, input.content);
        result.similarityCheck = similarityResult;

        if (similarityResult.isDuplicate) {
          result.passed = false;
          result.rejectReasons.push(
            `内容重复度过高 (${(similarityResult.maxSimilarity * 100).toFixed(1)}%)，匹配帖子："${similarityResult.matchedTitle || '未知'}"`
          );
        }
      }

      // 2. 敏感词检查（两级检测：Redis + ChromaDB）
      if (config.sensitiveWordFilter?.enabled !== false) {
        logger.debug(`开始敏感词检查（两级检测）："${input.title}"`);
        
        try {
          // 使用增强服务进行两级检测
          const enhancedResult = await enhancedSensitiveWordService.detectAndReplace(input.content);
          result.sensitiveWordCheck = enhancedResult;
          
          if (!enhancedResult.passed) {
            result.passed = false;
            result.rejectReasons.push(enhancedResult.rejectReason || '敏感词检测未通过');
            logger.warn(`敏感词检测未通过：${enhancedResult.rejectReason}`);
          } else if (enhancedResult.filteredText !== input.content) {
            // 有敏感词但已替换
            result.filteredContent = enhancedResult.filteredText;
            logger.info(`敏感词已自动替换`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`敏感词检查失败：${errorMsg}`);
          // 检测失败不拒绝，仅记录错误
          result.rejectReasons.push(`敏感词检查异常：${errorMsg}`);
        }
      }

      // 3. 内容质量评分
      if (config.contentQualityScoring?.enabled !== false) {
        logger.debug(`开始内容质量评分："${input.title}"`);
        const qualityScore = await contentQualityScoringService.calculateScore({
          title: input.title,
          content: result.filteredContent || input.content,
          imageCount: input.imageCount,
          similarityScore: result.similarityCheck?.maxSimilarity,
        });
        result.qualityScore = qualityScore;

        const minScore = config.contentQualityScoring?.minScore || 60;
        if (qualityScore.finalScore < minScore) {
          result.passed = false;
          result.rejectReasons.push(
            `内容质量评分过低 (${qualityScore.finalScore}/${minScore})，等级：${qualityScore.level}`
          );
        }
      }

      // 4. 发帖间隔检查（如果有主题）
      if (config.postingIntervalControl?.enabled !== false && input.topicId) {
        logger.debug(`开始发帖间隔检查：主题 "${input.topicName || input.topicId}"`);
        const intervalResult = await postingIntervalControlService.checkPostingInterval(
          input.topicId,
          input.topicName
        );
        result.postingIntervalCheck = intervalResult;

        if (!intervalResult.allowed) {
          // 检查是否可以紧急豁免
          if (intervalResult.canOverride && input.triggerType === 'manual') {
            logger.warn(`发帖间隔不足但允许紧急豁免：主题 "${input.topicName || input.topicId}"`);
            // 记录警告但不拒绝
          } else {
            result.passed = false;
            result.rejectReasons.push(`发帖间隔不足：${intervalResult.reason}`);
          }
        }
      }

      // 5. 生成合规性检查报告
      if (config.complianceCheckReport?.enabled !== false) {
        const report: Omit<ComplianceCheckReport, 'id' | 'createdAt'> = {
          postId: this.generatePostId(),
          title: input.title,
          content: input.content,
          topicId: input.topicId,
          topicName: input.topicName,
          triggerType: input.triggerType || 'auto',
          similarityCheck: result.similarityCheck,
          sensitiveWordCheck: result.sensitiveWordCheck,
          qualityScore: result.qualityScore,
          postingIntervalCheck: result.postingIntervalCheck,
          passed: result.passed,
          rejectReasons: result.rejectReasons,
          checkDuration: Date.now() - startTime,
        };

        const reportId = await complianceCheckReportService.saveReport(report);
        result.reportId = reportId;
      }

      const duration = Date.now() - startTime;
      logger.info(
        `合规性检查完成：${result.passed ? '通过' : '拒绝'} (${duration}ms) - ` +
        `${result.rejectReasons.length > 0 ? '原因：' + result.rejectReasons.join('; ') : '所有内容检查项通过'}`
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`合规性检查失败：${errorMsg}`);
      
      // 检查失败时的降级策略：记录错误但允许通过（避免阻塞发帖）
      return {
        passed: true,
        rejectReasons: [`合规性检查异常：${errorMsg}`],
      };
    }
  }

  /**
   * 批量执行合规性检查
   */
  async batchPerformComplianceCheck(inputs: ComplianceCheckInput[]): Promise<ComplianceCheckResult[]> {
    return Promise.all(inputs.map(input => this.performComplianceCheck(input)));
  }

  /**
   * 生成帖子 ID（简化版）
   */
  private generatePostId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// 导出单例
export const complianceCheckOrchestrator = new ComplianceCheckOrchestrator();
