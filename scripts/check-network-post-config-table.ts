/**
 * 检查生产数据库 network_post_config 表结构
 */

import mysql from 'mysql2/promise';
import { loadConfig } from '../src/utils/config';

async function checkTableStructure() {
  console.log('🔍 检查生产数据库 network_post_config 表结构...\n');
  
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
    
    // 检查表是否存在
    console.log('📋 检查表是否存在...');
    const [tables]: any = await connection.query(
      "SHOW TABLES LIKE 'network_post_config'"
    );
    
    if (tables.length === 0) {
      console.log('❌ network_post_config 表不存在\n');
    } else {
      console.log('✅ network_post_config 表存在\n');
      
      // 查看表结构
      console.log('📋 表结构:');
      const [columns]: any = await connection.query('DESCRIBE network_post_config');
      console.table(columns.map((col: any) => ({
        field: col.Field,
        type: col.Type,
        null: col.Null,
        key: col.Key,
        default: col.Default,
        extra: col.Extra,
      })));
    }
    
    // 检查迁移历史
    console.log('\n📋 检查迁移历史...');
    const [migrations]: any = await connection.query(
      "SELECT * FROM schema_migrations WHERE version IN ('030', '031') ORDER BY version"
    );
    
    if (migrations.length === 0) {
      console.log('❌ 迁移 030 和 031 未执行\n');
    } else {
      console.log('✅ 已执行的迁移:');
      console.table(migrations.map((m: any) => ({
        version: m.version,
        name: m.name,
        applied_at: m.applied_at,
      })));
    }
    
  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行检查
checkTableStructure()
  .then(() => {
    console.log('\n✨ 检查完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 检查过程中发生错误:', error);
    process.exit(1);
  });
