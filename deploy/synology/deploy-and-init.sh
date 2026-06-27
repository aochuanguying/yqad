#!/bin/bash
# ============================================================
# 一键部署并初始化生产环境
# ============================================================
# 使用方法：
# 1. 将此脚本上传到 Synology NAS
# 2. SSH 登录 NAS
# 3. 进入目录并执行：bash deploy-and-init.sh
# ============================================================

set -e

echo "=========================================="
echo "🚀 一汽奥迪 APP 自动任务系统 - 生产环境部署"
echo "=========================================="
echo ""

# 配置
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-Yqad@2026Secure}"
MYSQL_DATABASE="yqad_prod_db"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

echo_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查 Docker 是否可用
echo_info "检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo_error "Docker 未找到，请确认已在 Synology 上安装 Docker (Container Manager)"
    exit 1
fi
echo "✅ Docker 可用"
echo ""

# 检查 docker-compose 是否可用
echo_info "检查 Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo_error "Docker Compose 未找到"
    exit 1
fi
echo "✅ Docker Compose 可用"
echo ""

# 检查 .env 文件
echo_info "检查环境配置..."
if [ ! -f .env ]; then
    echo_warn ".env 文件不存在，从模板创建..."
    cp .env.example .env
    
    # 修改密码
    if command -v sed &> /dev/null; then
        sed -i.bak "s/MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD/" .env
        sed -i.bak "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
        rm .env.bak 2>/dev/null || true
    fi
    
    echo "✅ .env 文件已创建"
    echo_warn "请编辑 .env 文件修改密码和其他配置"
else
    echo "✅ .env 文件已存在"
fi
echo ""

# 检查配置文件
echo_info "检查配置文件..."
if [ ! -f config/default.yaml ]; then
    echo_error "config/default.yaml 不存在"
    exit 1
fi
echo "✅ 配置文件就绪"
echo ""

# 启动服务
echo_info "启动 Docker 服务..."
docker-compose up -d --build

echo ""
echo_info "等待服务启动（约 60 秒）..."
sleep 60

# 检查服务状态
echo_info "检查服务状态..."
docker-compose ps

echo ""
echo_info "验证 MySQL 服务..."
MYSQL_READY=false
for i in {1..30}; do
    if docker exec yqad-mysql mysqladmin -u root -p"$MYSQL_ROOT_PASSWORD" ping &> /dev/null; then
        MYSQL_READY=true
        echo "✅ MySQL 服务就绪"
        break
    fi
    echo "   等待 MySQL 启动... ($i/30)"
    sleep 2
done

if [ "$MYSQL_READY" = false ]; then
    echo_error "MySQL 服务启动失败"
    exit 1
fi

# 执行数据库初始化
echo ""
echo "=========================================="
echo "📊 开始初始化数据库..."
echo "=========================================="
echo ""

# 1. 创建数据库
echo_info "创建数据库 $MYSQL_DATABASE ..."
docker exec -i yqad-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`$MYSQL_DATABASE\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "✅ 数据库创建成功"
echo ""

# 2. 执行表结构初始化
echo_info "创建表结构..."
docker exec -i yqad-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < ./sql/init-complete.sql
echo "✅ 表结构创建完成"
echo ""

# 3. 验证初始化结果
echo_info "验证初始化结果..."
echo ""

TABLE_COUNT=$(docker exec -i yqad-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DATABASE';")
echo "✅ 表数量：$TABLE_COUNT 张"

TOPIC_COUNT=$(docker exec -i yqad-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM $MYSQL_DATABASE.topics;")
echo "✅ 主题数量：$TOPIC_COUNT 个"

PROMPT_COUNT=$(docker exec -i yqad-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM $MYSQL_DATABASE.global_prompts;")
echo "✅ 全局人设：$PROMPT_COUNT 条"

ADMIN_COUNT=$(docker exec -i yqad-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM $MYSQL_DATABASE.members WHERE role='admin';")
echo "✅ 管理员账户：$ADMIN_COUNT 个"

echo ""
echo "=========================================="
echo "✅ 数据库初始化完成！"
echo "=========================================="
echo ""

# Redis 初始化
echo_info "初始化 Redis..."
docker exec yqad-redis sh /docker-entrypoint-initdb.d/init-redis.sh
echo "✅ Redis 初始化完成"
echo ""

# ChromaDB 初始化
echo_info "初始化 ChromaDB..."
bash ./scripts/init-chromadb.sh
echo "✅ ChromaDB 初始化完成"
echo ""

# 最终状态检查
echo ""
echo "=========================================="
echo "✅ 所有服务部署和初始化完成！"
echo "=========================================="
echo ""
echo "📊 部署概览："
echo "   - 数据库：$MYSQL_DATABASE"
echo "   - 表数量：$TABLE_COUNT 张"
echo "   - 主题：$TOPIC_COUNT 个"
echo "   - 全局人设：$PROMPT_COUNT 条"
echo "   - 管理员：$ADMIN_COUNT 个"
echo ""
echo "🌐 访问地址："
echo "   Web 界面：http://<NAS-IP>:3000"
echo "   用户名：admin"
echo "   密码：admin123"
echo ""
echo "⚠️  重要提醒："
echo "   1. 立即修改默认密码！"
echo "   2. 复制素材文件：cp -r /Volumes/docker/yqad/data/materials ./data/"
echo "   3. 查看日志：docker-compose logs -f"
echo ""
echo "📚 详细文档："
echo "   - QUICK_START.md - 快速开始指南"
echo "   - DEPLOYMENT.md - 详细部署文档"
echo "   - DATA_MIGRATION.md - 数据迁移说明"
echo ""
