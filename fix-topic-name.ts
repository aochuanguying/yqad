/**
 * 修复发帖日志中缺失的 topic_name 字段
 * 从 topic_id 关联查询主题名称并更新
 */

import MySQLConnectionManager from './src/utils/mysql-connection-manager';

async function fixTopicName() {
  console.log('开始修复发帖日志的 topic_name 字段...');
  
  try {
    // 连接数据库
    await MySQLConnectionManager.initialize();
    const connection = await MySQLConnectionManager.getConnection();
    
    // 查询 topic_name 为空的记录
    const [rows]: any = await connection.query(`
      SELECT pl.id, pl.topic_id, pl.topic_name, t.title as topic_title
      FROM post_logs pl
      LEFT JOIN topics t ON pl.topic_id = t.id
      WHERE pl.topic_name IS NULL OR pl.topic_name = ''
      LIMIT 100
    `);
    
    console.log(`找到 ${rows.length} 条需要修复的记录`);
    
    if (rows.length === 0) {
      console.log('无需修复');
      return;
    }
    
    // 更新每条记录
    let updated = 0;
    for (const row of rows) {
      if (row.topic_title) {
        await connection.query(
          'UPDATE post_logs SET topic_name = ? WHERE id = ?',
          [row.topic_title, row.id]
        );
        updated++;
        console.log(`更新记录 ${row.id}: topic_name = "${row.topic_title}"`);
      } else {
        console.log(`跳过记录 ${row.id}: 未找到对应的主题 (topic_id: ${row.topic_id})`);
      }
    }
    
    console.log(`\n✅ 修复完成！更新了 ${updated}/${rows.length} 条记录`);
    
    // 释放连接
    MySQLConnectionManager.releaseConnection(connection);
  } catch (error: any) {
    console.error('修复失败:', error.message);
    process.exit(1);
  }
}

fixTopicName();
