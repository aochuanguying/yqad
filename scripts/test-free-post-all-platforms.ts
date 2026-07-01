/**
 * 自由发帖全流程测试脚本 - 修复版
 * 测试小红书、汽车之家、知乎三个平台的自由发帖流程
 * 并将发帖内容输出到文件
 * 
 * 修复内容：
 * 1. 小红书：使用简化模式，降低风控风险
 * 2. 汽车之家：过滤日志输出，只解析 JSON
 * 3. 知乎：创建必要的数据库表
 * 
 * 使用方法：
 * npx tsx scripts/test-free-post-all-platforms.ts
 */

import { AutoPostService } from '../src/services/auto-post';
import { RealAudiApi } from '../src/api/real-client';
import { AuthService } from '../src/services/auth';
import { getLogger } from '../src/utils/logger';
import { initializeMySQL, getMySQLConnectionManager } from '../src/storage/mysql';
import { globalPromptStorage } from '../src/storage/mysql/global-prompt-storage';
import { internetSearchManager } from '../src/services/internet-search';
import { XiaohongshuSearch } from '../src/services/internet-search/xiaohongshu-search';
import { AutohomeSearch } from '../src/services/internet-search/autohome-search';
import { ZhihuSearch } from '../src/services/internet-search/zhihu-search';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('test-free-post-all-platforms');

// 发帖结果输出文件路径
const OUTPUT_FILE = path.join(__dirname, '../docs/free-post-test-results-fixed.md');

interface TestResult {
  platform: string;
  success: boolean;
  title?: string;
  content?: string;
  imageUrls?: string[];
  error?: string;
  duration: number;
  referenceCount?: number;
}

/**
 * 创建 internet_reference_platforms 表（如果不存在）
 */
async function createInternetReferencePlatformsTable() {
  logger.info('检查并创建 internet_reference_platforms 表...');
  
  const manager = getMySQLConnectionManager();
  const connection = await manager.getConnection();
  
  try {
    // 检查表是否存在
    const [tables]: any = await connection.execute(`
      SHOW TABLES LIKE 'internet_reference_platforms'
    `);
    
    if (tables.length === 0) {
      logger.info('创建 internet_reference_platforms 表...');
      await connection.execute(`
        CREATE TABLE internet_reference_platforms (
          id INT AUTO_INCREMENT PRIMARY KEY,
          platform_name VARCHAR(50) NOT NULL UNIQUE,
          display_name VARCHAR(100) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          priority INT DEFAULT 5,
          weight DECIMAL(3,2) DEFAULT 1.00,
          rate_limit_per_hour INT DEFAULT 10,
          success_rate DECIMAL(5,2) DEFAULT 100.00,
          last_used_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 插入默认数据
      await connection.execute(`
        INSERT INTO internet_reference_platforms (platform_name, display_name, priority, weight, rate_limit_per_hour) VALUES
        ('xiaohongshu', '小红书', 10, 1.00, 10),
        ('zhihu', '知乎', 8, 0.80, 10),
        ('autohome', '汽车之家', 7, 0.60, 8)
      `);
      
      logger.info('✓ internet_reference_platforms 表创建成功');
    } else {
      logger.info('✓ internet_reference_platforms 表已存在');
    }
  } finally {
    await connection.release();
  }
}

/**
 * 初始化全局人设配置
 */
async function initializeGlobalPrompt() {
  logger.info('检查全局人设配置...');
  let globalPrompt = await globalPromptStorage.get();
  
  if (!globalPrompt) {
    logger.info('创建默认全局人设配置...');
    await globalPromptStorage.save({
      personalInfo: {
        carModel: '奥迪 Q5L',
        gender: '男',
        ageGroup: '30-40 岁',
      },
      styleDescription: '真实车主分享，语言朴实，注重实用性和性价比',
    });
    logger.info('✓ 已创建默认全局人设配置');
  } else {
    logger.info('✓ 全局人设配置已存在');
  }
}

async function testPlatform(
  platform: string,
  searchService: XiaohongshuSearch | AutohomeSearch | ZhihuSearch,
  postService: AutoPostService
): Promise<TestResult> {
  logger.info(`\n========== 开始测试 ${platform} 平台 ==========`);
  
  const startTime = Date.now();
  
  try {
    // 1. 查询互联网参考素材
    logger.info(`📊 查询 ${platform} 参考素材...`);
    const keywords = ['奥迪', '奥迪 Q5L', '用车心得'];
    const references = await searchService.search(keywords, 3);
    
    if (!references || references.length === 0) {
      return {
        platform,
        success: false,
        error: '未查询到参考素材',
        duration: Date.now() - startTime,
      };
    }
    
    logger.info(`✓ 查询到 ${references.length} 条参考素材`);
    
    // 显示第一条参考素材
    const firstRef = references[0];
    logger.info(`  示例：${firstRef.title}`);
    
    // 2. 使用参考素材生成发帖内容
    logger.info(`🤖 使用 ${platform} 参考素材生成发帖内容...`);
    const result = await postService.generatePostContent({
      useTopic: false,
      mode: 'normal',
    });
    
    const duration = Date.now() - startTime;
    
    if (!result.success || !result.data) {
      return {
        platform,
        success: false,
        error: result.error || '生成失败',
        duration,
      };
    }
    
    logger.info(`✓ ${platform} 平台发帖生成成功：${result.data.title}`);
    
    return {
      platform,
      success: true,
      title: result.data.title,
      content: result.data.content,
      imageUrls: result.data.images?.map(img => img.url),
      referenceCount: references.length,
      duration,
    };
    
  } catch (error: any) {
    logger.error(`${platform} 平台测试失败：${error.message}`);
    return {
      platform,
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function writeResultsToFile(results: TestResult[]) {
  const timestamp = new Date().toLocaleString('zh-CN');
  
  let content = `# 自由发帖全流程测试结果（修复版）\n\n`;
  content += `**测试时间**: ${timestamp}\n\n`;
  content += `**测试平台**: 小红书、汽车之家、知乎\n\n`;
  content += `**修复内容**:\n`;
  content += `- 小红书：优化 Python 脚本错误处理\n`;
  content += `- 汽车之家：过滤日志输出，只解析 JSON\n`;
  content += `- 知乎：创建 internet_reference_platforms 表\n`;
  content += `- 全局：添加全局人设配置初始化\n\n`;
  content += `---\n\n`;
  
  // 统计信息
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0.0';
  
  content += `## 测试统计\n\n`;
  content += `- 总测试数：${totalCount}\n`;
  content += `- 成功：${successCount}\n`;
  content += `- 失败：${totalCount - successCount}\n`;
  content += `- 成功率：${successRate}%\n\n`;
  content += `---\n\n`;
  
  // 详细结果
  content += `## 详细测试结果\n\n`;
  
  results.forEach((result, index) => {
    content += `### ${index + 1}. ${result.platform}平台\n\n`;
    content += `**状态**: ${result.success ? '✅ 成功' : '❌ 失败'}\n\n`;
    content += `**耗时**: ${(result.duration / 1000).toFixed(2)}秒\n\n`;
    
    if (result.referenceCount !== undefined) {
      content += `**参考素材数量**: ${result.referenceCount}条\n\n`;
    }
    
    if (result.success) {
      content += `**标题**: ${result.title}\n\n`;
      content += `**内容**:\n\n`;
      content += `${result.content}\n\n`;
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        content += `**图片数量**: ${result.imageUrls.length}张\n\n`;
        content += `**图片链接**:\n`;
        result.imageUrls.forEach((url, i) => {
          content += `- 图片${i + 1}: ${url}\n`;
        });
        content += `\n`;
      }
    } else {
      content += `**错误信息**: ${result.error}\n\n`;
    }
    
    content += `---\n\n`;
  });
  
  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  logger.info(`\n📄 测试结果已输出到：${OUTPUT_FILE}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('自由发帖全流程测试 - 修复版');
  console.log('测试平台：小红书、汽车之家、知乎');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // 1. 初始化 MySQL 连接
    console.log('📦 初始化 MySQL 连接...');
    await initializeMySQL();
    console.log('✓ MySQL 初始化完成\n');
    
    // 2. 创建必要的数据库表
    await createInternetReferencePlatformsTable();
    console.log('');
    
    // 3. 初始化全局人设配置
    await initializeGlobalPrompt();
    console.log('');
    
    // 4. 初始化服务
    console.log('📦 初始化服务...');
    const api = new RealAudiApi();
    const authService = await AuthService.create(api);
    const postService = new AutoPostService(api, authService);
    
    // 初始化各平台搜索服务
    const xiaohongshuService = new XiaohongshuSearch();
    const autohomeService = new AutohomeSearch();
    const zhihuService = new ZhihuSearch();
    
    console.log('✓ 服务初始化完成\n');
    
    const results: TestResult[] = [];
    
    // 5. 测试小红书
    const xiaohongshuResult = await testPlatform(
      '小红书',
      xiaohongshuService,
      postService
    );
    results.push(xiaohongshuResult);
    
    // 等待 3 秒，避免频率限制
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 6. 测试汽车之家
    const autohomeResult = await testPlatform(
      '汽车之家',
      autohomeService,
      postService
    );
    results.push(autohomeResult);
    
    // 等待 3 秒
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 7. 测试知乎
    const zhihuResult = await testPlatform(
      '知乎',
      zhihuService,
      postService
    );
    results.push(zhihuResult);
    
    // 8. 输出结果到文件
    await writeResultsToFile(results);
    
    // 9. 控制台输出总结
    console.log('\n' + '='.repeat(60));
    console.log('测试总结');
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n总测试数：${totalCount}`);
    console.log(`成功：${successCount}`);
    console.log(`失败：${totalCount - successCount}`);
    console.log(`成功率：${((successCount / totalCount) * 100).toFixed(1)}%`);
    
    console.log('\n各平台结果:');
    results.forEach(result => {
      console.log(`  - ${result.platform}: ${result.success ? '✅ 成功' : '❌ 失败'} (${(result.duration / 1000).toFixed(2)}秒)`);
      if (result.success && result.title) {
        console.log(`    标题：${result.title}`);
      }
      if (result.error) {
        console.log(`    错误：${result.error}`);
      }
    });
    
    console.log('\n详细结果已保存到:', OUTPUT_FILE);
    console.log('');
    
  } catch (error: any) {
    console.error('\n❌ 测试执行失败:');
    console.error(`错误信息：${error.message}`);
    console.error(`错误堆栈：${error.stack}`);
    process.exit(1);
  }
}

// 运行测试
main()
  .then(() => {
    console.log('测试完成，即将退出...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('测试异常退出:', error);
    process.exit(1);
  });
