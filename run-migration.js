const mysql = require('mysql2/promise');

async function runMigration() {
  let conn;
  try {
    console.log('正在连接 MySQL...');
    conn = await mysql.createConnection({
      host: '192.168.50.50',
      port: 3306,
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_db',
    });
    
    console.log('✅ MySQL 连接成功');
    
    // 直接执行 CREATE TABLE
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`network_post_config\` (
        \`id\` INT PRIMARY KEY DEFAULT 1 COMMENT '配置 ID，固定为 1',
        \`zhihu_access_secret\` VARCHAR(255) DEFAULT '' COMMENT '知乎 Access Secret',
        \`zhihu_enabled\` TINYINT(1) DEFAULT 0 COMMENT '是否启用知乎搜索',
        \`xiaohongshu_cookie\` TEXT COMMENT '小红书 Cookie',
        \`xiaohongshu_enabled\` TINYINT(1) DEFAULT 0 COMMENT '是否启用小红书搜索',
        \`autohome_cookie\` TEXT COMMENT '汽车之家 Cookie',
        \`autohome_enabled\` TINYINT(1) DEFAULT 0 COMMENT '是否启用汽车之家搜索',
        \`max_results\` INT DEFAULT 10 COMMENT '默认返回结果数量',
        \`enabled\` TINYINT(1) DEFAULT 1 COMMENT '是否启用网络发帖功能',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络发帖配置表'
    `;
    
    console.log('正在创建表...');
    await conn.query(createTableSQL);
    console.log('✅ 表创建成功');
    
    // 插入默认配置
    const insertSQL = `
      INSERT INTO \`network_post_config\` (\`id\`, \`enabled\`) 
      VALUES (1, 1)
      ON DUPLICATE KEY UPDATE \`id\` = \`id\`
    `;
    
    console.log('正在插入默认配置...');
    await conn.query(insertSQL);
    console.log('✅ 默认配置插入成功');
    
    // 验证
    const [rows] = await conn.query('SELECT * FROM network_post_config WHERE id = 1');
    console.log('\n📋 当前配置:', JSON.stringify(rows[0], null, 2));
    
  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

runMigration();
