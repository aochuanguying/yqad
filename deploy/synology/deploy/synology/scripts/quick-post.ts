#!/usr/bin/env ts-node
/**
 * 快速测试发帖脚本
 * 用于真实环境发布一个普通帖子
 */

import { createApiClient } from '../src/api';
import { AuthService } from '../src/services/auth';
import { loadConfig } from '../src/utils/config';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('quick-post');

async function quickPost() {
  logger.info('=== 开始发布测试帖子 ===');
  
  try {
    const config = loadConfig();
    
    // 初始化 API 和认证服务
    const api = createApiClient();
    const authService = new AuthService(api);
    
    // 获取 access token（自动使用已存储的或重新登录）
    logger.info('获取 access token...');
    await authService.getAccessToken();
    const token = await authService.getAccessToken();
    logger.info('Token 获取成功');
    
    // 发布一个普通帖子
    const title = '日常分享 - 我的用车体验';
    const content = '今天天气不错，开车出去兜风。这辆车的驾驶感受真的很棒，加速平顺，操控也很精准。特别是座椅舒适度，长途驾驶也不会觉得累。大家觉得自己的车最满意的地方是什么呢？';
    
    logger.info(`发布帖子：${title}`);
    const result = await api.publishPost(token, title, content);
    
    // 输出结果
    if (result.success) {
      logger.info('✅ 发帖成功！');
      logger.info(`帖子 ID: ${result.postId}`);
      logger.info(`标题：${title}`);
    } else {
      logger.error('❌ 发帖失败');
      logger.error(`错误码：${result.code}`);
      logger.error(`错误信息：${result.message}`);
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    logger.error('发帖任务执行失败', error);
    process.exit(1);
  }
}

// 执行
quickPost();
