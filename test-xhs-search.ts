#!/usr/bin/env node
/**
 * 小红书搜索测试
 */

import { XiaohongshuSearch } from './src/services/internet-search/xiaohongshu-search';

async function test() {
  console.log('=== 小红书搜索测试 ===\n');
  
  const search = new XiaohongshuSearch();
  
  console.log('Cookie 长度:', (search as any).cookie.length);
  console.log('Cookie 前 50 字符:', (search as any).cookie.substring(0, 50));
  
  try {
    const results = await search.search(['美食'], 3);
    console.log(`\n✅ 搜索成功，返回 ${results.length} 条结果`);
    
    if (results.length > 0) {
      console.log('\n前 3 条结果:');
      results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}`);
        console.log(`   作者：${r.author}`);
        console.log(`   URL: ${r.url}`);
      });
    }
  } catch (error) {
    console.error('❌ 搜索失败:', error instanceof Error ? error.message : String(error));
  }
}

test();
