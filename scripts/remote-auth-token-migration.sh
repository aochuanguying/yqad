#!/bin/bash
# 在生产服务器上执行 auth_tokens 表迁移

set -e

DB_HOST="mysql"
DB_USER="root"
DB_PASS="Wfw7539148@"
DB_NAME="yqad_prod_db"

echo "========================================"
echo "📝 在生产数据库创建 auth_tokens 表"
echo "========================================"

# 执行 SQL
docker exec yqad node -e "
const mysql = require('mysql2/promise');

async function runMigration() {
  const conn = await mysql.createConnection({
    host: '$DB_HOST',
    user: '$DB_USER',
    password: '$DB_PASS',
    database: '$DB_NAME',
  });
  
  const sql = \`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键 ID',
      access_token TEXT NOT NULL COMMENT 'JWT 登录 Token',
      expires_at DATETIME NOT NULL COMMENT 'Token 过期时间',
      refreshed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后刷新时间',
      refresh_source VARCHAR(50) NOT NULL DEFAULT 'telecom_api' COMMENT '刷新来源',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_expires_at (expires_at),
      INDEX idx_refreshed_at (refreshed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录 Token 存储表'
  \`;
  
  await conn.execute(sql);
  console.log('✅ auth_tokens 表创建成功');
  
  const [rows] = await conn.execute('DESCRIBE auth_tokens');
  console.log('\\n表结构:');
  rows.forEach(row => {
    console.log(\`  - \${row.Field}: \${row.Type}\`);
  });
  
  await conn.end();
}

runMigration().catch(console.error);
"

echo ""
echo "========================================"
echo "✅ 迁移完成"
echo "========================================"
