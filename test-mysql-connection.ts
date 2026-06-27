import mysql from 'mysql2/promise';

async function testMySQLConnection() {
  console.log('测试 MySQL 连接...');
  console.log('连接信息：host=192.168.50.50, port=3306, user=root');
  
  let connection;
  try {
    // 先连接到 MySQL（不指定数据库）
    connection = await mysql.createConnection({
      host: '192.168.50.50',
      port: 3306,
      user: 'root',
      password: 'Wfw7539148@',
      connectTimeout: 10000,
    });
    
    console.log('✅ MySQL 服务器连接成功！');
    
    // 创建数据库
    await connection.execute('CREATE DATABASE IF NOT EXISTS yqad_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✅ 数据库 yqad_db 创建成功！');
    
    // 切换到新数据库
    await connection.query('USE yqad_db');
    console.log('✅ 已切换到数据库 yqad_db');
    
    console.log('✅ MySQL 连接成功！');
    
    const [rows]: any = await connection.execute('SELECT 1 as test');
    console.log('查询测试:', rows);
    
    await connection.end();
    console.log('连接已关闭');
  } catch (error: any) {
    console.error('❌ MySQL 连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testMySQLConnection();
