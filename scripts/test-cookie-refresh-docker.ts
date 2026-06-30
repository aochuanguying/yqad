/**
 * 在 Docker 中测试 Cookie 刷新功能
 * 
 * 使用方法:
 * docker exec -it yqad-app npx tsx scripts/test-cookie-refresh-docker.ts
 */

import { CookieScanner } from '../src/services/cookie-refresh/cookie-scanner';
import { NetworkPostConfigStorage } from '../src/storage/mysql/network-post-config-storage';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('test-cookie-refresh');

async function testCookieRefresh() {
  logger.info('🧪 开始测试 Cookie 刷新功能...');
  
  try {
    // 1. 检查当前 Cookie 状态
    logger.info('\n📊 步骤 1: 检查当前 Cookie 状态');
    const storage = NetworkPostConfigStorage.getInstance();
    const status = await storage.getCookieStatus();
    
    logger.info(`   - 是否有 Cookie: ${status.hasCookie ? '✅ 是' : '❌ 否'}`);
    logger.info(`   - 版本号：${status.version}`);
    logger.info(`   - 最后刷新时间：${status.lastRefreshTime || '无'}`);
    logger.info(`   - 下次刷新时间：${status.nextRefreshTime || '无'}`);
    
    // 2. 测试浏览器初始化
    logger.info('\n🌐 步骤 2: 测试浏览器初始化');
    const scanner = CookieScanner.getInstance();
    
    const testStartTime = Date.now();
    try {
      // @ts-ignore - 访问私有方法进行测试
      await scanner.initBrowser();
      logger.info(`   ✅ 浏览器初始化成功，耗时：${Date.now() - testStartTime}ms`);
      
      // 检查持久化目录
      const fs = require('fs');
      const path = require('path');
      const userDataDir = path.join(process.cwd(), 'data', 'browser_user_data', 'xiaohongshu');
      
      if (fs.existsSync(userDataDir)) {
        logger.info(`   ✅ 持久化目录已创建：${userDataDir}`);
        const files = fs.readdirSync(userDataDir);
        logger.info(`   📁 目录内容：${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
      } else {
        logger.warn(`   ⚠️ 持久化目录未创建`);
      }
      
      // 清理浏览器
      // @ts-ignore
      await scanner.cleanup();
      logger.info('   ✅ 浏览器已清理');
    } catch (error) {
      logger.error(`   ❌ 浏览器初始化失败：${error instanceof Error ? error.message : error}`);
    }
    
    // 3. 验证 Cookie（如果存在）
    if (status.hasCookie) {
      logger.info('\n🔍 步骤 3: 验证现有 Cookie 有效性');
      try {
        const { XiaohongshuSearch } = await import('../src/services/internet-search/xiaohongshu-search');
        const searchService = new XiaohongshuSearch();
        const testResult = await searchService.testConnection();
        
        if (testResult.success) {
          logger.info(`   ✅ Cookie 有效！获取到 ${testResult.resultCount} 条结果`);
        } else {
          logger.warn(`   ⚠️ Cookie 可能已失效：${testResult.error}`);
        }
      } catch (error) {
        logger.error(`   ❌ Cookie 验证失败：${error instanceof Error ? error.message : error}`);
      }
    } else {
      logger.info('\n🔍 步骤 3: 跳过 Cookie 验证（无现有 Cookie）');
    }
    
    // 4. 总结
    logger.info('\n📋 测试总结');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✅ 基础功能测试完成');
    logger.info(`📊 当前 Cookie 版本：${status.version}`);
    logger.info(`🕒 最后刷新：${status.lastRefreshTime ? new Date(status.lastRefreshTime).toLocaleString('zh-CN') : '无'}`);
    logger.info(`⏰ 下次刷新：${status.nextRefreshTime ? new Date(status.nextRefreshTime).toLocaleString('zh-CN') : '无'}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('\n💡 提示:');
    logger.info('   - 手动刷新：curl -X POST http://localhost:3000/api/network-post-config/cookie/refresh');
    logger.info('   - 查看状态：curl http://localhost:3000/api/network-post-config/cookie-status');
    logger.info('   - 查看日志：docker logs yqad-app | grep -i cookie');
    
  } catch (error) {
    logger.error('❌ 测试失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// 运行测试
testCookieRefresh().catch(console.error);
