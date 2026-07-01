/**
 * 测试所有平台 - 小红书、汽车之家、知乎
 */

import { initializeMySQL, getMySQLConnectionManager } from '../src/storage/mysql';
import { XiaohongshuSearch } from '../src/services/internet-search/xiaohongshu-search';
import { AutohomeSearch } from '../src/services/internet-search/autohome-search';
import { ZhihuSearch } from '../src/services/internet-search/zhihu-search';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(__dirname, '../docs/all-platforms-test-results.md');

async function testXiaohongshu() {
  console.log('\n========== 测试小红书 ==========');
  const service = new XiaohongshuSearch();
  
  // 初始化（加载 Cookie）
  await service.initialize();
  
  const keywords = ['奥迪', '奥迪 Q5L', '用车心得'];
  
  try {
    const results = await service.search(keywords, 2);
    console.log(`✓ 小红书查询到 ${results.length} 条结果`);
    
    if (results.length > 0) {
      console.log(`  示例标题：${results[0].title}`);
      console.log(`  示例链接：${results[0].url}`);
      console.log(`  作者：${results[0].author}`);
      console.log(`  点赞：${results[0].likes}`);
    }
    
    return {
      platform: '小红书',
      success: results.length > 0,
      count: results.length,
      sample: results[0]?.title,
      author: results[0]?.author,
      likes: results[0]?.likes,
    };
  } catch (error: any) {
    console.log(`❌ 小红书失败：${error.message}`);
    return {
      platform: '小红书',
      success: false,
      error: error.message,
    };
  }
}

async function testAutohome() {
  console.log('\n========== 测试汽车之家 ==========');
  const service = new AutohomeSearch();
  const keywords = ['奥迪', '奥迪 Q5L', '用车心得'];
  
  try {
    const results = await service.search(keywords, 2);
    console.log(`✓ 汽车之家查询到 ${results.length} 条结果`);
    
    if (results.length > 0) {
      console.log(`  示例标题：${results[0].title}`);
      console.log(`  示例链接：${results[0].url}`);
    }
    
    return {
      platform: '汽车之家',
      success: results.length > 0,
      count: results.length,
      sample: results[0]?.title,
    };
  } catch (error: any) {
    console.log(`❌ 汽车之家失败：${error.message}`);
    return {
      platform: '汽车之家',
      success: false,
      error: error.message,
    };
  }
}

async function testZhihu() {
  console.log('\n========== 测试知乎 ==========');
  const service = new ZhihuSearch();
  const keywords = ['奥迪', '奥迪 Q5L', '用车心得'];
  
  try {
    const results = await service.search(keywords, 2);
    console.log(`✓ 知乎查询到 ${results.length} 条结果`);
    
    if (results.length > 0) {
      console.log(`  示例标题：${results[0].title}`);
      console.log(`  示例链接：${results[0].url}`);
    }
    
    return {
      platform: '知乎',
      success: results.length > 0,
      count: results.length,
      sample: results[0]?.title,
    };
  } catch (error: any) {
    console.log(`❌ 知乎失败：${error.message}`);
    return {
      platform: '知乎',
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('全平台测试 - 小红书、汽车之家、知乎');
  console.log('='.repeat(60));
  
  // 初始化 MySQL
  await initializeMySQL();
  console.log('✓ MySQL ��连接');
  
  // 测试所有平台
  const xiaohongshuResult = await testXiaohongshu();
  const autohomeResult = await testAutohome();
  const zhihuResult = await testZhihu();
  
  // 生成报告
  const timestamp = new Date().toLocaleString('zh-CN');
  let report = `# 全平台测试结果\n\n`;
  report += `**测试时间**: ${timestamp}\n\n`;
  report += `**测试平台**: 小红书、汽车之家、知乎\n\n`;
  report += `---\n\n`;
  
  const results = [xiaohongshuResult, autohomeResult, zhihuResult];
  const successCount = results.filter(r => r.success).length;
  
  report += `## 测试结果总览\n\n`;
  report += `| 平台 | 状态 | 结果数 | 示例标题 | 详细信息 |\n`;
  report += `|------|------|--------|----------|----------|\n`;
  
  if (xiaohongshuResult.success) {
    report += `| 小红书 | ✅ 成功 | ${xiaohongshuResult.count} | ${xiaohongshuResult.sample} | 作者：${xiaohongshuResult.author}, 点赞：${xiaohongshuResult.likes} |\n`;
  } else {
    report += `| 小红书 | ❌ 失败 | 0 | - | ${xiaohongshuResult.error} |\n`;
  }
  
  if (autohomeResult.success) {
    report += `| 汽车之家 | ✅ 成功 | ${autohomeResult.count} | ${autohomeResult.sample} | - |\n`;
  } else {
    report += `| 汽车之家 | ❌ 失败 | 0 | - | ${autohomeResult.error} |\n`;
  }
  
  if (zhihuResult.success) {
    report += `| 知乎 | ✅ 成功 | ${zhihuResult.count} | ${zhihuResult.sample} | - |\n`;
  } else {
    report += `| 知乎 | ❌ 失败 | 0 | - | ${zhihuResult.error} |\n`;
  }
  
  report += `\n**成功率**: ${successCount}/3 (${((successCount/3)*100).toFixed(0)}%)\n\n`;
  
  // 详细错误信息
  report += `## 详细错误信息\n\n`;
  
  if (xiaohongshuResult.error) {
    report += `### 小红书错误详情\n\`\`\`\n${xiaohongshuResult.error}\n\`\`\`\n\n`;
  }
  
  if (autohomeResult.error) {
    report += `### 汽车之家错误详情\n\`\`\`\n${autohomeResult.error}\n\`\`\`\n\n`;
  }
  
  if (zhihuResult.error) {
    report += `### 知乎错误详情\n\`\`\`\n${zhihuResult.error}\n\`\`\`\n\n`;
  }
  
  if (successCount === 3) {
    report += `## 🎉 总结\n\n`;
    report += `**所有平台测试通过！** 三个平台都能正常搜索和获取内容。\n\n`;
    report += `- ✅ 小红书：${xiaohongshuResult.count} 条结果\n`;
    report += `- ✅ 汽车之家：${autohomeResult.count} 条结果\n`;
    report += `- ✅ 知乎：${zhihuResult.count} 条结果\n`;
  } else {
    report += `## 总结\n\n`;
    report += `**通过**: ${successCount}/3 平台\n\n`;
    report += `需要修复的平台：\n`;
    results.forEach(r => {
      if (!r.success) {
        report += `- ❌ ${r.platform}: ${r.error}\n`;
      }
    });
  }
  
  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');
  console.log(`\n📄 报告已保存到：${OUTPUT_FILE}`);
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
