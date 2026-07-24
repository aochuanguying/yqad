#!/bin/bash
# ============================================================
# yqad 部署脚本
# 用法:
#   ./scripts/deploy.sh          # 增量部署（只更新代码，不重建镜像）
#   ./scripts/deploy.sh --full   # 全量部署（重建镜像）
# ============================================================

set -e

SERVER="root@192.168.50.10"
SERVER_PASS="Wfw7539148@"
REMOTE_SRC="/opt/docker/yqad/src"
REMOTE_COMPOSE="/opt/docker/docker-compose.yml"

ssh_cmd() {
  sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SERVER" "$@"
}

rsync_sync() {
  sshpass -p "$SERVER_PASS" rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" "$@"
}

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 开始部署 yqad...${NC}"

# 步骤 1：本地编译
echo -e "${YELLOW}📦 编译 TypeScript...${NC}"
rm -rf dist
npx tsc || true
mkdir -p dist/web/public && cp -r src/web/public/* dist/web/public/
mkdir -p dist/scripts && cp scripts/*.py dist/scripts/ 2>/dev/null || true

# 检查 dist 完整性
if [ ! -f dist/index.js ] || [ ! -f dist/web/public/index.html ]; then
  echo "❌ 编译产物不完整，终止部署"
  exit 1
fi

if [ "$1" == "--full" ]; then
  # ============ 全量部署：重建镜像 ============
  echo -e "${YELLOW}🔨 全量部署：同步源码 + 重建镜像...${NC}"
  
  rsync_sync \
    --exclude='node_modules' --exclude='.git' --exclude='data' \
    --exclude='.DS_Store' --exclude='scripts/zhihu_browser_data' \
    --exclude='scripts/xiaohongshu_browser_data' \
    ./ $SERVER:$REMOTE_SRC/

  echo -e "${YELLOW}🐳 构建镜像（使用缓存）...${NC}"
  ssh_cmd "cd $REMOTE_SRC && docker build --network host -t yqad-app:latest ."

  echo -e "${YELLOW}♻️  重启容器...${NC}"
  ssh_cmd "cd /opt/docker && docker compose up -d yqad"

else
  # ============ 增量部署：只更新代码目录 ============
  echo -e "${YELLOW}⚡ 增量部署：只更新 dist/config/scripts...${NC}"
  
  # 同步 dist、config、scripts 到容器挂载的目录
  # 注意：需要直接 copy 进运行中的容器
  rsync_sync dist/ $SERVER:/opt/docker/yqad/src/dist/
  rsync_sync config/ $SERVER:/opt/docker/yqad/src/config/
  rsync_sync --exclude='zhihu_browser_data' --exclude='xiaohongshu_browser_data' \
    scripts/ $SERVER:/opt/docker/yqad/src/scripts/
  
  # 直接把代码 copy 进容器并重启
  ssh_cmd "docker cp /opt/docker/yqad/src/dist/. yqad:/app/dist/ && \
    docker cp /opt/docker/yqad/src/config/. yqad:/app/config/ && \
    docker cp /opt/docker/yqad/src/scripts/. yqad:/app/scripts/ && \
    docker restart yqad"
fi

# 步骤 3：等待健康检查
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 15

HEALTH=$(ssh_cmd "curl -sf http://localhost:3080/api/auth/status" 2>/dev/null)
if echo "$HEALTH" | grep -q "SUCCESS"; then
  echo -e "${GREEN}✅ 部署成功！服务已就绪：http://192.168.50.10:3080${NC}"
else
  echo "⚠️  健康检查未通过，请检查日志：docker logs yqad"
fi
