const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initProdDB() {
  const config = {
    host: '10.6.0.5',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    multipleStatements: true
  };

  let connection;

  try {
    console.log('🚀 开始连接生产数据库...');
    
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功');
    console.log('');

    // 1. 创建数据库
    console.log('📊 步骤 1: 创建数据库 yqad_prod_db ...');
    await connection.query(`
      CREATE DATABASE IF NOT EXISTS \`yqad_prod_db\` 
      DEFAULT CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci;
    `);
    console.log('✅ 数据库创建成功');
    console.log('');

    // 2. 使用数据库
    await connection.query('USE \`yqad_prod_db\`');

    // 3. 禁用外键检查
    console.log('🔧 步骤 2: 禁用外键检查...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    console.log('✅ 外键检查已禁用');
    console.log('');

    // 4. 执行建表 SQL
    console.log('📋 步骤 3: 创建表结构...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'deploy/synology/sql/init.sql'), 'utf8');
    await connection.query(schemaSql);
    console.log('✅ 表结构创建完成');
    console.log('');

    // 5. 执行数据初始化 SQL
    console.log('📝 步骤 4: 初始化数据...');
    const dataSql = fs.readFileSync(path.join(__dirname, 'deploy/synology/sql/init-data.sql'), 'utf8');
    await connection.query(dataSql);
    console.log('✅ 数据初始化完成');
    console.log('');

    // 6. 启用外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    // 7. 验证结果
    console.log('🔍 步骤 5: 验证初始化结果...');
    
    const [tables] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema='yqad_prod_db'
    `);
    console.log(`✅ 表数量：${tables[0].count} 张`);

    const [topics] = await connection.query('SELECT COUNT(*) as count FROM yqad_prod_db.topics');
    console.log(`✅ 主题数量：${topics[0].count} 个`);

    const [prompts] = await connection.query('SELECT COUNT(*) as count FROM yqad_prod_db.global_prompts');
    console.log(`✅ 全局人设：${prompts[0].count} 条`);

    const [admins] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM yqad_prod_db.members 
      WHERE role='admin'
    `);
    console.log(`✅ 管理员账户：${admins[0].count} 个`);

    console.log('');
    console.log('==========================================');
    console.log('✅ 生产环境数据库初始化完成！');
    console.log('==========================================');
    console.log('');
    console.log('📊 初始化概览：');
    console.log(`   - 数据库：yqad_prod_db`);
    console.log(`   - 表数量：${tables[0].count} 张`);
    console.log(`   - 主题：${topics[0].count} 个`);
    console.log(`   - 全局人设：${prompts[0].count} 条`);
    console.log(`   - 管理员：${admins[0].count} 个`);
    console.log('');
    console.log('⚠️  重要提示：');
    console.log('   1. 默认管理员密码：admin123（请立即修改）');
    console.log('   2. 素材文件需手动复制到 data/materials 目录');
    console.log('');

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error('错误 SQL:', error.sql ? error.sql.substring(0, 500) : 'N/A');
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 数据库连接已关闭');
    }
  }
}

initProdDB().catch(console.error);
