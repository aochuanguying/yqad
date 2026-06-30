# 小红书 Cookie 自动刷新 - Docker 部署指南

## 部署到 NAS（群晖 Docker）

### 1. 构建 Docker 镜像

在本地 Mac 上构建镜像：

```bash
# 编译代码
npm run build

# 构建 Docker 镜像
docker build -t yqad-app:latest .
```

### 2. 上传镜像到 NAS

```bash
# 保存镜像为 tar 文件
docker save -o yqad-app.tar yqad-app:latest

# 上传到 NAS（替换为你的 NAS IP）
scp yqad-app.tar root@192.168.50.50:/volume1/docker/

# 或者使用 rsync
rsync -avh yqad-app.tar root@192.168.50.50:/volume1/docker/
```

### 3. 在 NAS 上加载并运行

SSH 登录到 NAS：

```bash
ssh root@192.168.50.50
```

加载镜像：

```bash
cd /volume1/docker
docker load -i yqad-app.tar
```

创建数据目录：

```bash
mkdir -p /volume1/docker/yqad/{config,data,logs}
cp -r /path/to/local/config/* /volume1/docker/yqad/config/
```

启动容器：

```bash
docker run -d \
  --name yqad-app \
  --restart always \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MYSQL_HOST=192.168.50.50 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=Wfw7539148@ \
  -e MYSQL_DATABASE=yqad_db \
  -v /volume1/docker/yqad/config:/app/config \
  -v /volume1/docker/yqad/data:/app/data \
  -v /volume1/docker/yqad/logs:/app/logs \
  --shm-size=2gb \
  --security-opt seccomp:unconfined \
  yqad-app:latest
```

### 4. 使用 Docker Compose（推荐）

在 NAS 上创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  yqad:
    image: yqad-app:latest
    container_name: yqad-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MYSQL_HOST=192.168.50.50
      - MYSQL_USER=root
      - MYSQL_PASSWORD=Wfw7539148@
      - MYSQL_DATABASE=yqad_db
    volumes:
      - /volume1/docker/yqad/config:/app/config
      - /volume1/docker/yqad/data:/app/data
      - /volume1/docker/yqad/logs:/app/logs
    shm_size: '2gb'
    security_opt:
      - seccomp:unconfined
```

启动：

```bash
docker-compose up -d
```

### 5. 访问应用

打开浏览器访问：`http://你的 NAS-IP:3000`

### 6. 刷新 Cookie 流程

1. 访问 `http://你的 NAS-IP:3000`
2. 点击"刷新 Cookie"按钮
3. **浏览器会在后台启动（用户看不到）**
4. 网页上会显示二维码截图
5. **用手机扫描网页上的二维码**
6. 扫码成功后，Cookie 会自动保存到数据库

### 7. 查看日志

```bash
# 查看容器日志
docker logs -f yqad-app

# 或者查看日志文件
tail -f /volume1/docker/yqad/logs/app.log
```

### 8. 停止和删除

```bash
# 停止容器
docker stop yqad-app

# 删除容器
docker rm yqad-app

# 删除镜像
docker rmi yqad-app:latest
```

## 本地测试 Docker

在本地 Mac 上测试 Docker 镜像：

```bash
# 构建
docker build -t yqad-app:latest .

# 运行
docker run -d \
  --name yqad-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MYSQL_HOST=192.168.50.50 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=Wfw7539148@ \
  -e MYSQL_DATABASE=yqad_db \
  yqad-app:latest

# 访问 http://localhost:3000 测试

# 停止
docker stop yqad-app
docker rm yqad-app
```

## 注意事项

1. **共享内存**：必须设置 `--shm-size=2gb`，否则浏览器可能崩溃
2. **安全选项**：需要 `--security-opt seccomp:unconfined` 以允许无沙盒运行
3. **数据持久化**：通过 volumes 挂载配置、数据和日志目录
4. **网络**：确保 NAS 和 MySQL 数据库（192.168.50.50）网络连通
5. **防火墙**：确保 NAS 的 3000 端口开放

## 故障排查

### 浏览器启动失败

```bash
# 检查日志
docker logs yqad-app

# 进入容器调试
docker exec -it yqad-app /bin/bash
echo $DISPLAY  # 应该显示 :99
ps aux | grep Xvfb  # 检查 Xvfb 是否运行
```

### Cookie 保存失败

检查 MySQL 连接：
```bash
docker exec -it yqad-app /bin/bash
ping 192.168.50.50
```

### 二维码不显示

检查 data 目录权限：
```bash
ls -la /volume1/docker/yqad/data/qr_codes/
chmod -R 755 /volume1/docker/yqad/data
```
