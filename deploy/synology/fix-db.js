const mysql = require('mysql2/promise');

async function fix() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '192.168.50.50',
      port: 3306,
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_db'
    });

    console.log('✅ 数据库连接成功\n');

    // 1. 创建 comment_config 表
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS comment_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          enabled TINYINT(1) DEFAULT 0,
          daily_limit INT DEFAULT 3,
          delay_min INT DEFAULT 60,
          delay_max INT DEFAULT 180,
          max_fetch_pages INT DEFAULT 5,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ comment_config 表创建成功');

      await connection.query(`
        INSERT INTO comment_config (enabled, daily_limit, delay_min, delay_max, max_fetch_pages)
        SELECT 0, 3, 60, 180, 5
        WHERE NOT EXISTS (SELECT 1 FROM comment_config)
      `);
      console.log('✅ comment_config 默认数据插入成功');
    } catch (err) {
      console.error('❌ 创建 comment_config 失败:', err.message);
    }

    // 2. 为 vehicle_monitor_config 添加 token 字段
    try {
      await connection.query(`
        ALTER TABLE vehicle_monitor_config 
        ADD COLUMN IF NOT EXISTS token VARCHAR(1000) DEFAULT NULL
      `);
      console.log('✅ vehicle_monitor_config.token 字段添加成功');
    } catch (err) {
      console.error('❌ 添加 token 字段失败:', err.message);
    }

    // 3. 创建 daily_summaries 表
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS daily_summaries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          comment_total INT DEFAULT 0,
          comment_success INT DEFAULT 0,
          post_total INT DEFAULT 0,
          post_success INT DEFAULT 0,
          failed_tasks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ daily_summaries 表创建成功');
    } catch (err) {
      console.error('❌ 创建 daily_summaries 失败:', err.message);
    }

    console.log('\n✅ 数据库修复完成');

  } catch (err) {
    console.error('❌ 连接失败:', err.message);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

fix();
