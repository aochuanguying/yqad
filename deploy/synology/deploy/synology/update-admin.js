const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function updateAdmin() {
  const config = {
    host: '10.6.0.5',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@'
  };

  let connection;

  try {
    console.log('🚀 开始更新管理员账号...');
    
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功');
    console.log('');

    // 生成密码哈希
    const password = 'Wfw7539148@';
    const passwordHash = bcrypt.hashSync(password, 10);
    console.log(`📝 生成密码哈希：${passwordHash}`);
    console.log('');

    // 更新管理员账号
    console.log('📝 更新管理员账号...');
    await connection.query(`
      UPDATE yqad_prod_db.members 
      SET username = 'wangfuwei', password_hash = ?
      WHERE username = 'admin'
    `, [passwordHash]);
    console.log('✅ 管理员账号已更新');
    console.log('');

    // 验证更新结果
    console.log('🔍 验证更新结果...');
    const [rows] = await connection.query(`
      SELECT id, username, role, created_at 
      FROM yqad_prod_db.members 
      WHERE role = 'admin'
    `);
    
    console.log('✅ 管理员账号信息:');
    console.log(`   - ID: ${rows[0].id}`);
    console.log(`   - 用户名：${rows[0].username}`);
    console.log(`   - 角色：${rows[0].role}`);
    console.log(`   - 创建时间：${rows[0].created_at}`);
    console.log('');

    console.log('==========================================');
    console.log('✅ 管理员账号更新完成！');
    console.log('==========================================');
    console.log('');
    console.log('📊 登录信息:');
    console.log(`   - 用户名：wangfuwei`);
    console.log(`   - 密码：Wfw7539148@`);
    console.log('');
    console.log('🌐 Web 管理界面:');
    console.log('   http://<NAS-IP>:3000');
    console.log('');

  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 数据库连接已关闭');
    }
  }
}

updateAdmin().catch(console.error);
