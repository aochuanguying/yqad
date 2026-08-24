#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function runMigration() {
  const fs = require('fs');
  const path = require('path');

  const sqlPath = path.join(__dirname, '../migrations/001_create_cookie_configs.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '192.168.50.10',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'Wfw7539148@',
    database: process.env.MYSQL_DATABASE || 'yqad_prod_db',
  });

  try {
    console.log('🔧 正在执行迁移：创建 cookie_configs 表...');
    await conn.query(sql);
    console.log('✅ 迁移成功！');

    // 验证表是否存在
    const [rows] = await conn.query(
      "SHOW TABLES LIKE 'cookie_configs'"
    );
    if (rows.length > 0) {
      console.log('✅ 验证成功：cookie_configs 表已创建');
    } else {
      console.error('❌ 验证失败：表未找到');
    }
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
