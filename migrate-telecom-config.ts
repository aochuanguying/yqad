/**
 * 数据迁移脚本：将 telecom_api_config 表中的 api_url 和 api_token 迁移到 mobile_service_config 表
 */

import { createPool } from 'mysql2/promise';

async function migrateData() {
  const pool = createPool({
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_db',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log('开始迁移数据...');

    // 1. 从 telecom_api_config 表读取 api_url 和 api_token
    const [rows]: any[] = await pool.query(`
      SELECT api_url, api_token FROM telecom_api_config LIMIT 1
    `);

    if (rows.length === 0) {
      console.log('telecom_api_config 表中没有数据');
      return;
    }

    const { api_url, api_token } = rows[0];
    console.log('读取到数据:', { api_url, api_token: api_token ? '***' + api_token.slice(-4) : null });

    // 2. 检查 mobile_service_config 表是否已有数据
    const [existing]: any[] = await pool.query(`
      SELECT id FROM mobile_service_config LIMIT 1
    `);

    if (existing.length > 0) {
      console.log('mobile_service_config 表已有数据，跳过迁移');
      return;
    }

    // 3. 插入数据到 mobile_service_config 表
    await pool.query(`
      INSERT INTO mobile_service_config (api_url, api_token)
      VALUES (?, ?)
    `, [api_url, api_token]);

    console.log('✅ 数据迁移成功！');
    console.log('  - api_url:', api_url);
    console.log('  - api_token: 已迁移（长度:', api_token?.length, ')');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行迁移
migrateData().catch(console.error);
