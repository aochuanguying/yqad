import mysql from 'mysql2/promise';

async function testPool() {
  console.log('测试 MySQL 连接池...');
  
  try {
    const pool = mysql.createPool({
      host: '192.168.50.50',
      port: 3306,
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_db',
      connectionLimit: 5,
      waitForConnections: true,
      connectTimeout: 10000,
    });
    
    console.log('✅ 连接池创建成功');
    
    // 测试查询
    const [rows]: any = await pool.execute('SELECT 1 as test');
    console.log('✅ 查询成功:', rows);
    
    await pool.end();
    console.log('✅ 连接池已关闭');
  } catch (error: any) {
    console.error('❌ 连接池失败:', error.message);
    console.error('错误代码:', error.code);
    console.error('完整错误:', error);
  }
}

testPool();
