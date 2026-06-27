/**
 * 迁移发帖历史数据到 MySQL
 */

import * as fs from 'fs';
import * as path from 'path';
import { postHistoryStorage, CreatePostHistoryInput } from '../src/storage/mysql/post-history-storage';
import { complianceReportStorage, CreateComplianceReportInput } from '../src/storage/mysql/compliance-report-storage';
import { globalPromptStorage, CreateGlobalPromptInput } from '../src/storage/mysql/global-prompt-storage';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';

async function migratePostHistory() {
  const historyPath = path.resolve(process.cwd(), 'data/post-history.json');
  
  if (!fs.existsSync(historyPath)) {
    console.log('发帖历史文件不存在，跳过迁移');
    return 0;
  }
  
  try {
    const data = fs.readFileSync(historyPath, 'utf-8');
    const posts = JSON.parse(data);
    
    let migrated = 0;
    for (const post of posts) {
      const input: CreatePostHistoryInput = {
        id: post.postId,
        title: post.title,
        topic: post.topic,
        publishedAt: new Date(post.timestamp),
      };
      
      await postHistoryStorage.createPost(input);
      migrated++;
    }
    
    console.log(`✅ 发帖历史迁移完成：${migrated} 条记录`);
    return migrated;
  } catch (error) {
    console.error(`❌ 发帖历史迁移失败：${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

async function migrateComplianceReports() {
  const reportsPath = path.resolve(process.cwd(), 'data/compliance-reports');
  
  if (!fs.existsSync(reportsPath)) {
    console.log('合规性报告目录不存在，跳过迁移');
    return 0;
  }
  
  const files = fs.readdirSync(reportsPath).filter(f => f.endsWith('.json'));
  let migrated = 0;
  
  for (const file of files) {
    try {
      const filePath = path.join(reportsPath, file);
      const data = fs.readFileSync(filePath, 'utf-8');
      const report = JSON.parse(data);
      
      const input: CreateComplianceReportInput = {
        id: report.id,
        postId: report.postId,
        title: report.title,
        content: report.content,
        topicId: report.topicId || null,
        topicName: report.topicName || null,
        triggerType: report.triggerType,
        similarityCheck: report.similarityCheck || null,
        sensitiveWordCheck: report.sensitiveWordCheck || null,
        qualityScore: report.qualityScore || null,
        postingIntervalCheck: report.postingIntervalCheck || null,
        passed: report.passed,
        rejectReasons: report.rejectReasons,
        checkDuration: report.checkDuration,
      };
      
      await complianceReportStorage.createReport(input);
      migrated++;
    } catch (error) {
      console.error(`迁移报告 ${file} 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`✅ 合规性报告迁移完成：${migrated}/${files.length} 条记录`);
  return migrated;
}

async function migrateGlobalPrompt() {
  const promptPath = path.resolve(process.cwd(), 'data/global-prompt.json');
  
  if (!fs.existsSync(promptPath)) {
    console.log('全局人设文件不存在，跳过迁移');
    return 0;
  }
  
  try {
    const data = fs.readFileSync(promptPath, 'utf-8');
    const prompt = JSON.parse(data);
    
    const input: CreateGlobalPromptInput = {
      personalInfo: JSON.stringify(prompt.personalInfo),
      styleDescription: prompt.styleDescription || null,
    };
    
    await globalPromptStorage.save(input);
    console.log(`✅ 全局人设迁移完成`);
    return 1;
  } catch (error) {
    console.error(`❌ 全局人设迁移失败：${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

async function main() {
  console.log('🚀 开始迁移数据到 MySQL...\n');
  
  // 初始化 MySQL 连接
  try {
    console.log('正在连接 MySQL...');
    await MySQLConnectionManager.getInstance().initialize();
    console.log('✅ MySQL 连接成功\n');
  } catch (error) {
    console.error(`❌ MySQL 连接失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  
  const postHistoryCount = await migratePostHistory();
  const complianceReportsCount = await migrateComplianceReports();
  const globalPromptCount = await migrateGlobalPrompt();
  
  console.log('\n📊 迁移统计：');
  console.log(`  - 发帖历史：${postHistoryCount} 条`);
  console.log(`  - 合规性报告：${complianceReportsCount} 条`);
  console.log(`  - 全局人设：${globalPromptCount} 条`);
  console.log('\n✅ 迁移完成！\n');
  
  process.exit(0);
}

main().catch(console.error);
