/**
 * 检查 yqad_prod_db 中的 cookie_configs 完整数据
 */

import mysql from 'mysql2/promise';

const PROD_DB = {
  host: '192.168.50.10',
  port: 3306,
  user: 'root',
  password: 'Wfw7539148@',
  database: 'yqad_prod_db',
};

async function main() {
  const conn = await mysql.createConnection(PROD_DB);
  
  try {
    // 检查表结构
    const [columns]: any = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_SET_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'yqad_prod_db' 
        AND TABLE_NAME = 'cookie_configs'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 表结构:\n');
    console.table(columns.map((c: any) => ({
      Field: c.COLUMN_NAME,
      Type: c.DATA_TYPE,
      Charset: c.CHARACTER_SET_NAME || 'N/A'
    })));
    
    // 检查表的字符集
    const [tableInfo]: any = await conn.query(`
      SELECT TABLE_COLLATION 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'yqad_prod_db' 
        AND TABLE_NAME = 'cookie_configs'
    `);
    console.log('\n表字符集:', tableInfo[0]?.TABLE_COLLATION || '未知');
    
    // 查询所有数据
    const [rows]: any = await conn.query('SELECT * FROM cookie_configs ORDER BY id');
    
    console.log(`\n📊 完整数据 (${rows.length} 条):\n`);
    
    for (const row of rows) {
      console.log(`\n=== ID: ${row.id} ===`);
      console.log(`平台：${row.platform}`);
      console.log(`名称：${row.label || '未命名'}`);
      console.log(`状态：${row.enabled ? '启用' : '禁用'}`);
      console.log(`Cookie 长度：${row.cookie ? row.cookie.length : 0}`);
      if (row.cookie) {
        console.log(`Cookie 前 200 字符：${row.cookie.substring(0, 200)}...`);
      }
      if (row.access_secret) {
        console.log(`Access Secret: ${row.access_secret.substring(0, 100)}...`);
      }
      console.log(`权重：${row.weight}`);
      console.log(`优先级：${row.priority}`);
      console.log(`使用次数：${row.use_count}`);
      console.log(`Cookie 版本：${row.cookie_version}`);
      console.log(`最后刷新：${row.last_refresh_at ? new Date(row.last_refresh_at).toLocaleString('zh-CN') : '-'}`);
    }
    
    // 统计
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
