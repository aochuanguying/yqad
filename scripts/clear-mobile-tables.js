#!/usr/bin/env node
/**
 * 清空生产数据库的手机短信和未接电话表
 */

const mysql = require('mysql2/promise');

async function clearTables() {
  let connection;
  try {
    console.log('🚀 开始连接生产数据库...');
    
    connection = await mysql.createConnection({
      host: '192.168.50.50',
      port: 3306,
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_prod_db'
    });

    console.log('✅ 数据库连接成功');

    // 清空 mobile_sms 表
    console.log('📝 清空 mobile_sms 表...');
    const [smsResult] = await connection.query('TRUNCATE TABLE mobile_sms');
    console.log('✅ mobile_sms 表已清空');

    // 清空 missed_calls 表
    console.log('📝 清空 missed_calls 表...');
    const [callsResult] = await connection.query('TRUNCATE TABLE missed_calls');
    console.log('✅ missed_calls 表已清空');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 数据库连接已关闭');
    }
  }
}

clearTables()
  .then(() => {
    console.log('🎉 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 失败:', error.message);
    process.exit(1);
  });
