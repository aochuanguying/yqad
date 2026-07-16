#!/bin/bash

# 数据库备份脚本
# 在执行清理前备份数据库

echo "📦 开始备份生产数据库..."

BACKUP_DIR="./database/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/yqad_prod_db_backup_${TIMESTAMP}.sql"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行备份
mysqldump -h 192.168.50.50 -P 3306 -u root -p'Wfw7539148@' \
  --databases yqad_prod_db \
  --single-transaction \
  --quick \
  --lock-tables=false \
  > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ 数据库备份成功：$BACKUP_FILE"
  
  # 压缩备份文件
  gzip "$BACKUP_FILE"
  echo "✅ 备份文件已压缩：${BACKUP_FILE}.gz"
else
  echo "❌ 数据库备份失败"
  exit 1
fi
