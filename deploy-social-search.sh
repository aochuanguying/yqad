#!/bin/bash
set -e

echo "=== 部署 social-search 服务 ==="
echo ""

cd /Users/wangfuwei/Documents/Workspace/krio/yqad/services/social-search

# 1. 本地编译 TypeScript
echo "1. 本地编译 TypeScript..."
npm install
npm run build

# 2. 创建临时目录并复制必要文件
echo "2. 准备部署包..."
rm -rf /tmp/social-search-deploy
mkdir -p /tmp/social-search-deploy
cp -r src package*.json .npmrc tsconfig.json Dockerfile dist /tmp/social-search-deploy/
mkdir -p /tmp/social-search-deploy/scripts
cp scripts/*.ts /tmp/social-search-deploy/scripts/ 2>/dev/null || true
mkdir -p /tmp/social-search-deploy/web
cp web/* /tmp/social-search-deploy/web/ 2>/dev/null || true

# 3. 压缩
echo "3. 压缩部署包..."
cd /tmp/social-search-deploy
tar -czf /tmp/social-search-deploy.tar.gz .

# 4. 传输到服务器
echo "4. 传输到服务器..."
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 "mkdir -p /root/yqad/services/social-search"
sshpass -p 'Wfw7539148@' scp /tmp/social-search-deploy.tar.gz root@192.168.50.10:/tmp/social-search-deploy.tar.gz

# 5. 在服务器上解压并构建
echo "5. 在服务器上构建 Docker 镜像..."
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 << 'ENDSSH'
cd /root/yqad/services/social-search
rm -rf src package*.json tsconfig.json Dockerfile dist scripts web
cd /tmp
tar -xzf social-search-deploy.tar.gz -C /root/yqad/services/social-search/
cd /root/yqad/services/social-search
docker build -f Dockerfile -t social-search:latest .
ENDSSH

# 6. 停止旧容器
echo "6. 停止旧容器..."
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 "docker stop social-search 2>/dev/null || true"

# 7. 删除旧容器
echo "7. 删除旧容器..."
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 "docker rm social-search 2>/dev/null || true"

# 8. 启动新容器
echo "8. 启动新容器..."
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 << 'ENDSSH'
docker run -d --name social-search --restart unless-stopped \
  --network docker_default \
  -v social-search-data:/app/data \
  -e NODE_ENV=production \
  -e MYSQL_HOST=mysql \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD='Wfw7539148@' \
  -e MYSQL_DATABASE=yqad_prod_db \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e ADMIN_USERNAME=wangfwuei \
  -e ADMIN_PASSWORD='Wfw7539148@' \
  -e JWT_SECRET='7cae58eafcbbc8b4c6af0884a85dd38ae0da5125088a3b01b1db659417f22762' \
  -p 3090:3090 \
  social-search:latest
ENDSSH

# 9. 验证
echo "9. 验证部署..."
sleep 3
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 "docker logs --tail 30 social-search"

# 10. 清理
echo "10. 清理临时文件..."
rm -f /tmp/social-search-deploy.tar.gz
rm -rf /tmp/social-search-deploy
sshpass -p 'Wfw7539148@' ssh root@192.168.50.10 "rm -f /tmp/social-search-deploy.tar.gz"

echo ""
echo "=== 部署完成 ==="
echo ""
echo "测试访问：curl http://192.168.50.10:3090/admin"
