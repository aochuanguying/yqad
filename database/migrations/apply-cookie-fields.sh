#!/bin/bash
# 执行 Cookie 字段迁移脚本

echo "正在执行数据库迁移..."
mysql -h 192.168.50.50 -u root -p'Wfw7539148@' yqad_prod_db < /Users/mac/Documents/workspace/krio/yqad/database/migrations/add-cookie-fields.sql

if [ $? -eq 0 ]; then
    echo "✅ 数据库迁移成功！"
    echo ""
    echo "验证字段："
    mysql -h 192.168.50.50 -u root -p'Wfw7539148@' yqad_prod_db -e "DESC network_post_config;" | grep -E "cookie|version|refresh"
else
    echo "❌ 数据库迁移失败！"
    exit 1
fi
