/**
 * 简化版平台测试 - 直接使用 API，不依赖 Python 库
 * 测试汽车之家和知乎（小红书需要 xhshow 库，暂时跳过）
 */

import { initializeMySQL, getMySQLConnectionManager } from '../src/storage/mysql';
import { AutohomeSearch } from '../src/services/internet-search/autohome-search';
import { ZhihuSearch } from '../src/services/internet-search/zhihu-search';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(__dirname, '../docs/simple-platform-test-results.md');

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
  console.log('简化版平台测试（不依赖 Python 库）');
  console.log('='.repeat(60));
  
  // 初始化 MySQL
  await initializeMySQL();
  console.log('✓ MySQL 已连接');
  
  // 测试平台
  const autohomeResult = await testAutohome();
  const zhihuResult = await testZhihu();
  
  // 生成报告
  const timestamp = new Date().toLocaleString('zh-CN');
  let report = `# 简化版平台测试结果\n\n`;
  report += `**测试时间**: ${timestamp}\n\n`;
  report += `**说明**: 小红书需要 xhshow Python 库，暂时无法测试\n\n`;
  report += `---\n\n`;
  
  const successCount = [autohomeResult, zhihuResult].filter(r => r.success).length;
  
  report += `## 测试结果\n\n`;
  report += `| 平台 | 状态 | 结果数 | 示例 |\n`;
  report += `|------|------|--------|------|\n`;
  report += `| 汽车之家 | ${autohomeResult.success ? '✅ 成功' : '❌ 失败'} | ${autohomeResult.count || 0} | ${autohomeResult.sample || '-'} |\n`;
  report += `| 知乎 | ${zhihuResult.success ? '✅ 成功' : '❌ 失败'} | ${zhihuResult.count || 0} | ${zhihuResult.sample || '-'} |\n`;
  report += `\n**成功率**: ${successCount}/2 (${((successCount/2)*100).toFixed(0)}%)\n\n`;
  
  if (autohomeResult.error) {
    report += `### 汽车之家错误详情\n${autohomeResult.error}\n\n`;
  }
  if (zhihuResult.error) {
    report += `### 知乎错误详情\n${zhihuResult.error}\n\n`;
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
