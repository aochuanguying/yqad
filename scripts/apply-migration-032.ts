/**
 * 执行 032 号迁移：增强发帖日志表
 */

import mysql from 'mysql2/promise';

async function applyMigration032() {
  console.log('🚀 开始执行 032 号迁移：增强发帖日志表...');
  
  // 创建数据库连接
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'yqad',
  });
  
  try {
    console.log('✅ 数据库连接成功');
    
    // 读取迁移文件
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '../src/db/migrations/032_enhance_post_logs_for_monitoring.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // 分割 SQL 语句（按分号分隔）
    const statements = migrationSql
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 找到 ${statements.length} 个 SQL 语句`);
    
    // 执行每个语句
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      
      try {
        await connection.query(statement);
        const preview = statement.substring(0, 100).replace(/\n/g, ' ');
        console.log(`✓ 执行：${preview}...`);
      } catch (error: any) {
        console.error(`❌ 执行失败：${error.message}`);
        console.error(`SQL: ${statement}`);
        throw error;
      }
    }
    
    console.log('✅ 迁移执行成功！');
    
    // 验证表结构
    console.log('\n📋 验证表结构...');
    const [rows]: any = await connection.query('DESCRIBE post_logs');
    const columnNames = rows.map((row: any) => row.Field);
    
    const expectedColumns = [
      'pipeline_timings',
      'total_duration',
      'resource_usage',
      'error_stack',
      'context_snapshot',
      'retry_history',
    ];
    
    console.log('\n新增字段检查：');
    for (const column of expectedColumns) {
      if (columnNames.includes(column)) {
        console.log(`  ✅ ${column}`);
      } else {
        console.log(`  ❌ ${column} (缺失)`);
      }
    }
    
    // 检查索引
    console.log('\n📋 验证索引...');
    const [indexes]: any = await connection.query('SHOW INDEX FROM post_logs');
    const indexNames = indexes.map((idx: any) => idx.Key_name);
    
    const expectedIndexes = [
      'idx_task_id',
      'idx_status_trigger_created',
      'idx_total_duration',
    ];
    
    console.log('\n新增索引检查：');
    for (const index of expectedIndexes) {
      if (indexNames.includes(index)) {
        console.log(`  ✅ ${index}`);
      } else {
        console.log(`  ❌ ${index} (缺失)`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行迁移
applyMigration032()
  .then(() => {
    console.log('\n✨ 所有操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 迁移过程中发生错误:', error);
    process.exit(1);
  });
