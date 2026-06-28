#!/usr/bin/env ts-node
/**
 * 测试小红书笔记详情获取功能
 * 用法：npx ts-node scripts/test_xiaohongshu_detail.ts
 */

import { XiaohongshuSearch } from '../src/services/internet-search/xiaohongshu-search';
import { loadConfig } from '../src/utils/config';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('小红书笔记详情获取测试');
  console.log('='.repeat(60) + '\n');

  // 加载配置
  const config = loadConfig();
  const cookie = process.env.XIAOHONGSHU_COOKIE || config.internetSearch?.xiaohongshuCookie;

  if (!cookie) {
    console.error('❌ 错误：未找到小红书 Cookie');
    console.log('\n请在配置文件中设置 internetSearch.xiaohongshuCookie');
    console.log('或设置环境变量 XIAOHONGSHU_COOKIE\n');
    process.exit(1);
  }

  console.log('✅ Cookie 已加载');
  console.log(`   Cookie: ${cookie.substring(0, 50)}...\n`);

  // 创建搜索服务实例
  const xiaohongshu = new XiaohongshuSearch();

  // 测试 1: 先搜索获取笔记
  console.log('[测试 1] 搜索笔记...');
  console.log('-'.repeat(60));
  
  const searchKeyword = '汽车评测';
  console.log(`搜索关键词：${searchKeyword}`);
  
  try {
    const searchResults = await xiaohongshu.search([searchKeyword], 3);
    
    if (searchResults.length === 0) {
      console.log('❌ 搜索结果为空');
      return;
    }
    
    console.log(`✅ 搜索成功，找到 ${searchResults.length} 条结果\n`);
    
    searchResults.forEach((result, idx) => {
      console.log(`[${idx + 1}] ${result.title}`);
      console.log(`    作者：${result.author}`);
      console.log(`    点赞：${result.likes}`);
      console.log(`    链接：${result.url}`);
      console.log();
    });

    // 测试 2: 获取第一条笔记的详情
    if (searchResults.length > 0) {
      const firstNote = searchResults[0];
      const noteId = firstNote.url?.split('/').pop() || '';
      
      if (!noteId) {
        console.log('❌ 无法从搜索结果中提取笔记 ID');
        return;
      }
      
      console.log('\n[测试 2] 获取笔记详情...');
      console.log('-'.repeat(60));
      console.log(`笔记 ID: ${noteId}`);
      
      const detailResult = await xiaohongshu.getNoteDetail(noteId);
      
      if (detailResult.success && detailResult.data) {
        console.log('\n✅ 笔记详情获取成功！\n');
        console.log('='.repeat(60));
        
        const data = detailResult.data;
        console.log(`标题：${data.title}`);
        console.log(`作者：${data.author}`);
        console.log(`内容：${data.content.substring(0, 200)}${data.content.length > 200 ? '...' : ''}`);
        console.log(`点赞：${data.likes}`);
        console.log(`收藏：${data.collects}`);
        console.log(`评论：${data.comments}`);
        console.log(`图片数量：${data.images?.length || 0}`);
        console.log(`链接：${data.url}`);
        console.log('='.repeat(60));
      } else {
        console.log('\n❌ 详情获取失败');
        console.log(`错误信息：${detailResult.error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : error);
  }

  console.log('\n测试完成\n');
}

main().catch(console.error);
