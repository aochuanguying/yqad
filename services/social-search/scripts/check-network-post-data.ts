/**
 * 检查 network_post_config 表中的真实数据
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
        AND TABLE_NAME = 'network_post_config'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 network_post_config 表结构:\n');
    console.table(columns.map((c: any) => ({
      Field: c.COLUMN_NAME,
      Type: c.DATA_TYPE,
      Charset: c.CHARACTER_SET_NAME || 'N/A'
    })));
    
    // 查询所有数据
    const [rows]: any = await conn.query('SELECT * FROM network_post_config ORDER BY id DESC LIMIT 1');
    
    if (rows.length === 0) {
      console.log('\n❌ 表中没有数据');
      return;
    }
    
    const row = rows[0];
    console.log('\n📊 最新配置数据:\n');
    console.log(`ID: ${row.id}`);
    console.log(`\n【知乎配置】`);
    console.log(`  Access Secret 长度：${row.zhihu_access_secret ? row.zhihu_access_secret.length : 0}`);
    console.log(`  Access Secret 预览：${row.zhihu_access_secret ? row.zhihu_access_secret.substring(0, 50) + '...' : '无'}`);
    console.log(`  Cookie 长度：${row.zhihu_cookie ? row.zhihu_cookie.length : 0}`);
    console.log(`  Cookie 预览：${row.zhihu_cookie ? row.zhihu_cookie.substring(0, 100) + '...' : '无'}`);
    console.log(`  启用状态：${row.zhihu_enabled ? '是' : '否'}`);
    
    console.log(`\n【小红书配置】`);
    console.log(`  Cookie 长度：${row.xiaohongshu_cookie ? row.xiaohongshu_cookie.length : 0}`);
    console.log(`  Cookie 预览：${row.xiaohongshu_cookie ? row.xiaohongshu_cookie.substring(0, 100) + '...' : '无'}`);
    console.log(`  启用状态：${row.xiaohongshu_enabled ? '是' : '否'}`);
    
    console.log(`\n【汽车之家配置】`);
    console.log(`  Cookie 长度：${row.autohome_cookie ? row.autohome_cookie.length : 0}`);
    console.log(`  Cookie 预览：${row.autohome_cookie ? row.autohome_cookie.substring(0, 100) + '...' : '无'}`);
    console.log(`  启用状态：${row.autohome_enabled ? '是' : '否'}`);
    
    console.log(`\n其他配置:`);
    console.log(`  max_results: ${row.max_results}`);
    console.log(`  enabled: ${row.enabled}`);
    console.log(`  updated_at: ${row.updated_at ? new Date(row.updated_at).toLocaleString('zh-CN') : '-'}`);
    
  } catch (err: any) {
    console.error('❌ 错误:', err.message);
  } finally {
    await conn.end();
  }
}

main();
