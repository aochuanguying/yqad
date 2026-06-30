const mysql = require('mysql2/promise');

async function runMigration() {
  const conn = await mysql.createConnection({
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_db',
  });

  try {
    console.log('开始执行数据库迁移...');
    
    // 检查字段是否已存在
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'yqad_db' AND TABLE_NAME = 'network_post_config'
    `);
    
    const columnNames = columns.map(row => row.COLUMN_NAME);
    const columnsToAdd = [];
    
    if (!columnNames.includes('cookie_version')) {
      columnsToAdd.push('ADD COLUMN `cookie_version` INT DEFAULT 0 COMMENT \'Cookie 版本号\' AFTER `xiaohongshu_cookie`');
    }
    if (!columnNames.includes('last_refresh_time')) {
      columnsToAdd.push('ADD COLUMN `last_refresh_time` DATETIME DEFAULT NULL COMMENT \'最后刷新时间\' AFTER `cookie_version`');
    }
    if (!columnNames.includes('next_refresh_time')) {
      columnsToAdd.push('ADD COLUMN `next_refresh_time` DATETIME DEFAULT NULL COMMENT \'下次刷新时间\' AFTER `last_refresh_time`');
    }
    if (!columnNames.includes('cookie_refresh_logs')) {
      columnsToAdd.push('ADD COLUMN `cookie_refresh_logs` JSON DEFAULT NULL COMMENT \'最近 30 次刷新记录（JSON）\' AFTER `next_refresh_time`');
    }
    
    if (columnsToAdd.length === 0) {
      console.log('✅ 所有字段已存在，无需迁移');
    } else {
      const sql = `ALTER TABLE \`network_post_config\` ${columnsToAdd.join(', ')}`;
      console.log('执行 SQL:', sql);
      await conn.query(sql);
      console.log('✅ 迁移成功！已添加字段:', columnsToAdd.map(c => c.split(' ')[1]).join(', '));
    }
    
    // 验证
    const [rows] = await conn.query('DESC network_post_config');
    console.log('\n当前表结构：');
    console.table(rows.map(r => ({ Field: r.Field, Type: r.Type, Null: r.Null, Key: r.Key, Default: r.Default, Extra: r.Extra })));
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
