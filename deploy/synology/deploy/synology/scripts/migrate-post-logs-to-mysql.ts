#!/usr/bin/env ts-node
/**
 * 发帖记录迁移脚本 - 从 JSON 文件迁移到 MySQL
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPostLogStorage, CreatePostLogInput } from '../src/storage/mysql/post-log-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';

async function migratePostLogs() {
  try {
    console.log('🚀 开始初始化 MySQL 连接...');
    await initializeMySQL();
    console.log('✅ MySQL 连接成功');

    console.log('\n📂 读取文件记录...');
    const filePath = path.join(__dirname, '../data/post-logs.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const logs = JSON.parse(fileContent);

    console.log(`📊 共发现 ${logs.length} 条发帖记录`);

    const storage = getPostLogStorage();
    let successCount = 0;
    let errorCount = 0;

    console.log('\n🔄 开始迁移数据到 MySQL...\n');

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      try {
        const input: CreatePostLogInput = {
          post_id: log.taskId || undefined,
          title: log.title,
          topic_id: undefined,
          topic_name: undefined,
          content: log.content,
          image_urls: log.imageUrls || [],
          status: log.status,
          error_message: log.errorMessage || undefined,
          mode: log.mode,
          trigger_type: log.triggerType,
        };

        await storage.createPostLog(input);
        successCount++;
        console.log(`✅ [${i + 1}/${logs.length}] 迁移成功：${log.title.substring(0, 30)}...`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${i + 1}/${logs.length}] 迁移失败：${log.title.substring(0, 30)}... - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 迁移完成!');
    console.log(`📊 总计：${logs.length} 条`);
    console.log(`✅ 成功：${successCount} 条`);
    console.log(`❌ 失败：${errorCount} 条`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error: any) {
    console.error('💥 迁移失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migratePostLogs();
