#!/usr/bin/env ts-node
/**
 * 测试知乎 Playwright 内容提取功能
 * 用法：npx ts-node -r dotenv/config scripts/test_zhihu_with_playwright.ts
 */

import { NetworkPostConfigStorage } from '../src/storage/mysql/network-post-config-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';
import { ZhihuSearch } from '../src/services/internet-search/zhihu-search';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('知乎 Playwright 内容提取测试');
  console.log('='.repeat(60) + '\n');

  // 初始化数据库
  console.log('[步骤 0] 初始化数据库...');
  await initializeMySQL();
  console.log('✅ 数据库连接成功\n');

  // 加载 Access Secret
  console.log('[步骤 1] 加载知乎 Access Secret...');
  const storage = NetworkPostConfigStorage.getInstance();
  const config = await storage.getConfig();
  const accessSecret = config?.zhihuAccessSecret || process.env.ZHIHU_ACCESS_SECRET || '';

  if (!accessSecret) {
    console.log('❌ 未找到 Access Secret');
    process.exit(1);
  }

  process.env.ZHIHU_ACCESS_SECRET = accessSecret;
  console.log(`✅ Access Secret: ${accessSecret.substring(0, 10)}...${accessSecret.substring(accessSecret.length - 4)}\n`);

  // 动态 import ZhihuSearch（必须在设置环境变量之后）
  const { ZhihuSearch } = await import('../src/services/internet-search/zhihu-search');

  // 测试搜索
  console.log('[步骤 2] 测试知乎搜索（含 Playwright 正文提取）...');
  console.log('-'.repeat(60));

  const zhihu = new ZhihuSearch();
  const keyword = '奥迪 Q5L 评测';
  const maxResults = 3;

  console.log(`搜索关键词：${keyword}`);
  console.log(`最大结果数：${maxResults}\n`);

  try {
    const results = await zhihu.search([keyword], maxResults);

    if (results.length === 0) {
      console.log('❌ 搜索结果为空');
      process.exit(0);
    }

    console.log(`✅ 搜索成功，返回 ${results.length} 条结果\n`);

    // 展示结果
    results.forEach((result, idx) => {
      console.log(`\n[结果 ${idx + 1}]`);
      console.log(`  标题：${result.title}`);
      console.log(`  作者：${result.author || '未知'}`);
      console.log(`  点赞：${result.likes || 0}  |  评论：${result.comments || 0}`);
      console.log(`  链接：${result.url || '无'}`);
      console.log(`  内容长度：${(result.content || '').length} 字符`);
      console.log(`  图片数量：${(result.imageUrls || []).length} 张`);
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        console.log(`  图片:`);
        result.imageUrls.slice(0, 3).forEach((url: string) => {
          console.log(`    - ${url.substring(0, 80)}...`);
        });
        if (result.imageUrls.length > 3) {
          console.log(`    ... 还有 ${result.imageUrls.length - 3} 张`);
        }
      }

      // 展示内容前 200 字符
      if (result.content) {
        console.log(`  内容摘要：${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
      }
    });

    // 汇总统计
    console.log('\n' + '='.repeat(60));
    console.log('测试汇总');
    console.log('='.repeat(60));
    const totalImages = results.reduce((sum, r) => sum + (r.imageUrls || []).length, 0);
    const withImages = results.filter(r => (r.imageUrls || []).length > 0).length;
    console.log(`总结果数：${results.length}`);
    console.log(`有图片的结果：${withImages}/${results.length}`);
    console.log(`总图片数：${totalImages}`);
    console.log(`平均每张图片：${(totalImages / Math.max(results.length, 1)).toFixed(1)}`);

    console.log('\n✅ 测试完成！\n');

  } catch (error) {
    console.log(`❌ 测试失败：${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main().catch(console.error);
