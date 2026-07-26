/**
 * 执行数据库迁移 - 创建 auth_tokens 表
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('\n========================================');
  console.log('📝 执行数据库迁移：创建 auth_tokens 表');
  console.log('========================================\n');
  
  try {
    const db = MySQLConnectionManager.getInstance();
    await db.initialize();
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '../src/db/migrations/035_create_auth_tokens_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('执行 SQL...');
    console.log(sql);
    console.log('');
    
    // 执行 SQL（移除注释）
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    await db.execute(cleanSql);
    
    console.log('✅ 数据库迁移成功！\n');
    
    // 验证表是否创建成功
    console.log('验证表结构...');
    const result: any = await db.execute(`
      SHOW COLUMNS FROM auth_tokens
    `);
    
    console.log('\nauth_tokens 表结构:');
    console.log(result);
    console.log('\n✅ 表创建成功！\n');
    
    await db.shutdown();
    
  } catch (error: any) {
    console.error('\n❌ 数据库迁移失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
