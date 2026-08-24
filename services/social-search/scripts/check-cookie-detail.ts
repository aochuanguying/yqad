/**
 * 查看 cookie_configs 详细数据
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
    const [rows]: any = await conn.query(
      'SELECT * FROM cookie_configs ORDER BY id'
    );
    
    console.log('📊 cookie_configs 表详细数据:\n');
    
    for (const row of rows) {
      console.log(`\n=== ID: ${row.id} ===`);
      console.log(`平台：${row.platform}`);
      console.log(`名称：${row.label || '未命名'}`);
      console.log(`状态：${row.enabled ? '启用' : '禁用'}`);
      console.log(`Cookie 长度：${row.cookie ? row.cookie.length : 0}`);
      console.log(`Cookie 预览：${row.cookie ? row.cookie.substring(0, 100) + '...' : '无'}`);
      console.log(`Access Secret: ${row.access_secret ? row.access_secret.substring(0, 50) + '...' : '无'}`);
      console.log(`权重：${row.weight}`);
      console.log(`优先级：${row.priority}`);
      console.log(`使用次数：${row.use_count}`);
      console.log(`Cookie 版本：${row.cookie_version}`);
      console.log(`最后刷新：${row.last_refresh_at ? new Date(row.last_refresh_at).toLocaleString('zh-CN') : '-'}`);
      console.log(`下次刷新：${row.next_refresh_at ? new Date(row.next_refresh_at).toLocaleString('zh-CN') : '-'}`);
      
      if (row.refresh_logs) {
        try {
          const logs = typeof row.refresh_logs === 'string' ? JSON.parse(row.refresh_logs) : row.refresh_logs;
          if (Array.isArray(logs) && logs.length > 0) {
            console.log(`刷新日志 (${logs.length} 条):`);
            logs.slice(-3).forEach((log: any, i: number) => {
              console.log(`  [${i+1}] ${log.refresh_time || '-'} | ${log.status} | ${log.source || '-'}`);
            });
          }
        } catch (e) {
          console.log('刷新日志：无法解析');
        }
      }
    }
    
  } catch (err: any) {
    console.error('❌ 错误:', err.message);
  } finally {
    await conn.end();
  }
}

main();
