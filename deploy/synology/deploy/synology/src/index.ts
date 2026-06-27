import { createApiClient } from './api';
import { AuthService } from './services/auth';
import { AutoCommentService } from './services/auto-comment';
import { AutoPostService } from './services/auto-post';
import { generateDailySummary, checkAlerts, cleanOldLogs } from './services/daily-summary';
import { createScheduler } from './scheduler';
import { loadConfig } from './utils/config';
import { getLogger } from './utils/logger';
import { startWebServer } from './web/server';
import { initializeRedisStorage } from './storage/redis/init';
import { initializeMySQLStorage } from './storage/mysql/init';
import { startChromaHealthMonitoring } from './utils/chroma-health-monitor';
import { disconnectRedis } from './utils/redis-connection-manager';
import { chromaConnectionManager } from './utils/chroma-connection-manager';
import MySQLConnectionManager from './utils/mysql-connection-manager';
import { processMaterials } from './services/material-processing';

const logger = getLogger('main');

async function main() {
  logger.info('=== 一汽奥迪 APP 自动任务系统启动 ===');

  const config = loadConfig();
  logger.info(`API 模式：${config.api.mode}`);

  // 初始化 Redis 存储（可选，失败时降级到内存存储）
  try {
    await initializeRedisStorage();
  } catch (error) {
    logger.warn('Redis 初始化失败，将使用内存存储:', error);
  }

  // 初始化 MySQL 存储（可选，失败时不影响运行）
  try {
    await initializeMySQLStorage();
  } catch (error) {
    logger.warn('MySQL 初始化失败，将仅使用 Redis 存储:', error);
  }

  // 启动 ChromaDB 健康监控
  try {
    startChromaHealthMonitoring();
    logger.info('ChromaDB 健康监控已启动');
  } catch (error) {
    logger.warn('ChromaDB 健康监控启动失败:', error);
  }

  // 初始化模块
  const api = createApiClient();
  const authService = await AuthService.create(api);
  const commentService = new AutoCommentService(api, authService);
  const postService = new AutoPostService(api, authService);

  // 每日结果收集
  let todayCommentResults: any[] = [];
  let todayPostResults: any[] = [];



  // 创建调度器
  const scheduler = createScheduler({
    comment: async () => {
      if (!config.comment.enabled) {
        logger.info('自动评论已禁用，跳过');
        return;
      }
      todayCommentResults = await commentService.performDailyComments();
    },
    post: async () => {
      if (!config.post.enabled) {
        logger.info('自动发帖已禁用，跳过');
        return;
      }
      todayPostResults = await postService.performDailyPosts();

      // 发帖是最后一个任务，完成后生成每日摘要
      await generateDailySummary(todayCommentResults, todayPostResults);
      await checkAlerts();
      await cleanOldLogs();

      // 重置当日计数
      todayCommentResults = [];
      todayPostResults = [];
    },
    materialProcessing: async () => {
      try {
        const r = await processMaterials();
        logger.info(`素材梳理完成：scanned=${r.scanned}, processed=${r.processed}, converted=${r.converted}, copied=${r.copied}, failed=${r.failed}, skipped=${r.skipped}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`素材梳理执行失败：${msg}`);
      }
    },
  });

  // 启动调度器
  scheduler.start();

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
  logger.error('进程即将退出，将由进程管理器自动重启...');
  setTimeout(() => process.exit(1), 1000);
});

main().catch(error => {
  logger.error(`系统启动失败：${error.message}`);
  process.exit(1);
});
