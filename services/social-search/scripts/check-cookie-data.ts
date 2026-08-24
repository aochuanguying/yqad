/**
 * 检查并迁移 cookie_configs 表数据
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
    // 检查表是否存在
    const [tables]: any = await conn.query(
      "SHOW TABLES LIKE 'cookie_configs'"
    );
    
    if (tables.length === 0) {
      console.log('❌ cookie_configs 表不存在');
      return;
    }
    
    console.log('✅ cookie_configs 表存在');
    
    // 查询现有数据
    const [rows]: any = await conn.query(
      'SELECT id, platform, label, enabled, priority, weight, use_count, last_refresh_at FROM cookie_configs ORDER BY id'
    );
    
    console.log(`\n📊 现有数据 (${rows.length} 条):`);
    console.table(rows.map((r: any) => ({
      ID: r.id,
      Platform: r.platform,
      Label: r.label || 'Unamed',
      Enabled: r.enabled ? 'Yes' : 'No',
      Weight: r.weight,
      UseCount: r.use_count,
      LastRefresh: r.last_refresh_at ? new Date(r.last_refresh_at).toLocaleString('zh-CN') : '-'
    })));
    
    // 检查是否有知乎和小红书的配置
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
