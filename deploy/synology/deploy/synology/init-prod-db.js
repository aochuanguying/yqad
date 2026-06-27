const mysql = require('mysql2/promise');

async function initProdDB() {
  console.log('📌 开始连接生产数据库...');
  
  let connection;
  try {
    // 连接生产数据库
    connection = await mysql.createConnection({
      host: '192.168.50.50',
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_prod_db',
      multipleStatements: true
    });

    console.log('✅ 成功连接到生产数据库 yqad_prod_db');

    // 读取 SQL 文件
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, 'deploy/synology/sql/init-complete.sql');
    
    console.log(`📖 读取 SQL 文件：${sqlPath}`);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 开始执行初始化脚本...');
    
    // 执行 SQL
    await connection.query(sqlContent);
    
    console.log('✅ 生产环境数据库初始化完成！');
    
    // 验证数据
    console.log('\n📊 验证数据...');
    
    const [members] = await connection.query('SELECT username, member_level, status FROM members WHERE id = "admin-001"');
    console.log('管理员账户:', members);
    
    const [topics] = await connection.query('SELECT COUNT(*) as count FROM topics');
    console.log('主题数量:', topics[0].count);
    
    const [prompts] = await connection.query('SELECT COUNT(*) as count FROM global_prompts');
    console.log('全局人设数量:', prompts[0].count);
    
    console.log('\n✨ 所有初始化操作完成！');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

initProdDB().catch(console.error);
