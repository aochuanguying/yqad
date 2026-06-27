#!/usr/bin/env ts-node
/**
 * 执行 SQL 迁移脚本
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';

async function executeMigration() {
  try {
    console.log('🚀 开始执行数据库迁移...');
    await initializeMySQL();
    console.log('✅ MySQL 连接成功');

    const manager = MySQLConnectionManager.getInstance();
    const conn = await manager.getConnection();

    try {
      // 读取并执行迁移 SQL
      const migrationsDir = path.join(__dirname, '../src/db/migrations');
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`\n📂 发现 ${files.length} 个迁移文件`);

      for (const file of files) {
        console.log(`\n📝 执行迁移：${file}`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        // 提取 Up 部分的 SQL
        const upMatch = sqlContent.match(/-- \+migrate Up([\s\S]*?)(-- \+migrate Down|$)/);
        if (!upMatch) {
          console.log(`⚠️  跳过 ${file}：未找到 +migrate Up 标记`);
          continue;
        }

        const sql = upMatch[1].trim();
        
        try {
          // 执行多条 SQL 语句
          const statements = sql.split(';').filter(s => s.trim());
          for (const statement of statements) {
            if (statement.trim()) {
              await conn.query(statement);
            }
          }
          console.log(`✅ ${file} 执行成功`);
        } catch (error: any) {
          console.error(`❌ ${file} 执行失败：${error.message}`);
        }
      }

      console.log('\n🎉 数据库迁移完成!');
    } finally {
      conn.release();
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('💥 迁移失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

executeMigration();
