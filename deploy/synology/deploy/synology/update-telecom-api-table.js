const mysql = require('mysql2/promise');

async function updateTable() {
  const pool = mysql.createPool({
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_db',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log('开始更新 telecom_api_config 表结构...');

    // 检查列是否存在
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'yqad_db' 
        AND TABLE_NAME = 'telecom_api_config' 
        AND COLUMN_NAME IN ('api_url', 'api_token')
    `);

    if (columns.length === 0) {
      console.log('✅ api_url 和 api_token 列已不存在，跳过更新');
      return;
    }

    console.log('发现需要删除的列:', columns.map(c => c.COLUMN_NAME));

    // 删除 api_url 列
    await pool.query(`
      ALTER TABLE telecom_api_config 
      DROP COLUMN api_url,
      DROP COLUMN api_token
    `);

    console.log('✅ 成功删除 api_url 和 api_token 列');

    // 验证表结构
    const [result] = await pool.query('DESC telecom_api_config');
    console.log('\n=== telecom_api_config 表结构 ===');
    console.table(result);

    console.log('\n✅ 表结构更新完成！');
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

updateTable();
