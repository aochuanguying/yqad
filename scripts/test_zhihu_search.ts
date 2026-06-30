#!/usr/bin/env ts-node
/**
 * 知乎搜索 & 帖子详情获取全流程测试
 * 用法：npx ts-node -r dotenv/config scripts/test_zhihu_search.ts
 */

import { NetworkPostConfigStorage } from '../src/storage/mysql/network-post-config-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('知乎搜索 & 帖子详情获取全流程测试');
  console.log('='.repeat(60) + '\n');

  // 初始化数据库连接
  console.log('[步骤 0] 初始化数据库连接...');
  try {
    await initializeMySQL();
    console.log('✅ 数据库连接成功\n');
  } catch (error) {
    console.log('❌ 数据库连接失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // ============================================================
  // 步骤 1：加载知乎 Access Secret
  // ============================================================
  console.log('[步骤 1] 加载知乎 Access Secret...');
  console.log('-'.repeat(60));

  let accessSecret = process.env.ZHIHU_ACCESS_SECRET || '';

  // 如果环境变量没有，尝试从数据库读取
  if (!accessSecret) {
    console.log('环境变量 ZHIHU_ACCESS_SECRET 未设置，尝试从数据库读取...');
    try {
      const storage = NetworkPostConfigStorage.getInstance();
      const config = await storage.getConfig();
      if (config && config.zhihuAccessSecret) {
        accessSecret = config.zhihuAccessSecret;
        console.log('✅ 从数据库加载 Access Secret 成功');
        // 必须在 import ZhihuSearch 之前设置环境变量（模块顶层读取）
        process.env.ZHIHU_ACCESS_SECRET = accessSecret;
      } else {
        console.log('❌ 数据库中未找到知乎 Access Secret');
      }
    } catch (error) {
      console.log('❌ 从数据库读取失败:', error instanceof Error ? error.message : error);
    }
  } else {
    console.log('✅ 从环境变量加载 Access Secret 成功');
  }

  if (!accessSecret) {
    console.log('\n⚠️  未配置知乎 Access Secret，测试终止。');
    console.log('请在 Web 管理界面或数据库中配置知乎 Access Secret。\n');
    process.exit(1);
  }

  console.log(`   Access Secret: ${accessSecret.substring(0, 10)}...${accessSecret.substring(accessSecret.length - 4)}\n`);

  // 动态 import ZhihuSearch（必须在设置环境变量之后）
  const { ZhihuSearch } = await import('../src/services/internet-search/zhihu-search');

  // ============================================================
  // 步骤 2：测试知乎搜索
  // ============================================================
  console.log('[步骤 2] 知乎搜索测试');
  console.log('-'.repeat(60));

  const zhihu = new ZhihuSearch();

  // 测试多种搜索词
  const testKeywords = [
    ['如何评价奥迪 Q5L'],
    ['奥迪 Q5L 对比宝马 X3'],
    ['奥迪用车体验'],
  ];

  let allResults: any[] = [];

  for (const keywords of testKeywords) {
    const keyword = keywords[0];
    console.log(`\n🔍 搜索关键词：「${keyword}」`);

    try {
      const results = await zhihu.search(keywords, 5);

      if (results.length === 0) {
        console.log('   ⚠️  搜索结果为空');
        continue;
      }

      console.log(`   ✅ 找到 ${results.length} 条结果：\n`);

      results.forEach((result: any, idx: number) => {
        console.log(`   [${idx + 1}] ${result.title}`);
        console.log(`       作者：${result.author || '未知'}`);
        console.log(`       点赞：${result.likes || 0}  |  评论：${result.comments || 0}`);
        console.log(`       链接：${result.url || '无'}`);
        if (result.metadata) {
          console.log(`       类型：${result.metadata.contentType || '未知'}  |  权威等级：${result.metadata.authorityLevel || '无'}`);
          console.log(`       内容ID：${result.metadata.contentId || '无'}`);
        }
        console.log(`       内容摘要：${(result.content || '').substring(0, 100)}${(result.content || '').length > 100 ? '...' : ''}`);
        console.log();
      });

      allResults = allResults.concat(results);
    } catch (error) {
      console.log(`   ❌ 搜索失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (allResults.length === 0) {
    console.log('\n⚠️  所有搜索词均无结果，跳过详情测试。\n');
    process.exit(0);
  }

  // ============================================================
  // 步骤 3：测试获取帖子详情
  // ============================================================
  console.log('\n[步骤 3] 帖子详情获取测试');
  console.log('-'.repeat(60));

  // 取第一条有 URL 的结果
  const firstResult = allResults.find((r: any) => r.url);
  if (!firstResult) {
    console.log('⚠️  搜索结果中没有可用的 URL，跳过详情测试。\n');
    process.exit(0);
  }

  console.log(`\n📄 获取帖子详情：`);
  console.log(`   标题：${firstResult.title}`);
  console.log(`   URL：${firstResult.url}`);
  console.log(`   内容ID：${firstResult.metadata?.contentId || '无'}\n`);

  // 知乎 API 搜索结果中已包含 ContentText，这里展示完整内容
  console.log('='.repeat(60));
  console.log('【完整内容】');
  console.log('='.repeat(60));
  console.log(firstResult.content || '(内容为空)');
  console.log('='.repeat(60));

  // 如果有 contentId，尝试通过知乎开放平台 API 获取更详细的信息
  if (firstResult.metadata?.contentId) {
    console.log('\n[步骤 4] 尝试通过内容 ID 获取更详细信息...');
    console.log('-'.repeat(60));

    try {
      const contentId = firstResult.metadata.contentId;
      const timestamp = Math.floor(Date.now() / 1000);

      // 知乎开放平台内容详情 API（如果存在）
      const detailUrl = `https://developer.zhihu.com/api/v1/content/${contentId}`;

      console.log(`   请求 URL: ${detailUrl}`);

      const response = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessSecret}`,
          'X-Request-Timestamp': timestamp.toString(),
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: any = await response.json();
        console.log('   ✅ 详情获取成功！');
        console.log(`   Code: ${data.Code}`);
        if (data.Data) {
          console.log(JSON.stringify(data.Data, null, 2).substring(0, 1000));
        }
      } else {
        console.log(`   ⚠️  HTTP ${response.status} - 知乎开放平台可能不支持内容详情 API`);
        console.log('   搜索结果中的 ContentText 即为可用内容。');
      }
    } catch (error) {
      console.log(`   ⚠️  详情获取失败: ${error instanceof Error ? error.message : error}`);
      console.log('   搜索结果中的 ContentText 即为可用内容。');
    }
  }

  // ============================================================
  // 步骤 5：汇总统计
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('测试汇总');
  console.log('='.repeat(60));
  console.log(`总搜索结果数：${allResults.length}`);
  console.log(`有 URL 的结果：${allResults.filter((r: any) => r.url).length}`);
  console.log(`有内容的结果：${allResults.filter((r: any) => r.content).length}`);
  console.log(`平均点赞数：${(allResults.reduce((sum: number, r: any) => sum + (r.likes || 0), 0) / Math.max(allResults.length, 1)).toFixed(1)}`);
  console.log(`平均评论数：${(allResults.reduce((sum: number, r: any) => sum + (r.comments || 0), 0) / Math.max(allResults.length, 1)).toFixed(1)}`);

  console.log('\n✅ 测试完成！\n');
}

main().catch((error) => {
  console.error('\n❌ 测试异常:', error);
  process.exit(1);
});
