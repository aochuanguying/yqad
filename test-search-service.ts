// 测试搜索服务
import { InternetSearchManager } from './src/services/internet-search/search-manager';

async function testSearch() {
  console.log('🔍 开始测试搜索服务...\n');
  
  const manager = new InternetSearchManager();
  
  // 测试搜索
  const keywords = ['奥迪 Q5L', '油耗'];
  console.log(`🔎 搜索关键词：${keywords.join(' ')}`);
  
  try {
    const results = await manager.search(keywords, 3);
    console.log(`\n✅ 搜索成功，找到 ${results.length} 条结果:\n`);
    
    if (results.length === 0) {
      console.log('⚠️  未找到结果，可能是 API 限流或 Cookie 过期');
    } else {
      results.forEach((result, index) => {
        console.log(`${index + 1}. [${result.platform}] ${result.title}`);
        console.log(`   作者：${result.author}`);
        console.log(`   链接：${result.url}`);
        console.log();
      });
    }
    
    console.log('🎉 搜索服务测试完成！');
  } catch (error) {
    console.error('❌ 搜索失败:', error instanceof Error ? error.message : String(error));
  }
}

testSearch();
