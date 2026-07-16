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
echo -e "${GREEN}  YQAD 生产环境 Docker 停止脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查配置文件是否存在
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}错误：docker-compose.prod.yml 不存在${NC}"
    exit 1
fi

# 停止容器
echo -e "${YELLOW}停止所有容器...${NC}"
docker-compose -f docker-compose.prod.yml down

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  所有容器已停止${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}提示:${NC}"
echo "  - 重新启动：./scripts/start-prod-docker.sh"
echo "  - 查看日志：docker-compose -f docker-compose.prod.yml logs"
echo "  - 删除数据卷：docker-compose -f docker-compose.prod.yml down -v (谨慎使用!)"
echo ""
