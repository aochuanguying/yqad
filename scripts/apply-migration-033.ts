/**
 * 应用迁移 033: 添加知乎 Cookie 字段
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    await conn.initialize();
    console.log('✅ 数据库连接成功');
    
    // 读取迁移脚本
    const migrationPath = join(__dirname, '../src/db/migrations/033_add_zhihu_cookie_field.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('正在执行迁移脚本...');
    
    // 执行迁移（分条执行）
    const statements = migrationSQL.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        console.log('执行 SQL:', trimmed.substring(0, 100) + (trimmed.length > 100 ? '...' : ''));
        await conn.execute(trimmed);
      }
    }
    
    console.log('✅ 迁移执行成功');
    
    // 验证字段是否添加成功
    const result: any = await conn.query('DESCRIBE network_post_config');
    const rows = Array.isArray(result) ? result[0] : result;
    console.log('\n当前表结构:');
    console.table(Array.isArray(rows) ? rows.map((row: any) => ({
      field: row.Field,
      type: row.Type,
      comment: row.Comment
    })) : rows);
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
  }
}

applyMigration();
