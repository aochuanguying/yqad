#!/bin/bash

# 安全初始化生产数据库脚本
# 使用方法：./scripts/safe-init.sh

set -e

echo "======================================"
echo "安全初始化生产数据库"
echo "======================================"
echo ""

# 检查是否安装了必要的依赖
if ! command -v npm &> /dev/null; then
    echo "❌ 错误：npm 未安装"
    exit 1
fi

echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装依赖..."
    npm install
fi

echo ""
echo "⚠️  重要提示："
echo "   此脚本将执行以下操作："
echo "   1. 执行所有数据库迁移（创建缺失的表）"
echo "   2. 初始化缺失的配置数据"
echo "   3. 创建默认管理员账户（如果不存在）"
echo ""
echo "   ✅ 所有操作都不会影响已有数据"
echo ""

# 读取数据库配置
if [ -f ".env" ]; then
    echo "✅ 使用 .env 文件中的数据库配置"
    source .env
    echo "   数据库：${MYSQL_HOST:-localhost}:${MYSQL_PORT:-3306}/${MYSQL_DATABASE:-yqad_prod_db}"
elif [ -f "deploy/synology/.env" ]; then
    echo "✅ 使用 deploy/synology/.env 文件中的数据库配置"
    source deploy/synology/.env
    echo "   数据库：${MYSQL_HOST:-localhost}:${MYSQL_PORT:-3306}/${MYSQL_DATABASE:-yqad_prod_db}"
else
    echo "⚠️  未找到 .env 文件，将使用默认配置或环境变量"
fi

echo ""
read -p "是否继续执行？(y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ 已取消"
    exit 0
fi

echo ""
echo "======================================"
echo "开始初始化..."
echo "======================================"
echo ""

# 执行安全初始化
npm run safe-init-db

echo ""
echo "======================================"
echo "✅ 初始化完成！"
echo "======================================"
echo ""
echo "下一步："
echo "1. 访问 Web 管理界面：http://localhost:3000"
echo "2. 使用默认账户登录：admin / admin123"
echo "3. 立即修改默认密码！"
echo "4. 在 Web 界面配置其他参数"
echo ""
