/**
 * 自由发帖功能测试脚本
 * 
 * 测试互联网参考模式、图片去水印、自由发帖流程
 */

import { createApiClient } from './src/api';
import { AuthService } from './src/services/auth';
import { ContentAnalysisService } from './src/services/content-analysis';
import { AutoPostService } from './src/services/auto-post';
import { loadConfig } from './src/utils/config';
import { getLogger } from './src/utils/logger';

const logger = getLogger('test-free-post');

async function testFreePost() {
  logger.info('=== 开始测试自由发帖功能 ===');
  
  try {
    // 加载配置
    const config = loadConfig();
    logger.info(`API 模式：${config.api.mode}`);
    logger.info(`互联网参考启用：${(config as any).internetReference?.enabled}`);
    logger.info(`去水印功能启用：${(config as any).internetReference?.watermarkRemoval?.enabled}`);
    
    // 初始化服务
    const api = createApiClient();
    const authService = new AuthService(api);
    const analysisService = new ContentAnalysisService(api, authService);
    const postService = new AutoPostService(api, authService, analysisService);
    
    // 获取 Token
    logger.info('正在登录获取 Token...');
    const token = await authService.getAccessToken();
    logger.info(`登录成功，Token: ${token.substring(0, 10)}...`);
    
    // 确保有分析数据
    logger.info('正在获取内容分析数据...');
    const summary = await analysisService.getSummary();
    logger.info(`分析数据：topics=${summary.topics.length}, analyzedIds=${summary.analyzedIds.length}`);
    
    // 测试自由发帖（会触发互联网参考模式）
    logger.info('=== 开始自由发帖测试 ===');
    const result = await (postService as any).postFreeStyle();
    
    logger.info('=== 发帖结果 ===');
    logger.info(`成功：${result.success}`);
    if (result.success) {
      logger.info(`帖子 ID: ${result.postId}`);
      logger.info(`标题：${result.title}`);
      logger.info(`来源：${result.source}`);
      logger.info(`模式：${result.mode}`);
    } else {
      logger.info(`错误：${result.error}`);
    }
    
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`测试失败：${errorMsg}`);
    logger.error(error);
    throw error;
  }
}

// 运行测试
testFreePost()
  .then(() => {
    logger.info('测试完成');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('测试失败');
    logger.error(error);
    process.exit(1);
  });
