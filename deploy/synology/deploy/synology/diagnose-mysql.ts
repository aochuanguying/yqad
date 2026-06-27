import mysql from 'mysql2/promise';
import net from 'net';

async function diagnoseMySQL() {
  const host = '192.168.50.50';
  const port = 3306;
  
  console.log('=== MySQL 连接诊断 ===\n');
  console.log(`目标：${host}:${port}\n`);
  
  // 1. TCP 连接测试
  console.log('1️⃣  TCP 端口连接测试...');
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(port, host, () => {
        socket.end();
        resolve();
      });
      socket.on('error', reject);
      socket.setTimeout(5000);
    });
    console.log('✅ TCP 端口 3306 可访问\n');
  } catch (error: any) {
    console.log(`❌ TCP 端口 3306 不可访问：${error.message}\n`);
    console.log('可能原因:');
    console.log('1. MySQL 服务未启动');
    console.log('2. 防火墙阻止了 3306 端口');
    console.log('3. MySQL 只监听 localhost\n');
    return;
  }
  
  // 2. MySQL 连接测试（无数据库）
  console.log('2️⃣  MySQL 基础连接测试...');
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user: 'root',
      password: 'Wfw7539148@',
      connectTimeout: 10000,
    });
    
    console.log('✅ MySQL 服务器连接成功');
    
    const [version]: any = await connection.execute('SELECT VERSION() as version');
    console.log(`MySQL 版本：${version[0].version}\n`);
    
    await connection.end();
  } catch (error: any) {
    console.log(`❌ MySQL 连接失败：${error.message}`);
    console.log(`错误代码：${error.code}\n`);
  }
  
  // 3. 尝试连接数据库
  console.log('3️⃣  数据库连接测试...');
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user: 'root',
      password: 'Wfw7539148@',
      database: 'yqad_db',
      connectTimeout: 10000,
    });
    
    console.log('✅ 数据库 yqad_db 连接成功\n');
    await connection.end();
  } catch (error: any) {
    console.log(`❌ 数据库连接失败：${error.message}`);
    console.log(`错误代码：${error.code}\n`);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 数据库不存在，正在创建...');
      try {
        const connection = await mysql.createConnection({
          host,
          port,
          user: 'root',
          password: 'Wfw7539148@',
          connectTimeout: 10000,
        });
        
        await connection.execute('CREATE DATABASE IF NOT EXISTS yqad_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        console.log('✅ 数据库 yqad_db 创建成功\n');
        await connection.end();
      } catch (createError: any) {
        console.log(`❌ 数据库创建失败：${createError.message}\n`);
      }
    }
  }
  
  console.log('=== 诊断完成 ===');
}

diagnoseMySQL().catch(console.error);
