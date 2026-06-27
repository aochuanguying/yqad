import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';

async function runMigrations() {
  const DB_CONFIG = {
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_db',
  };

  let connection;
  
  try {
    console.log('🚀 开始执行数据库迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ 数据库连接成功');

    // 创建迁移记录表
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await connection.execute(createMigrationsTable);
    console.log('✅ 迁移记录表已创建');

    // 获取已执行的迁移
    const [existing]: any = await connection.execute('SELECT version FROM schema_migrations');
    const existingVersions = new Set(existing.map((row: any) => row.version));

    // 读取迁移文件
    const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 找到 ${migrationFiles.length} 个迁移文件`);

    // 执行迁移
    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      if (existingVersions.has(version)) {
        console.log(`⏭️  跳过已执行的迁移：${version}`);
        continue;
      }

      const sqlPath = path.join(migrationsDir, file);
      let sql = fs.readFileSync(sqlPath, 'utf-8');
      
      // 只提取 -- +migrate Up 部分
      const upMatch = sql.match(/-- \+migrate Up\n([\s\S]*?)(?=-- \+migrate Down|$)/);
      if (upMatch) {
        sql = upMatch[1].trim();
      }

      console.log(`🔧 执行迁移：${version}`);
      await connection.execute(sql);

      // 记录迁移
      await connection.execute(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        [version]
      );

      console.log(`✅ 迁移完成：${version}`);
    }

    console.log('🎉 所有迁移执行完成');
  } catch (error: any) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

runMigrations().catch(console.error);
