#!/bin/bash

# 群晖 Docker 快速部署脚本
# 适用于小红书 Cookie 自动刷新项目

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="/volume1/docker/xiaohongshu"

echo "=============================================="
echo "🚀 群晖 Docker 快速部署脚本"
echo "=============================================="
echo ""

# 检查是否在群晖上运行
if [ ! -d "/volume1" ]; then
    echo "⚠️  警告：未在群晖系统上检测到 /volume1 目录"
    echo "💡 如果是本地测试，请手动创建目录或修改脚本"
    read -p "是否继续？(y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. 创建目录结构
echo "📁 创建目录结构..."
mkdir -p "$PROJECT_DIR/docker"
mkdir -p "$PROJECT_DIR/scripts"
mkdir -p "$PROJECT_DIR/browser_data"
mkdir -p "$PROJECT_DIR/qr_codes"
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/output"

echo "✅ 目录创建完成：$PROJECT_DIR"
echo ""

# 2. 复制文件
echo "📋 复制文件..."

# 复制 Docker 配置文件
cp "$SCRIPT_DIR/Dockerfile" "$PROJECT_DIR/docker/"
cp "$SCRIPT_DIR/docker-compose.yml" "$PROJECT_DIR/docker/"
echo "✅ Docker 配置文件已复制"

# 复制脚本文件
cd "$SCRIPT_DIR/.."
cp scripts/*.py "$PROJECT_DIR/scripts/"
cp scripts/*.sh "$PROJECT_DIR/scripts/" 2>/dev/null || true
echo "✅ 脚本文件已复制"

echo ""

# 3. 设置权限
echo "🔐 设置权限..."
chmod -R 755 "$PROJECT_DIR/scripts"
chmod -R 755 "$PROJECT_DIR/docker"
chmod 777 "$PROJECT_DIR/browser_data"
chmod 777 "$PROJECT_DIR/qr_codes"
chmod 777 "$PROJECT_DIR/logs"
echo "✅ 权限设置完成"
echo ""

# 4. 检查 Docker
echo "🐳 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker 套件"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    echo "💡 请通过 SSH 安装：curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

echo "✅ Docker 版本：$(docker --version)"
echo "✅ Docker Compose 版本：$(docker-compose --version)"
echo ""

# 5. 构建镜像
echo "🔨 构建 Docker 镜像..."
cd "$PROJECT_DIR/docker"
docker-compose build

echo "✅ 镜像构建完成"
echo ""

# 6. 启动服务
echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "=============================================="
echo "✅ 部署完成!"
echo "=============================================="
echo ""
echo "📁 项目目录：$PROJECT_DIR"
echo "📋 配置文件：$PROJECT_DIR/docker/docker-compose.yml"
echo "📝 日志目录：$PROJECT_DIR/logs"
echo "📱 二维码目录：$PROJECT_DIR/qr_codes"
echo "💾 浏览器数据：$PROJECT_DIR/browser_data"
echo ""
echo "💡 下一步操作:"
echo ""
echo "1. 查看日志，等待生成二维码:"
echo "   cd $PROJECT_DIR/docker"
echo "   docker-compose logs -f"
echo ""
echo "2. 在群晖文件管理器中打开二维码图片:"
echo "   $PROJECT_DIR/qr_codes/xiaohongshu_login_qr.png"
echo ""
echo "3. 用手机��红书 APP 扫码登录"
echo ""
echo "4. 验证登录成功:"
echo "   docker-compose logs | grep 'Cookie 已成功保存'"
echo ""
echo "=============================================="
echo ""

# 提示查看日志
read -p "是否立即查看日志？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$PROJECT_DIR/docker"
    docker-compose logs -f
fi
