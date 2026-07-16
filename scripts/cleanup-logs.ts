/**
 * 清空评论日志、发帖日志、手机短信和未接电话记录
 */

import mysql from 'mysql2/promise';

async function cleanupLogs() {
  const dbConfig = {
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_prod_db',
  };

  let connection: mysql.Connection | null = null;

  try {
    console.log('📡 连接 MySQL 数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 清空评论日志
    console.log('🗑️  清空 comment_logs 表...');
    await connection.query('TRUNCATE TABLE comment_logs');
    console.log('✅ comment_logs 已清空');

    // 清空发帖日志
    console.log('🗑️  清空 post_logs 表...');
    await connection.query('TRUNCATE TABLE post_logs');
    console.log('✅ post_logs 已清空');

    // 清空手机短信记录
    console.log('🗑️  清空 mobile_sms 表...');
    await connection.query('TRUNCATE TABLE mobile_sms');
    console.log('✅ mobile_sms 已清空');

    // ���空未接电话记录
    console.log('🗑️  清空 missed_calls 表...');
    await connection.query('TRUNCATE TABLE missed_calls');
    console.log('✅ missed_calls 已清空');

    console.log('\n✅ 所有数据已清空完成！');
  } catch (error: any) {
    console.error('❌ 清空数据失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行
cleanupLogs();
