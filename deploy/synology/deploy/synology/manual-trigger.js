const { createApiClient } = require('./dist/api');
const { AuthService } = require('./dist/services/auth');
const { AutoPostService } = require('./dist/services/auto-post');
const { loadConfig } = require('./dist/utils/config');
const { getLogger } = require('./dist/utils/logger');

const logger = getLogger('manual-trigger');

async function triggerPost() {
  logger.info('=== 手动触发发帖任务 ===');
  
  try {
    const config = loadConfig();
    config.post.enabled = true;
    config.post.dailyLimit = 1;
    
    const api = createApiClient();
    const authService = new AuthService(api);
    const postService = new AutoPostService(api, authService);
    
    logger.info('开始执行发帖...');
    const results = await postService.performDailyPosts();
    
    logger.info(`发帖完成：成功 ${results.filter(r => r.success).length}/${results.length} 条`);
    for (const result of results) {
      if (result.success) {
        logger.info(`✓ 发帖成功：${result.title}`);
        logger.info(`  - Post ID: ${result.postId}`);
        logger.info(`  - Mode: ${result.mode}`);
        if (result.featuredReadiness) {
          logger.info(`  - Featured: ${result.featuredReadiness.eligible ? 'Yes' : 'No'}`);
        }
      } else {
        logger.error(`✗ 发帖失败：${result.error}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    logger.error(`任务执行失败：${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

triggerPost();
