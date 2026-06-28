import { getLogger } from '../../utils/logger';
import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { aiProviderStorage } from './ai-provider-storage';
import { apiConfigStorage } from './api-config-storage';
import { commentConfigStorage } from './comment-config-storage';
import { postConfigStorage } from './post-config-storage';
import { featuredPostingStorage } from './featured-posting-storage';
import { schedulerConfigStorage } from './scheduler-config-storage';
import { contentLimitsStorage } from './content-limits-storage';
import { internetReferenceStorage } from './internet-reference-storage';
import { contentDeduplicationStorage } from './content-deduplication-storage';
import { sensitiveWordFilterStorage } from './sensitive-word-filter-storage';
import { contentQualityScoringStorage } from './content-quality-scoring-storage';
import { postingIntervalControlStorage } from './posting-interval-control-storage';
import { vehicleMonitorStorage } from './vehicle-monitor-storage';
import { telecomApiStorage } from './telecom-api-storage';
import { autojsApiStorage } from './autojs-api-storage';
import { complianceReportConfigStorage } from './compliance-report-config-storage';
import { mobileSmsStorage } from './mobile-sms-storage';
import { missedCallStorage } from './missed-call-storage';
import { mobileServiceConfigStorage } from './mobile-service-config-storage';
import { dailySummaryStorage } from './daily-summary-storage';
import { topicUsageStorage } from './topic-usage-storage';

const logger = getLogger('mysql-init');

/**
 * 初始化 MySQL 存储（类似 Redis 的初始化方式）
 * 从配置文件读取配置，创建连接池
 */
export async function initializeMySQLStorage(): Promise<void> {
  try {
    logger.info('🚀 开始初始化 MySQL 存储系统...');
    
    const manager = MySQLConnectionManager.getInstance();
    await manager.initialize();
    
    // 初始化 AI Provider 存储
    try {
      await aiProviderStorage.initialize();
    } catch (error) {
      logger.warn('AI Provider 存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化 API 配置存储
    try {
      await apiConfigStorage.initialize();
    } catch (error) {
      logger.warn('API 配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化评论配置存储
    try {
      await commentConfigStorage.initialize();
    } catch (error) {
      logger.warn('评论配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化发帖配置存储
    try {
      await postConfigStorage.initialize();
    } catch (error) {
      logger.warn('发帖配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化精选发帖配置存储
    try {
      await featuredPostingStorage.initialize();
    } catch (error) {
      logger.warn('精选发帖配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化调度器配置存储
    try {
      await schedulerConfigStorage.initialize();
    } catch (error) {
      logger.warn('调度器配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化内容限制配置存储
    try {
      await contentLimitsStorage.initialize();
    } catch (error) {
      logger.warn('内容限制配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化互联网参考配置存储
    try {
      await internetReferenceStorage.initialize();
    } catch (error) {
      logger.warn('互联网参考配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化内容去重配置存储
    try {
      await contentDeduplicationStorage.initialize();
    } catch (error) {
      logger.warn('内容去重配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化敏感词过滤配置存储
    try {
      await sensitiveWordFilterStorage.initialize();
    } catch (error) {
      logger.warn('敏感词过滤配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化内容质量评分配置存储
    try {
      await contentQualityScoringStorage.initialize();
    } catch (error) {
      logger.warn('内容质量评分配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化发帖间隔控制配置存储
    try {
      await postingIntervalControlStorage.initialize();
    } catch (error) {
      logger.warn('发帖间隔控制配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化车辆监控配置存储
    try {
      await vehicleMonitorStorage.initialize();
    } catch (error) {
      logger.warn('车辆监控配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化电信 API 配置存储
    try {
      await telecomApiStorage.initialize();
    } catch (error) {
      logger.warn('电信 API 配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化 AutoJS API 配置存储
    try {
      await autojsApiStorage.initialize();
    } catch (error) {
      logger.warn('AutoJS API 配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化合规性检查报告配置存储
    try {
      await complianceReportConfigStorage.initialize();
    } catch (error) {
      logger.warn('合规性检查报告配置存储初始化失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化手机短信记录存储
    try {
      await mobileSmsStorage.initialize();
    } catch (error) {
      logger.warn('手机短信记录存储初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化未接电话记录存储
    try {
      await missedCallStorage.initialize();
    } catch (error) {
      logger.warn('未接电话记录存储初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化手机服务配置存储
    try {
      await mobileServiceConfigStorage.initialize();
    } catch (error) {
      logger.warn('手机服务配置存储初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化每日摘要存储
    try {
      await dailySummaryStorage.initialize();
    } catch (error) {
      logger.warn('每日摘要存储初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    // 初始化主题使用记录存储
    try {
      await topicUsageStorage.initialize();
    } catch (error) {
      logger.warn('主题使用记录存储初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    logger.info('✅ MySQL 存储系统初始化完成');
  } catch (error: any) {
    logger.error('❌ MySQL 存储系统初始化失败:', error);
    throw error;
  }
}

/**
 * 获取 MySQL 连接管理器
 */
export function getMySQLStorage() {
  return MySQLConnectionManager.getInstance();
}

/**
 * 优雅关闭 MySQL 连接
 */
export async function disconnectMySQL(): Promise<void> {
  const manager = MySQLConnectionManager.getInstance();
  await manager.shutdown();
}
