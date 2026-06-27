const mysql = require('mysql2/promise');

async function initProdDatabase() {
  const pool = mysql.createPool({
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_prod_db',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log('=== 生产环境 Telecom 配置初始化 ===\n');

    // 1. 检查并创建 mobile_service_config 表
    console.log('1. 检查 mobile_service_config 表...');
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'yqad_prod_db' 
        AND TABLE_NAME = 'mobile_service_config'
    `);

    if (tables.length === 0) {
      console.log('   创建 mobile_service_config 表...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mobile_service_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          api_url VARCHAR(500) DEFAULT NULL,
          api_token VARCHAR(500) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✅ mobile_service_config 表创建成功');
      
      // 插入默认数据
      await pool.query(`
        INSERT INTO mobile_service_config (api_url, api_token)
        VALUES ('http://10.6.0.2:5000', 'rDmpsGmKhmeGCt86h_Ovhxxtp1Mt2CxOu7p3Xac6xPg')
      `);
      console.log('   ✅ 默认数据插入成功');
    } else {
      console.log('   ✅ mobile_service_config 表已存在');
      
      // 检查是否有数据
      const [rows] = await pool.query('SELECT id FROM mobile_service_config LIMIT 1');
      if (rows.length === 0) {
        await pool.query(`
          INSERT INTO mobile_service_config (api_url, api_token)
          VALUES ('http://10.6.0.2:5000', 'rDmpsGmKhmeGCt86h_Ovhxxtp1Mt2CxOu7p3Xac6xPg')
        `);
        console.log('   ✅ 默认数据插入成功');
      } else {
        console.log('   ✅ 表已有数据');
      }
    }

    // 2. 检查并更新 telecom_api_config 表
    console.log('\n2. 检查 telecom_api_config 表...');
    const [telecomTables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'yqad_prod_db' 
        AND TABLE_NAME = 'telecom_api_config'
    `);

    if (telecomTables.length === 0) {
      console.log('   创建 telecom_api_config 表...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telecom_api_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          enabled TINYINT(1) DEFAULT 1,
          alert_phone VARCHAR(20) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✅ telecom_api_config 表创建成功');
      
      // 插入默认数据
      await pool.query(`
        INSERT INTO telecom_api_config (enabled, alert_phone)
        VALUES (1, '18953272532')
      `);
      console.log('   ✅ 默认数据插入成功');
    } else {
      console.log('   ✅ telecom_api_config 表已存在');
      
      // 检查是否需要删除 api_url 和 api_token 列
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'yqad_prod_db' 
          AND TABLE_NAME = 'telecom_api_config' 
          AND COLUMN_NAME IN ('api_url', 'api_token')
      `);

      if (columns.length > 0) {
        console.log('   删除 api_url 和 api_token 列...');
        await pool.query(`
          ALTER TABLE telecom_api_config 
          DROP COLUMN api_url,
          DROP COLUMN api_token
        `);
        console.log('   ✅ 列删除成功');
      } else {
        console.log('   ✅ 表结构正确');
      }
      
      // 检查是否有数据
      const [rows] = await pool.query('SELECT id FROM telecom_api_config LIMIT 1');
      if (rows.length === 0) {
        await pool.query(`
          INSERT INTO telecom_api_config (enabled, alert_phone)
          VALUES (1, '18953272532')
        `);
        console.log('   ✅ 默认数据插入成功');
      } else {
        console.log('   ✅ 表已有数据');
      }
    }

    // 3. 验证结果
    console.log('\n3. 验证数据...');
    const [msConfig] = await pool.query('SELECT * FROM mobile_service_config LIMIT 1');
    console.log('   mobile_service_config:', JSON.stringify(msConfig[0], null, 2));

    const [telecomConfig] = await pool.query('SELECT * FROM telecom_api_config LIMIT 1');
    console.log('   telecom_api_config:', JSON.stringify(telecomConfig[0], null, 2));

    console.log('\n✅ 生产环境初始化完成！');
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

initProdDatabase();
