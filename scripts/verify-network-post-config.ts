/**
 * 验证 network_post_config 表中的数据
 */

import mysql from 'mysql2/promise';
import { loadConfig } from '../src/utils/config';

async function verifyConfig() {
  console.log('🔍 验证 network_post_config 表数据...\n');
  
  const config = await loadConfig();
  const dbConfig = (config as any).mysql.production;
  
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });
  
  try {
    console.log('✅ 数据库连接成功\n');
    
    // 查询配置
    console.log('📋 查询配置数据:');
    const [rows]: any = await connection.query('SELECT * FROM network_post_config WHERE id = 1');
    
    if (rows.length === 0) {
      console.log('  ❌ 没有找到配置记录 (id=1)');
    } else {
      console.log('  ✅ 找到配置记录:\n');
      const row = rows[0];
      console.log(`    id: ${row.id}`);
      console.log(`    zhihu_access_secret: ${row.zhihu_access_secret ? '***' : '(空)'}`);
      console.log(`    zhihu_enabled: ${row.zhihu_enabled}`);
      console.log(`    xiaohongshu_cookie: ${row.xiaohongshu_cookie ? '***' : '(空)'}`);
      console.log(`    xiaohongshu_enabled: ${row.xiaohongshu_enabled}`);
      console.log(`    autohome_cookie: ${row.autohome_cookie ? '***' : '(空)'}`);
      console.log(`    autohome_enabled: ${row.autohome_enabled}`);
      console.log(`    max_results: ${row.max_results}`);
      console.log(`    enabled: ${row.enabled}`);
      console.log(`    created_at: ${row.created_at}`);
      console.log(`    updated_at: ${row.updated_at}`);
    }
    
  } catch (error: any) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

verifyConfig()
  .then(() => {
    console.log('\n✨ 验证完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 验证过程中发生错误:', error);
    process.exit(1);
  });
