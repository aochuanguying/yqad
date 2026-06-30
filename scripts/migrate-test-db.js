/**
 * 为测试数据库添加缺失的字段
 * 解决：Unknown column 'cookie_version' in 'field list' 错误
 */

const mysql = require('mysql2/promise');

const config = {
  host: '192.168.50.50',
  port: 3306,
  user: 'root',
  password: 'Wfw7539148@',
  database: 'yqad_db', // 测试库
};

async function migrate() {
  let conn;
  
  try {
    console.log('🔗 连接到测试数据库...');
    conn = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功');

    // 检查并添加 cookie_version 字段
    console.log('\n📋 检查 network_post_config 表字段...');
    
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${config.database}' 
        AND TABLE_NAME = 'network_post_config'
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('现有字段:', existingColumns.join(', '));

    const fieldsToAdd = [
      { name: 'cookie_version', sql: 'INT DEFAULT 0' },
      { name: 'last_refresh_time', sql: 'DATETIME NULL' },
      { name: 'next_refresh_time', sql: 'DATETIME NULL' },
      { name: 'cookie_refresh_logs', sql: 'TEXT NULL' },
    ];

    for (const field of fieldsToAdd) {
      if (!existingColumns.includes(field.name)) {
        console.log(`\n➕ 添加字段：${field.name}`);
        await conn.query(`
          ALTER TABLE network_post_config 
          ADD COLUMN ${field.name} ${field.sql}
        `);
        console.log(`✅ 字段 ${field.name} 添加成功`);
      } else {
        console.log(`⏭️  字段 ${field.name} 已存在，跳过`);
      }
    }

    console.log('\n✅ 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    if (conn) {
      await conn.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
