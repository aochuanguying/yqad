import { apiClient } from './api';
import { AuthService } from './services/auth';
import { AutoCommentService } from './services/auto-comment';
import { AutoPostService } from './services/auto-post';
import { createScheduler } from './scheduler';
import { getLogger } from './utils/logger';
import { startWebServer } from './web/server';
import { initializeRedisStorage } from './storage/redis/init';
import { initializeMySQLStorage } from './storage/mysql/init';
import { startChromaHealthMonitoring } from './utils/chroma-health-monitor';
import { disconnectRedis } from './utils/redis-connection-manager';
import { chromaConnectionManager } from './utils/chroma-connection-manager';
import MySQLConnectionManager from './utils/mysql-connection-manager';
import { commentConfigStorage } from './storage/mysql/comment-config-storage';
import { schedulerConfigStorage } from './storage/mysql/scheduler-config-storage';
import { apiConfigStorage } from './storage/mysql/api-config-storage';
import { loadAIProvidersFromDB } from './utils/config';
import { initFallbackChain } from './ai';
import { organizeMaterials } from './services/material-organizer';
import { pendingPostService } from './services/pending-post-service';
import { getCommentLogStorage } from './storage/mysql/comment-log-storage';

const logger = getLogger('main');

async function main() {
  logger.info('=== 一汽奥迪 APP 自动任务系统启动 ===');

  // 1. 先初始化 MySQL（因为 Redis 中的某些服务可能依赖 MySQL）
  try {
    await initializeMySQLStorage();
    // MySQL 初始化完成后，从数据库加载 AI Provider 配置
    await loadAIProvidersFromDB();
  } catch (error) {
    logger.warn('MySQL 初始化失败，将仅使用 Redis 存储:', error);
  }

  // 2. 初始化 AI FallbackChain（必须在 loadAIProvidersFromDB 之后）
  try {
    initFallbackChain();
    logger.info('✓ AI 兜底机制初始化成功');
  } catch (error) {
    logger.warn('AI 兜底机制初始化失败，将使用传统模式:', error);
  }

  // 2. 初始化 Redis 存储（可选，失败时降级到内存存储）
  try {
    await initializeRedisStorage();
  } catch (error) {
    logger.warn('Redis 初始化失败，将使用内存存储:', error);
  }

  // 3. 初始化 ChromaDB（可选，失败时不影响核心功能）
  try {
    await chromaConnectionManager.initialize();
    logger.info('✅ ChromaDB 初始化成功');
  } catch (error) {
    logger.warn('ChromaDB 初始化失败，向量存储功能将不可用:', error instanceof Error ? error.message : String(error));
  }

  // 4. 从数据库读取配置（必须在 MySQL 初始化之后）
  const [apiConfig, commentConfig, schedulerConfig] = await Promise.all([
    apiConfigStorage.getConfig(),
    commentConfigStorage.getConfig(),
    schedulerConfigStorage.getConfig(),
  ]).catch(error => {
    logger.warn('从数据库读取配置失败，将使用默认值:', error instanceof Error ? error.message : String(error));
    return [null, null, null];
  });
  
  logger.info('API 初始化完成，使用真实 API');

  // 启动 ChromaDB 健康监控
  try {
    startChromaHealthMonitoring();
    logger.info('ChromaDB 健康监控已启动');
  } catch (error) {
    logger.warn('ChromaDB 健康监控启动失败:', error);
  }

  // 初始化模块
  const authService = await AuthService.create(apiClient);
  const commentService = new AutoCommentService(apiClient, authService);
  const postService = new AutoPostService(apiClient, authService);

  // 每日结果收集
  let todayCommentResults: any[] = [];



  // 创建调度器
  const scheduler = await createScheduler({
    comment: async () => {
      if (!commentConfig?.enabled) {
        logger.info('自动评论已禁用，跳过');
        return;
      }
      todayCommentResults = await commentService.performDailyComments();
    },
    materialProcessing: async () => {
      if (!schedulerConfig?.materialProcessing.enabled) {
        logger.debug('素材整理已禁用，跳过');
        return;
      }
      await organizeMaterials();
    },
    refreshXiaohongshuCookie: async () => {
      logger.info('🔄 开始自动刷新小红书 Cookie...');
      try {
        const { CookieScanner } = await import('./services/cookie-refresh/cookie-scanner');
        const scanner = CookieScanner.getInstance();
        
        // 智能刷新模式：先检查 Cookie 是否有效，有效才续期，无效则跳过（不扫码）
        const result = await scanner.smartRefreshCookie();
        if (result.success) {
          logger.info(`✅ 小红书 Cookie 自动刷新成功！版本：${result.version}`);
        } else if (result.requiresManualRefresh) {
          // Cookie 失效，需要用户手动刷新
          logger.warn(`⚠️ 小红书 Cookie 已失效，请在 Web 页面手动刷新 Cookie`);
        } else {
          logger.error(`❌ 小红书 Cookie 自动刷新失败：${result.error}`);
        }
      } catch (error) {
        logger.error(`❌ 小红书 Cookie 自动刷新异常：${error instanceof Error ? error.message : error}`);
      }
    },
    refreshZhihuCookie: async () => {
      logger.info('🔄 开始自动刷新知乎 Cookie...');
      try {
        const { ZhihuCookieScanner } = await import('./services/cookie-refresh/zhihu-cookie-scanner');
        const scanner = ZhihuCookieScanner.getInstance();
        
        // 智能刷新模式：先检查 Cookie 是否有效，有效才续期，无效则跳过（不扫码）
        const result = await scanner.smartRefreshCookie();
        if (result.success) {
          logger.info(`✅ 知乎 Cookie 自动刷新成功！版本：${result.version}`);
        } else if (result.requiresManualRefresh) {
          // Cookie 失效，需要用户手动刷新
          logger.warn(`⚠️ 知乎 Cookie 已失效，请在 Web 页面手动刷新 Cookie`);
        } else {
          logger.error(`❌ 知乎 Cookie 自动刷新失败：${result.error}`);
        }
      } catch (error) {
        logger.error(`❌ 知乎 Cookie 自动刷新异常：${error instanceof Error ? error.message : error}`);
      }
    },
  });

  // 启动调度器
  scheduler.start();

  // 初始化发帖日志服务（启动清理定时器）
  const { postLoggingService } = await import('./services/post-logging-service');
  logger.info('发帖日志服务已初始化（清理定时器已启动）');

  // 启动待确认发帖超时清理定时任务（每 10 分钟执行一次）
  setInterval(() => {
    pendingPostService.cleanupExpired().catch((error) => {
      logger.error(`待确认发帖超时清理异常：${error.message}`);
    });
  }, 10 * 60 * 1000);
  logger.info('已启动待确认发帖超时清理定时器（每 10 分钟执行一次）');

  // 启动评论日志定期清理定时任务（每天凌晨 2 点执行，清理 30 天前的日志）
  const commentLogStorage = getCommentLogStorage();
  setInterval(() => {
    const now = new Date();
    const shouldRun = now.getHours() === 2 && now.getMinutes() === 0;
    if (shouldRun) {
      commentLogStorage.deleteExpiredLogs(30).catch((error) => {
        logger.error(`评论日志清理异常：${error.message}`);
      });
    }
  }, 60 * 60 * 1000); // 每小时检查一次，在凌晨 2 点执行
  logger.info('已启动评论日志定期清理定时器（每天凌晨 2 点清理 30 天前的日志）');

  // 启动 Web 管理界面
  startWebServer();

  // 检查并执行今天遗漏的任务
  await scheduler.checkMissedTasks();

  logger.info('系统运行中，等待调度任务...');

  // 优雅退出
  const gracefulShutdown = async (signal: string) => {
    logger.info(`收到${signal}信号，正在优雅退出...`);
    
    // 1. 停止调度器
    scheduler.stop();
    
    // 2. 关闭 MySQL 连接池
    try {
      await MySQLConnectionManager.getInstance().shutdown();
      logger.info('MySQL 连接已关闭');
    } catch (error) {
      logger.error('关闭 MySQL 连接失败:', error);
    }
    
    // 3. 断开 Redis 连接
    try {
      await disconnectRedis();
      logger.info('Redis 连接已关闭');
    } catch (error) {
      logger.error('关闭 Redis 连接失败:', error);
    }
    
    // 4. 关闭 ChromaDB 连接
    try {
      await chromaConnectionManager.close();
      logger.info('ChromaDB 连接已关闭');
    } catch (error) {
      logger.error('关闭 ChromaDB 连接失败:', error);
    }
    
    logger.info('优雅退出完成');
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

// 全局错误处理 - 未捕获异常时退出进程，由进程管理器（如 PM2/Docker）自动重启
process.on('uncaughtException', (error) => {
  logger.error(`[未捕获异常] ${error.message}`);
  logger.error(error.stack);
  logger.error('进程即将退出，将由进程管理器自动重启...');
  // 给日志一点时间写入，然后退出
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(`[未处理 Promise 拒绝] ${error.message}`);
  logger.error(error.stack);
  // 不再强制退出进程，仅记录错误（避免因非致命异步错误导致服务崩溃）
});

main().catch(error => {
  logger.error(`系统启动失败：${error.message}`);
  process.exit(1);
});
