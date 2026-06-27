#!/usr/bin/env ts-node
/**
 * 修复评论日志数据 - 从文件重新迁移
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCommentLogStorage } from '../src/storage/mysql/comment-log-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';

async function fixCommentLogs() {
  try {
    console.log('🚀 开始初始化 MySQL 连接...');
    await initializeMySQL();
    console.log('✅ MySQL 连接成功');

    console.log('\n📂 读取评论日志文件...');
    const logPath = path.join(__dirname, '../logs/comment-log.json');
    let logList: any[] = [];
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf-8');
      logList = JSON.parse(logContent);
    }

    console.log(`📊 共发现 ${logList.length} 条评论日志记录`);

    const logStorage = getCommentLogStorage();
    let successCount = 0;
    let errorCount = 0;

    console.log('\n🔄 开始修复评论日志数据...\n');

    for (let i = 0; i < logList.length; i++) {
      const log = logList[i];
      try {
        // 检查是否已存在
        const existingLogs = await logStorage.queryCommentLogs({ page: 1, pageSize: 100 });
        const exists = existingLogs.data.find(l => l.comment_id === log.commentId);
        
        if (exists) {
          console.log(`⏭️  [${i + 1}/${logList.length}] 已存在，跳过：${log.postTitle || log.postId}`);
          continue;
        }

        const input = {
          post_id: log.postId,
          post_title: log.postTitle || '',
          post_content: log.postContent,
          content_type: log.contentType,
          comment_content: log.commentContent,
          comment_id: log.commentId,
          success: log.success,
          error: log.error,
          mode: log.mode || 'normal',
          source: log.source || 'manual',  // 默认 manual
          publish_time: undefined,
        };

        await logStorage.createCommentLog(input);
        successCount++;
        console.log(`✅ [${i + 1}/${logList.length}] 修复成功：${log.postTitle || log.postId}`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${i + 1}/${logList.length}] 修复失败：${log.postTitle || log.postId} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 修复完成!');
    console.log(`📊 总计：${logList.length} 条`);
    console.log(`✅ 成功：${successCount} 条`);
    console.log(`❌ 失败：${errorCount} 条`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error: any) {
    console.error('💥 修复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixCommentLogs();
