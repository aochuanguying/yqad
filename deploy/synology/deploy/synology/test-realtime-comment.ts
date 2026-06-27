/**
 * 实时评论测试脚本 - 使用最新的实时分析 + 兜底机制
 * 
 * 用法：
 * 1. 确保 config/local.yaml 中已配置正确的认证信息
 * 2. 运行：npx ts-node test-realtime-comment.ts
 */

import { createApiClient } from './src/api';
import { AuthService } from './src/services/auth';
import { CommentAnalyzer } from './src/services/comment-analyzer';
import { generateComment } from './src/ai/content-generator';
import { loadConfig } from './src/utils/config';
import { getLogger } from './src/utils/logger';
import { initFallbackMechanism, getFallbackHealthStatus } from './src/ai';

const logger = getLogger('test-realtime-comment');
const config = loadConfig();

async function testRealtimeComment() {
  try {
    logger.info('=== 开始测试实时评论功能（使用实时分析 + 兜底机制）===');

    // 初始化兜底机制
    logger.info('初始化 AI 兜底机制...');
    initFallbackMechanism();

    // 初始化服务
    const api = createApiClient();
    const authService = new AuthService(api);

    // 获取 Token
    logger.info('获取访问 Token...');
    const token = await authService.getAccessToken();
    logger.info(`Token 获取成功：${token.substring(0, 20)}...`);

    // 获取帖子列表
    logger.info('获取最新帖子...');
    const { posts } = await api.getPosts(token, 1, 5);
    
    if (!posts || posts.length === 0) {
      logger.error('未获取到帖子，无法测试');
      return;
    }

    // 选择第一篇帖子进行测试
    const testPost = posts[0];
    logger.info(`选择测试帖子：${testPost.title} (ID: ${testPost.id}, Type: ${testPost.contentType})`);

    // 实时分析帖子（不使用 ContentAnalysisService）
    logger.info('实时分析帖子内容...');
    const commentAnalyzer = new CommentAnalyzer();
    const features = commentAnalyzer.analyzePost(testPost);
    
    logger.info(`帖子特征分析完成:`);
    logger.info(`  - 类型：${features.type}`);
    logger.info(`  - 主题：${features.topic}`);
    logger.info(`  - 情感：${features.sentiment}`);
    logger.info(`  - 关键词：${features.keywords.join(', ')}`);
    logger.info(`  - 内容长度：${features.contentLength} 字`);

    // 生成评论（使用实时分析结果）
    logger.info('生成评论内容...');
    const generated = await generateComment(features);

    logger.info(`生成的评论：${generated.content}`);
    logger.info(`评论长度：${generated.content.length} 字`);

    // 发布评论
    logger.info(`发布评论到帖子：${testPost.id}`);
    const response = await api.publishComment(
      token,
      testPost.id,
      generated.content,
      testPost.contentType
    );

    if (response.success) {
      logger.info('✓ 评论发布成功！');
      logger.info(`评论 ID: ${response.commentId}`);
      
      // 显示兜底机制健康状态
      const healthStatus = getFallbackHealthStatus();
      logger.info(`兜底机制健康状态:`);
      for (const [provider, status] of healthStatus.entries()) {
        logger.info(`  ${provider}: ${JSON.stringify(status)}`);
      }
    } else {
      logger.error('✗ 评论发布失败');
    }

    logger.info('=== 测试完成 ===');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`测试失败：${errorMsg}`);
    console.error(error);
  }
}

// 运行测试
testRealtimeComment().catch(console.error);
