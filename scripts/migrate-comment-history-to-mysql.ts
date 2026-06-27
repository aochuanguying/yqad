#!/usr/bin/env ts-node
/**
 * 评论历史迁移脚本 - 从 JSON 文件迁移到 MySQL
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCommentHistoryStorage, CreateCommentHistoryInput } from '../src/storage/mysql/comment-history-storage';
import { getCommentLogStorage, CreateCommentLogInput } from '../src/storage/mysql/comment-log-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';

async function migrateCommentHistory() {
  try {
    console.log('🚀 开始初始化 MySQL 连接...');
    await initializeMySQL();
    console.log('✅ MySQL 连接成功');

    console.log('\n📂 读取评论历史文件...');
    const historyPath = path.join(__dirname, '../data/comment-history.json');
    const historyContent = fs.readFileSync(historyPath, 'utf-8');
    const historyList = JSON.parse(historyContent);

    console.log(`📊 共发现 ${historyList.length} 条评论历史记录`);

    const historyStorage = getCommentHistoryStorage();
    const logStorage = getCommentLogStorage();
    let successCount = 0;
    let errorCount = 0;

    console.log('\n🔄 开始迁移评论历史到 MySQL...\n');

    // 迁移评论历史
    for (let i = 0; i < historyList.length; i++) {
      const record = historyList[i];
      try {
        const input: CreateCommentHistoryInput = {
          post_id: record.postId,
          comment_id: record.commentId,
          content: record.content,
          post_title: record.postTitle,
          post_content: record.postContent,
          content_type: record.contentType,
          publish_time: record.publishTime,
        };

        await historyStorage.createCommentHistory(input);
        successCount++;
        console.log(`✅ [${i + 1}/${historyList.length}] 迁移成功：${record.postTitle || record.postId}`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${i + 1}/${historyList.length}] 迁移失败：${record.postTitle || record.postId} - ${error.message}`);
      }
    }

    console.log('\n📂 读取评论日志文件...');
    const logPath = path.join(__dirname, '../logs/comment-log.json');
    let logList: any[] = [];
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf-8');
      logList = JSON.parse(logContent);
    }

    console.log(`📊 共发现 ${logList.length} 条评论日志记录`);

    console.log('\n🔄 开始迁移评论日志到 MySQL...\n');

    // 迁移评论日志
    for (let i = 0; i < logList.length; i++) {
      const log = logList[i];
      try {
        const input: CreateCommentLogInput = {
          post_id: log.postId,
          post_title: log.postTitle,
          post_content: log.postContent,
          content_type: log.contentType,
          comment_content: log.commentContent,
          comment_id: log.commentId,
          success: log.success,
          error: log.error,
          mode: log.mode,
          source: log.source,
          publish_time: log.publishTime,
        };

        await logStorage.createCommentLog(input);
        successCount++;
        console.log(`✅ [${historyList.length + i + 1}/${historyList.length + logList.length}] 迁移成功：${log.postTitle || log.postId}`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${historyList.length + i + 1}/${historyList.length + logList.length}] 迁移失败：${log.postTitle || log.postId} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 迁移完成!');
    console.log(`📊 总计：${historyList.length + logList.length} 条`);
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

migrateCommentHistory();
