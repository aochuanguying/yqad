/**
 * 检查 schema_migrations 表结构
 */

import mysql from 'mysql2/promise';
import { loadConfig } from '../src/utils/config';

async function checkSchemaMigrations() {
  console.log('🔍 检查 schema_migrations 表结构...\n');
  
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
    
    // 查看表结构
    console.log('📋 表结构:');
    const [columns]: any = await connection.query('DESCRIBE schema_migrations');
    console.table(columns.map((col: any) => ({
      field: col.Field,
      type: col.Type,
      null: col.Null,
      key: col.Key,
      default: col.Default,
      extra: col.Extra,
    })));
    
    // 查看最近的迁移记录
    console.log('\n📋 最近的迁移记录:');
    const [rows]: any = await connection.query('SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10');
    console.table(rows);
    
  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

checkSchemaMigrations()
  .then(() => {
    console.log('\n✨ 检查完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 检查过程中发生错误:', error);
    process.exit(1);
  });
