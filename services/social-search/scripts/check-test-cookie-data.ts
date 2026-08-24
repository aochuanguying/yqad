/**
 * 检查 yqad_db (test) 中的 cookie_configs 数据
 */

import mysql from 'mysql2/promise';

const TEST_DB = {
  host: '192.168.50.10',
  port: 3306,
  user: 'root',
  password: 'Wfw7539148@',
  database: 'yqad_db',
};

async function main() {
  const conn = await mysql.createConnection(TEST_DB);
  
  try {
    const [rows]: any = await conn.query('SELECT * FROM cookie_configs ORDER BY id');
    
    console.log(`📊 yqad_db.cookie_configs 数据 (${rows.length} 条):\n`);
    
    for (const row of rows) {
      console.log(`\n=== ID: ${row.id} ===`);
      console.log(`平台：${row.platform}`);
      console.log(`名称：${row.label || '未命名'}`);
      console.log(`状态：${row.enabled ? '启用' : '禁用'}`);
      console.log(`Cookie 长度：${row.cookie ? row.cookie.length : 0}`);
      if (row.cookie && row.cookie.length > 0) {
        console.log(`Cookie 前 100 字符：${row.cookie.substring(0, 100)}...`);
      }
      if (row.access_secret) {
        console.log(`Access Secret: ${row.access_secret.substring(0, 50)}...`);
      }
    }
    
    const zhihuCount = rows.filter((r: any) => r.platform === 'zhihu').length;
    const xiaohongshuCount = rows.filter((r: any) => r.platform === 'xiaohongshu').length;
    
    console.log(`\n📈 统计:`);
    console.log(`   知乎配置：${zhihuCount} 条`);
    console.log(`   小红书配置：${xiaohongshuCount} 条`);
    
  } catch (err: any) {
    console.error('❌ 错误:', err.message);
  } finally {
    await conn.end();
  }
}

main();
