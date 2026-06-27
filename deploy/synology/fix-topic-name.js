const mysql = require('mysql2/promise');

async function fixTopicName() {
  console.log('开始修复发帖日志的 topic_name 字段...\n');
  
  let connection;
  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: '192.168.50.50',
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_db',
    });
    
    console.log('✅ 数据库连接成功\n');
    
    // 查看需要修复的记录数
    const [checkRows] = await connection.query(`
      SELECT COUNT(*) as count
      FROM post_logs pl 
      WHERE (pl.topic_name IS NULL OR pl.topic_name = '') 
        AND pl.topic_id IS NOT NULL
    `);
    
    console.log(`📊 需要修复的记录数：${checkRows[0].count}`);
    
    if (checkRows[0].count === 0) {
      console.log('✅ 无需修复');
      return;
    }
    
    // 执行更新
    const [result] = await connection.query(`
      UPDATE post_logs pl
      INNER JOIN topics t ON pl.topic_id = t.id
      SET pl.topic_name = t.title
      WHERE (pl.topic_name IS NULL OR pl.topic_name = '')
        AND pl.topic_id IS NOT NULL
    `);
    
    console.log(`✅ 更新了 ${result.affectedRows} 条记录\n`);
    
    // 验证修复结果
    const [verifyRows] = await connection.query(`
      SELECT pl.id, pl.topic_id, pl.topic_name, t.title as expected_name
      FROM post_logs pl
      INNER JOIN topics t ON pl.topic_id = t.id
      WHERE pl.topic_name IS NOT NULL AND pl.topic_name != ''
      ORDER BY pl.created_at DESC
      LIMIT 10
    `);
    
    console.log('📋 最近修复的 10 条记录:');
    verifyRows.forEach(row => {
      console.log(`  - ID: ${row.id}, Topic: ${row.topic_name}`);
    });
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixTopicName();
