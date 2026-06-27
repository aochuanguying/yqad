import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { CommentResult } from './auto-comment';
import { PostResult } from './auto-post';
import { getDailySummaryStorage, CreateDailySummaryInput } from '../storage/mysql/daily-summary-storage';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('summary');
const dailySummaryStorage = getDailySummaryStorage();

export interface DailySummary {
  date: string;
  comments: {
    total: number;
    successful: number;
    failed: number;
  };
  posts: {
    total: number;
    successful: number;
    failed: number;
  };
  failedTasks: string[];
}

/**
 * 生成每日执行摘要
 */
export async function generateDailySummary(
  commentResults: CommentResult[],
  postResults: PostResult[]
): Promise<DailySummary> {
  const failedTasks: string[] = [];

  // 评论摘要
  const successfulComments = commentResults.filter(r => r.success).length;
  const failedComments = commentResults.filter(r => !r.success);
  failedComments.forEach(r => {
    failedTasks.push(`评论 "${r.postTitle}": ${r.error}`);
  });

  // 发帖摘要
  const successfulPosts = postResults.filter(r => r.success).length;
  const failedPosts = postResults.filter(r => !r.success);
  failedPosts.forEach(r => {
    failedTasks.push(`发帖：${r.error}`);
  });

  const summary: DailySummary = {
    date: new Date().toISOString().split('T')[0],
    comments: {
      total: commentResults.length,
      successful: successfulComments,
      failed: failedComments.length,
    },
    posts: {
      total: postResults.length,
      successful: successfulPosts,
      failed: failedPosts.length,
    },
    failedTasks,
  };

  // 输出摘要日志
  logger.info('=== 每日执行摘要 ===');
  logger.info(`日期：${summary.date}`);
  logger.info(`评论：${successfulComments}/${commentResults.length} 成功`);
  logger.info(`发帖：${successfulPosts}/${postResults.length} 成功`);

  if (failedTasks.length > 0) {
    logger.warn(`失败任务：${failedTasks.join('; ')}`);
  }

  // 保存摘要
  await saveSummary(summary);

  return summary;
}

/**
 * 检查异常状态并告警
 */
export async function checkAlerts(): Promise<void> {
  const summaries = await loadRecentSummaries(2);

  if (summaries.length < 2) return;

  // 检查最近一天异常率
  const latest = summaries[0];
  const totalTasks = latest.comments.total + latest.posts.total;
  const failedCount = latest.comments.failed + latest.posts.failed;
  const failureRate = totalTasks > 0 ? failedCount / totalTasks : 0;

  if (failureRate > 0.5) {
    logger.warn(`⚠️ 告警：任务异常率 ${Math.round(failureRate * 100)}% 超过 50%！请检查系统状态。`);
  }
}

async function saveSummary(summary: DailySummary): Promise<void> {
  try {
    const input: CreateDailySummaryInput = {
      date: summary.date,
      commentsTotal: summary.comments.total,
      commentsSuccessful: summary.comments.successful,
      commentsFailed: summary.comments.failed,
      postsTotal: summary.posts.total,
      postsSuccessful: summary.posts.successful,
      postsFailed: summary.posts.failed,
      failedTasks: summary.failedTasks,
    };
    
    await dailySummaryStorage.upsertSummary(input);
    logger.debug(`已保存每日摘要：${summary.date}`);
  } catch (error) {
    logger.error(`保存每日摘要失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadRecentSummaries(days: number): Promise<DailySummary[]> {
  try {
    const dbSummaries = await dailySummaryStorage.getRecentSummaries(days);
    // 转换数据库记录到服务层接口
    return dbSummaries.map(db => ({
      date: db.date,
      comments: {
        total: db.comments_total,
        successful: db.comments_successful,
        failed: db.comments_failed,
      },
      posts: {
        total: db.posts_total,
        successful: db.posts_successful,
        failed: db.posts_failed,
      },
      failedTasks: db.failed_tasks ? JSON.parse(db.failed_tasks) : [],
    }));
  } catch (error) {
    logger.error(`加载近期摘要失败：${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 清理过期日志文件
 */
export function cleanOldLogs(): void {
  const logDir = path.resolve(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) return;

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 默认保留 30 天
  const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));

  for (const file of files) {
    const filePath = path.join(logDir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      logger.info(`清理过期日志：${file}`);
    }
  }
}
