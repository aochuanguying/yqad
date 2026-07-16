#!/bin/bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  YQAD 生产环境 Docker 快速启动脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误：Docker 未安装${NC}"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误：Docker Compose 未安装${NC}"
    exit 1
fi

# 检查配置文件是否存在
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}错误：docker-compose.prod.yml 不存在${NC}"
    exit 1
fi

# 检查 .env.production 是否存在
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}警告：.env.production 不存在，将使用 docker-compose.prod.yml 中的环境变量${NC}"
fi

# 创建必要的目录
echo -e "${YELLOW}创建必要的目录...${NC}"
mkdir -p logs browser_data qr_codes data/qr_codes

# 停止旧容器（如果存在）
echo -e "${YELLOW}停止旧的容器（如果存在）...${NC}"
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# 构建并启动
echo -e "${YELLOW}构建 Docker 镜像...${NC}"
docker-compose -f docker-compose.prod.yml build

echo -e "${YELLOW}启动容器...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 10

# 检查容器状态
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  容器状态${NC}"
echo -e "${GREEN}========================================${NC}"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  启动完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}访问地址：http://localhost:3000${NC}"
echo -e "${YELLOW}查看日志：docker-compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "${YELLOW}停止服务：docker-compose -f docker-compose.prod.yml down${NC}"
echo ""
