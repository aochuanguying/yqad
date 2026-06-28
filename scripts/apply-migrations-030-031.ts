/**
 * 应用迁移 030 和 031 到生产数据库
 * 030: 创建 network_post_config 表
 * 031: 添加汽车之家配置字段
 */

import mysql from 'mysql2/promise';
import { loadConfig } from '../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigrations() {
  console.log('🚀 开始应用迁移 030 和 031...\n');
  
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
    
    // 应用迁移 030
    console.log('📋 应用迁移 030: 创建 network_post_config 表...');
    const migration030Path = path.join(__dirname, '../src/db/migrations/030_create_network_post_config_table.sql');
    const migration030Sql = fs.readFileSync(migration030Path, 'utf8');
    
    // 移除注释
    const cleanedSql = migration030Sql
      .replace(/--[\s\S]*?(?:\n|$)/g, '')  // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '');    // 移除多行注释
    
    const statements030 = cleanedSql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);
    
    console.log(`  📝 找到 ${statements030.length} 个 SQL 语句`);
    
    for (const statement of statements030) {
      if (statement.trim().length === 0) continue;
      
      try {
        await connection.query(statement);
        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`  ✓ ${preview}...`);
      } catch (error: any) {
        console.error(`  ❌ 执行失败：${error.message}`);
        console.error(`  SQL: ${statement}`);
        throw error;
      }
    }
    
    // 记录迁移 030
    await connection.execute(
      "INSERT INTO schema_migrations (version, executed_at, status) VALUES (?, NOW(), 'success')",
      ['030']
    );
    console.log('  ✓ 记录迁移 030 到 schema_migrations\n');
    
    // 应用迁移 031
    console.log('📋 应用迁移 031: 添加汽车之家配置字段...');
    const migration031Path = path.join(__dirname, '../src/db/migrations/031_add_autohome_to_network_post_config.sql');
    const migration031Sql = fs.readFileSync(migration031Path, 'utf8');
    
    const statements031 = migration031Sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements031) {
      if (statement.trim().length === 0) continue;
      
      try {
        await connection.query(statement);
        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`  ✓ ${preview}...`);
      } catch (error: any) {
        console.error(`  ❌ 执行失败：${error.message}`);
        console.error(`  SQL: ${statement}`);
        throw error;
      }
    }
    
    // 记录迁移 031
    await connection.execute(
      "INSERT INTO schema_migrations (version, executed_at, status) VALUES (?, NOW(), 'success')",
      ['031']
    );
    console.log('  ✓ 记录迁移 031 到 schema_migrations\n');
    
    // 验证表结构
    console.log('📋 验证表结构...');
    const [columns]: any = await connection.query('DESCRIBE network_post_config');
    console.table(columns.map((col: any) => ({
      field: col.Field,
      type: col.Type,
      null: col.Null,
      key: col.Key,
      default: col.Default,
    })));
    
    console.log('\n✅ 迁移 030 和 031 应用成功！');
    
  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行迁移
applyMigrations()
  .then(() => {
    console.log('\n✨ 所有操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 迁移过程中发生错误:', error);
    process.exit(1);
  });
