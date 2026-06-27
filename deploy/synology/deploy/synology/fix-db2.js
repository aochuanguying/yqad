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

    // 检查 token 字段是否存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'yqad_db' 
      AND TABLE_NAME = 'vehicle_monitor_config' 
      AND COLUMN_NAME = 'token'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE vehicle_monitor_config 
        ADD COLUMN token VARCHAR(1000) DEFAULT NULL
      `);
      console.log('✅ vehicle_monitor_config.token 字段添加成功');
    } else {
      console.log('✅ vehicle_monitor_config.token 字段已存在');
    }

    console.log('\n✅ 数据库修复完成');

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

fix();
