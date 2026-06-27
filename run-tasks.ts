import { createApiClient } from './src/api';
import { AuthService } from './src/services/auth';
import { AutoCommentService } from './src/services/auto-comment';
import { AutoPostService } from './src/services/auto-post';
import { loadConfig } from './src/utils/config';
import { getLogger } from './src/utils/logger';

const logger = getLogger('run-tasks');

async function runTasks(): Promise<void> {
  logger.info('=== 手动执行发帖与回帖任务 ===');

  const config = loadConfig();
  logger.info(`API 模式：${config.api.mode}`);

  // 临时启用发帖和回帖
  config.comment.enabled = true;
  config.post.enabled = true;

  // 初始化模块
  const api = createApiClient();
  const authService = new AuthService(api);
  const commentService = new AutoCommentService(api, authService);
  const postService = new AutoPostService(api, authService);

  try {
    // 先执行回帖
    logger.info('\n=== 开始执行回帖任务 ===');
    const commentResults = await commentService.performDailyComments();
    logger.info(`\n回帖完成：成功 ${commentResults.filter(r => r.success).length}/${commentResults.length} 条`);
    for (const result of commentResults) {
      if (result.success) {
        logger.info(`✓ 回帖成功：${result.postTitle}`);
      } else {
        logger.error(`✗ 回帖失败：${result.postTitle} - ${result.error}`);
      }
    }

    // 再执行发帖
    logger.info('\n=== 开始执行发帖任务 ===');
    const postResults = await postService.performDailyPosts();
    logger.info(`\n发帖完成：成功 ${postResults.filter(r => r.success).length}/${postResults.length} 条`);
    for (const result of postResults) {
      if (result.success) {
        logger.info(`✓ 发帖成功：${result.title} (ID: ${result.postId}, Mode: ${result.mode})`);
      } else {
        logger.error(`✗ 发帖失败：${result.error}`);
      }
    }

    logger.info('\n=== 所有任务执行完毕 ===');
  } catch (error) {
    logger.error(`任务执行失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

runTasks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
