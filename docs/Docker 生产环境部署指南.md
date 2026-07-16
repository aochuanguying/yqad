# YQAD 生产环境 Docker 部署指南

## 概述

本文档介绍如何使用 Docker 部署 YQAD 应用到生产环境，连接生产数据库。

## 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 生产数据库访问权限 (MySQL + Redis)
- Node.js 18+ (用于构建)

## 目录结构

```
yqad/
├── docker-compose.prod.yml      # 生产环境 Docker Compose 配置
├── .env.production              # 生产环境变量配置
├── Dockerfile                   # 主应用 Docker 镜像
├── docker/
│   ├── Dockerfile               # 小红书 Cookie 刷新服务镜像
│   └── docker-compose.yml       # Cookie 刷新服务配置
├── config/
│   └── default.yaml             # 应用配置文件
└── docs/
    └── DOCKER_PRODUCTION_DEPLOYMENT.md  # 本文件
```

## 数据库配置

当前配置连接的生产数据库：

- **MySQL**: `192.168.50.50:3306`
  - 数据库：`yqad_prod_db`
  - 用户：`root`
  
- **Redis**: `192.168.50.50:6379`
  - DB: `1`
  - Key 前缀：`prod:`

## 快速开始

### 1. 构建并启动

```bash
# 使用生产环境配置启动
docker-compose -f docker-compose.prod.yml up -d --build
```

### 2. 查看服务状态

```bash
# 查看容器状态
docker-compose -f docker-compose.prod.yml ps

# 查看应用日志
docker-compose -f docker-compose.prod.yml logs -f yqad-prod

# 查看 Cookie 刷新服务日志
docker-compose -f docker-compose.prod.yml logs -f xiaohongshu-cookie-refresh
```

### 3. 停止服务

```bash
# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 停止并删除数据卷（谨慎使用！）
docker-compose -f docker-compose.prod.yml down -v
```

## 服务说明

### yqad-prod (主应用)

- **容器名称**: `yqad-prod-app`
- **端口**: 3000
- **功能**: YQAD 主应用，包括 Web 服务、定时任务、API 等
- **环境变量**: 通过 `.env.production` 和 `docker-compose.prod.yml` 配置
- **数据卷**:
  - `./config:/app/config` - 配置文件
  - `./data:/app/data` - 数据文件（二维码等）
  - `./logs:/app/logs` - 日志文件

### xiaohongshu-cookie-refresh (Cookie 自动刷新)

- **容器名称**: `xiaohongshu-cookie-refresh-prod`
- **功能**: 每天凌晨 2 点自动刷新小红书 Cookie
- **定时任务**: `0 2 * * *` (每天 2:00 AM)
- **数据卷**:
  - `./browser_data:/tmp/xiaohongshu_browser_data` - 浏览器数据（持久化）
  - `./qr_codes:/tmp/qr_codes` - 二维码图片
  - `./logs:/var/log/xiaohongshu` - 日志文件

## 配置修改

### 修改数据库配置

编辑 `docker-compose.prod.yml`:

```yaml
environment:
  - MYSQL_HOST=你的数据库地址
  - MYSQL_PORT=3306
  - MYSQL_USER=你的用户名
  - MYSQL_PASSWORD=你的密码
  - MYSQL_DATABASE=yqad_prod_db
```

### 修改 Cookie 刷新时间

编辑 `docker-compose.prod.yml` 中的 `command` 部分：

```yaml
command: >
  sh -c "
  echo '0 2 * * * python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py >> /var/log/xiaohongshu/cookie_refresh.log 2>&1' | crontab -
  && crond -f -l 2
  "
```

修改 cron 表达式（例如改为每天 3 点：`0 3 * * *`）

## 常用命令

### 容器管理

```bash
# 重启主应用
docker-compose -f docker-compose.prod.yml restart yqad-prod

# 重启 Cookie 刷新服务
docker-compose -f docker-compose.prod.yml restart xiaohongshu-cookie-refresh

# 进入主应用容器
docker-compose -f docker-compose.prod.yml exec yqad-prod /bin/bash

# 进入 Cookie 刷新服务容器
docker-compose -f docker-compose.prod.yml exec xiaohongshu-cookie-refresh /bin/bash
```

### 日志管理

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看最近 100 行日志
docker-compose -f docker-compose.prod.yml logs --tail=100

# 导出日志到文件
docker-compose -f docker-compose.prod.yml logs > yqad-logs.txt
```

### 资源管理

```bash
# 查看资源使用情况
docker stats yqad-prod-app xiaohongshu-cookie-refresh-prod

# 清理未使用的资源
docker system prune -a
```

## 健康检查

主应用配置了健康检查，可以通过以下命令检查状态：

```bash
# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' yqad-prod-app

# 通过 API 检查
curl http://localhost:3000/api/auth/status
```

## 安全建议

1. **密码安全**: 建议修改 `.env.production` 中的数据库密码
2. **网络隔离**: 使用 Docker 网络隔离服务
3. **只读挂载**: 配置文件以只读方式挂载
4. **非 root 用户**: 容器内使用非 root 用户运行
5. **资源限制**: 已配置 CPU 和内存限制，防止资源耗尽

## 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs yqad-prod

# 检查配置文件
docker-compose -f docker-compose.prod.yml config
```

### 数据库连接失败

1. 检查网络连通性
2. 验证数据库地址和端口
3. 确认用户名密码正确
4. 检查数据库是否允许远程连接

### Cookie 刷新失败

1. 检查浏览器数据目录权限
2. 查看 Cookie 刷新日志
3. 验证数据库连接
4. 检查 Playwright 浏览器是否正常

## 备份与恢复

### 备份浏览器数据

```bash
# 备份 Cookie 刷新服务的浏览器数据
tar -czf browser_data_backup.tar.gz ./browser_data
```

### 恢复浏览器数据

```bash
# 恢复浏览器数据
tar -xzf browser_data_backup.tar.gz
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose -f docker-compose.prod.yml up -d --build --force-recreate
```

## 监控建议

1. **日志监控**: 定期检查 `/logs` 目录下的日志文件
2. **资源监控**: 使用 `docker stats` 监控资源使用
3. **健康检查**: 定期检查健康检查端点
4. **数据库监控**: 监控数据库连接数和性能

## 联系支持

如有问题，请查看日志或联系开发团队。
