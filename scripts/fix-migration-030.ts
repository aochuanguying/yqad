/**
 * 修复迁移 030 记录（删除重复），然后应用迁移 031
 */

import mysql from 'mysql2/promise';
import { loadConfig } from '../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';

async function fixAndApplyMigration031() {
  console.log('🔧 修复迁移 030 记录并应用迁移 031...\n');
  
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
    
    // 检查迁移 030 记录
    console.log('📋 检查迁移 030 记录...');
    const [rows030]: any = await connection.query(
      "SELECT * FROM schema_migrations WHERE version = '030'"
    );
    console.log(`  找到 ${rows030.length} 条记录`);
    
    // 删除重复记录，只保留一条
    if (rows030.length > 1) {
      console.log('  🗑️  删除重复记录...');
      await connection.query(
        "DELETE FROM schema_migrations WHERE version = '030' LIMIT 1"
      );
      console.log('  ✓ 已删除重复记录\n');
    }
    
    // 检查表是否存在
    console.log('📋 检查 network_post_config 表...');
    const [tables]: any = await connection.query(
      "SHOW TABLES LIKE 'network_post_config'"
    );
    
    if (tables.length === 0) {
      console.log('  ❌ 表不存在，需要重新应用迁移 030');
      
      // 应用迁移 030
      const migration030Path = path.join(__dirname, '../src/db/migrations/030_create_network_post_config_table.sql');
      const migration030Sql = fs.readFileSync(migration030Path, 'utf8');
      const cleanedSql = migration030Sql.replace(/--[\s\S]*?(?:\n|$)/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      
      const statements = cleanedSql.split(';').map((stmt) => stmt.trim()).filter((stmt) => stmt.length > 0);
      
      for (const statement of statements) {
        if (statement.trim().length === 0) continue;
        await connection.query(statement);
        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`  ✓ ${preview}...`);
      }
      console.log('  ✓ 迁移 030 应用成功\n');
    } else {
      console.log('  ✅ 表已存在\n');
    }
    
    // 检查迁移 031 是否已应用
    console.log('📋 检查迁移 031...');
    const [rows031]: any = await connection.query(
      "SELECT * FROM schema_migrations WHERE version = '031'"
    );
    
    if (rows031.length > 0) {
      console.log('  ✅ 迁移 031 已应用\n');
    } else {
      console.log('  📋 应用迁移 031...');
      const migration031Path = path.join(__dirname, '../src/db/migrations/031_add_autohome_to_network_post_config.sql');
      const migration031Sql = fs.readFileSync(migration031Path, 'utf8');
      const cleanedSql = migration031Sql.replace(/--[\s\S]*?(?:\n|$)/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      
      const statements = cleanedSql.split(';').map((stmt) => stmt.trim()).filter((stmt) => stmt.length > 0);
      
      for (const statement of statements) {
        if (statement.trim().length === 0) continue;
        try {
          await connection.query(statement);
          const preview = statement.substring(0, 80).replace(/\n/g, ' ');
          console.log(`  ✓ ${preview}...`);
        } catch (error: any) {
          // 忽略字段已存在的错误
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`  ⚠️  字段已存在，跳过`);
          } else {
            throw error;
          }
        }
      }
      
      // 记录迁移 031
      await connection.execute(
        "INSERT INTO schema_migrations (version, executed_at, status) VALUES (?, NOW(), 'success')",
        ['031']
      );
      console.log('  ✓ 迁移 031 应用成功\n');
    }
    
    // 验证最终表结构
    console.log('📋 验证最终表结构...');
    const [columns]: any = await connection.query('DESCRIBE network_post_config');
    console.table(columns.map((col: any) => ({
      field: col.Field,
      type: col.Type,
      null: col.Null,
      key: col.Key,
      default: col.Default,
    })));
    
    console.log('\n✅ 修复完成！');
    
  } catch (error: any) {
    console.error('\n❌ 修复失败:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

fixAndApplyMigration031()
  .then(() => {
    console.log('\n✨ 所有操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 修复过程中发生错误:', error);
    process.exit(1);
  });
