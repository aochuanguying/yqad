#!/usr/bin/env ts-node
import { getCommentLogStorage } from '../src/storage/mysql/comment-log-storage';
import { getCommentHistoryStorage } from '../src/storage/mysql/comment-history-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';

async function checkData() {
  await initializeMySQL();
  
  const logStorage = getCommentLogStorage();
  const historyStorage = getCommentHistoryStorage();
  
  console.log('=== 评论日志数据 ===');
  const logs = await logStorage.queryCommentLogs({ page: 1, pageSize: 5 });
  console.log('总数:', logs.total);
  console.log('数据:', JSON.stringify(logs.data, null, 2));
  
  console.log('\n=== 评论历史数据 ===');
  const history = await historyStorage.getCommentHistoryList({ page: 1, pageSize: 5 });
  console.log('总数:', history.total);
  console.log('数据:', JSON.stringify(history.data, null, 2));
  
  process.exit(0);
}

checkData();
