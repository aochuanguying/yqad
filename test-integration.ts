#!/usr/bin/env node
/**
 * 互联网搜索集成测试
 * 测试知乎和小红书搜索服务是否正常集成
 */

import { internetSearchManager } from './src/services/internet-search/search-manager';
import { getLogger } from './src/utils/logger';

const logger = getLogger('test-integration');

async function testSearch() {
  console.log('=== 互联网搜索集成测试 ===\n');
  
  try {
    // 测试 1: 获取可用平台
    console.log('测试 1: 获取可用平台');
    const platforms = await internetSearchManager.getAvailablePlatforms();
    console.log(`✅ 找到 ${platforms.length} 个可用平台:`);
    platforms.forEach(p => {
      console.log(`   - ${p.getPlatformDisplayName()} (${p.getPlatformName()})`);
    });
    console.log();
    
    // 测试 2: 测试知乎搜索
    console.log('测试 2: 测试知乎搜索');
    const zhihuPlatform = platforms.find(p => p.getPlatformName() === 'zhihu');
    if (zhihuPlatform) {
      try {
        const zhihuResults = await zhihuPlatform.search(['美食'], 3);
        console.log(`✅ 知乎搜索成功，找到 ${zhihuResults.length} 条结果`);
        if (zhihuResults.length > 0) {
          console.log(`   示例：${zhihuResults[0].title}`);
        }
      } catch (error) {
        console.log(`❌ 知乎搜索失败：${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log('⚠️  知乎平台不可用');
    }
    console.log();
    
    // 测试 3: 测试小红书搜索
    console.log('测试 3: 测试小红书搜索');
    const xiaohongshuPlatform = platforms.find(p => p.getPlatformName() === 'xiaohongshu');
    if (xiaohongshuPlatform) {
      try {
        const xiaohongshuResults = await xiaohongshuPlatform.search(['美食'], 3);
        console.log(`✅ 小红书搜索成功，找到 ${xiaohongshuResults.length} 条结果`);
        if (xiaohongshuResults.length > 0) {
          console.log(`   示例：${xiaohongshuResults[0].title}`);
        }
      } catch (error) {
        console.log(`❌ 小红书搜索失败：${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log('⚠️  小红书平台不可用');
    }
    console.log();
    
    // 测试 4: 使用管理器搜索（轮询策略）
    console.log('测试 4: 使用搜索管理器（轮询策略）');
    const managerResults = await internetSearchManager.search(['美食'], 3);
    console.log(`✅ 管理器搜索成功，找到 ${managerResults.length} 条结果`);
    if (managerResults.length > 0) {
      console.log(`   示例：${managerResults[0].title} (${managerResults[0].source})`);
    }
    console.log();
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    logger.error('测试失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 运行测试
testSearch().catch(error => {
  logger.error('测试异常:', error);
  process.exit(1);
});
