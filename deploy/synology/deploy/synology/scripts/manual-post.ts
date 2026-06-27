#!/usr/bin/env ts-node
/**
 * 手动触发发帖脚本
 * 用于真实环境测试发帖功能
 */

import { createApiClient } from '../src/api';
import { AuthService } from '../src/services/auth';
import { AutoPostService } from '../src/services/auto-post';
import { loadConfig } from '../src/utils/config';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('manual-post');

async function manualPost() {
  logger.info('=== 开始手动触发发帖任务 ===');
  
  try {
    const config = loadConfig();
    
    // 初始化 API 和认证服务
    const api = createApiClient();
    const authService = new AuthService(api);
    
    // 获取 access token（自动使用已存储的或重新登录）
    logger.info('获取 access token...');
    await authService.getAccessToken();
    logger.info('Token 获取成功');
    
    // 创建自动发帖服务
    const autoPostService = new AutoPostService(api, authService);
    
    // 执行发帖
    logger.info('正在执行发帖任务...');
    const results = await autoPostService.performDailyPosts();
    
    // 输出结果
    logger.info('=== 发帖任务完成 ===');
    results.forEach((result, index) => {
      logger.info(`帖子 ${index + 1}: ${result.success ? '成功' : '失败'}`);
      if (result.success) {
        logger.info(`  - 标题：${result.title}`);
        logger.info(`  - ID: ${result.postId}`);
        logger.info(`  - 模式：${result.mode}`);
      } else {
        logger.error(`  - 错误：${result.error}`);
      }
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('发帖任务执行失败', error);
    process.exit(1);
  }
}

// 执行
manualPost();
