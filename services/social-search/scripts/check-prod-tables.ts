/**
 * 检查 yqad_prod_db 中所有表
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
    // 列出所有表
    const [tables]: any = await conn.query(`
      SELECT TABLE_NAME, TABLE_ROWS, TABLE_COLLATION
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'yqad_prod_db'
      ORDER BY TABLE_NAME
    `);
    
    console.log('📋 yqad_prod_db 中的所有表:\n');
    console.table(tables.map((t: any) => ({
      TableName: t.TABLE_NAME,
      Rows: t.TABLE_ROWS,
      Collation: t.TABLE_COLLATION
    })));
    
    // 检查是否有其他可能包含 cookie 的表
    const cookieRelatedTables = tables.filter((t: any) => 
      t.TABLE_NAME.toLowerCase().includes('cookie') ||
      t.TABLE_NAME.toLowerCase().includes('zhihu') ||
      t.TABLE_NAME.toLowerCase().includes('xiaohongshu')
    );
    
    if (cookieRelatedTables.length > 0) {
      console.log('\n🔍 可能与 Cookie 相关的表:');
      console.table(cookieRelatedTables.map((t: any) => ({
        TableName: t.TABLE_NAME,
        Rows: t.TABLE_ROWS
      })));
    }
    
  } catch (err: any) {
    console.error('❌ 错误:', err.message);
  } finally {
    await conn.end();
  }
}

main();
