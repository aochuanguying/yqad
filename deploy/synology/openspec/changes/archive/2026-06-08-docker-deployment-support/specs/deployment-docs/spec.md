# 群晖 NAS Docker 部署文档规范

## 目标

提供详细的群晖 NAS DS218+ Docker 部署指南，包括安装步骤、配置说明、故障排查和最佳实践。

## 文档结构

### 1. 前置要求

- 群晖 DS218+ 或更高型号
- DSM 7.0 或更高版本
- Container Manager 套件已安装
- 至少 2GB 可用内存
- 至少 10GB 可用存储空间

### 2. 安装步骤

#### 步骤 1：安装 Container Manager

1. 登录群晖 DSM 管理界面
2. 打开"套件中心"
3. 搜索"Container Manager"（或"Docker"）
4. 点击"安装"
5. 等待安装完成

#### 步骤 2：准备项目文件

通过 SSH 或文件管理器上传项目文件：

```bash
# 创建项目目录
mkdir -p /volume1/docker/yqad
cd /volume1/docker/yqad

# 上传项目文件（使用 Git 或文件管理器）
git clone <repo-url> .
```

#### 步骤 3：创建 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

# 安装系统依赖（包括 HEIC/HEIF 支持）
RUN apk add --no-cache \
    vips-dev \
    libheif \
    libexif \
    jpeg-dev \
    png-dev \
    webp-dev \
    tiff-dev

WORKDIR /app

# 复制并安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY dist/ ./dist/
COPY config/ ./config/

# 创建数据目录
RUN mkdir -p /app/data/materials/raw /app/data/materials/processed

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]
```

#### 步骤 4：创建 docker-compose.yml

在项目根目录创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  yqad:
    build: .
    container_name: yqad-auto-post
    volumes:
      - ./data:/app/data
      - ./config:/app/config
      - ./logs:/app/logs
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - TZ=Asia/Shanghai
    restart: unless-stopped
```

#### 步骤 5：配置应用

编辑 `config/local.yaml` 文件：

```yaml
auth:
  username: "你的账号"
  password: "你的密码"

ai:
  providers:
    - name: "gpt"
      apiKey: "你的 API Key"
      baseUrl: "你的 API 地址"
      model: "gpt-5.4-mini"

materials:
  basePath: "/app/data/materials/processed"
  rawPath: "/app/data/materials/raw"
  processedPath: "/app/data/materials/processed"
```

#### 步骤 6：构建并启动

通过 SSH 执行：

```bash
# 构建镜像（首次需要 5-10 分钟）
docker-compose build

# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f
```

#### 步骤 7：访问 Web 界面

打开浏览器访问：`http://<nas-ip>:3000`

### 3. 验证部署

#### 检查容器状态

```bash
docker-compose ps
```

应显示：
```
NAME              STATUS    PORTS
yqad-auto-post    Up        0.0.0.0:3000->3000/tcp
```

#### 测试素材处理

1. 上传 HEIC 文件到 `data/materials/raw/` 目录
2. 访问 Web 界面，点击"🧹 整理素材"
3. 检查日志确认处理成功
4. 在 `data/materials/processed/` 目录查看转换后的 JPEG 文件

#### 检查日志

```bash
# 查看实时日志
docker-compose logs -f

# 查看最近 100 行
docker-compose logs --tail=100
```

### 4. 日常运维

#### 启动/停止/重启

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart
```

#### 查看资源占用

```bash
# 查看容器资源使用
docker stats yqad-auto-post
```

#### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并重启
docker-compose up -d --build
```

#### 数据备份

```bash
# 备份所有数据
tar -czf /volume1/backup/yqad-backup-$(date +%Y%m%d).tar.gz \
  /volume1/docker/yqad/data \
  /volume1/docker/yqad/config \
  /volume1/docker/yqad/logs
```

### 5. 故障排查

#### 问题 1：容器无法启动

**症状：** `docker-compose up -d` 后容器立即退出

**排查步骤：**
```bash
# 查看详细错误
docker-compose logs

# 常见原因：
# - 端口被占用：修改 docker-compose.yml 的端口
# - 配置文件错误：检查 config/local.yaml
# - 内存不足：检查 DSM 资源监控
```

#### 问题 2：HEIC 文件处理失败

**症状：** 素材处理时报错"sips: command not found"

**解决方案：**
```bash
# 检查 libheif 是否安装
docker exec yqad-auto-post apk info | grep libheif

# 如未安装，重新构建镜像
docker-compose build --no-cache
```

#### 问题 3：Web 界面无法访问

**症状：** 浏览器显示"无法连接"

**排查步骤：**
```bash
# 检查容器是否运行
docker-compose ps

# 检查端口映射
docker port yqad-auto-post

# 检查防火墙
# DSM 控制面板 > 安全性 > 防火墙 > 允许 3000 端口
```

#### 问题 4：素材处理缓慢

**症状：** 处理一个 HEIC 文件需要超过 1 分钟

**解决方案：**
```bash
# 1. 检查 CPU/内存占用
docker stats yqad-auto-post

# 2. 减少单次处理数量
# 编辑 config/local.yaml:
# materials.processing.maxFilesPerRun: 100

# 3. 检查磁盘 IO
# DSM 资源监控 > 磁盘
```

#### 问题 5：Token 过期导致 API 调用失败

**症状：** 日志显示"认证失败"或"Token 过期"

**解决方案：**
1. 访问 Web 界面
2. 进入"系统配置"
3. 重新输入账号密码
4. 点击"保存配置"
5. 重启容器：`docker-compose restart`

### 6. 最佳实践

#### 安全配置

- 不要将 `config/local.yaml` 上传到公开代码仓库
- 使用 `.gitignore` 忽略敏感文件
- 定期更新 DSM 和 Container Manager
- 配置防火墙规则限制访问 IP

#### 性能优化

- 将项目放在 SSD 存储池上（如果可用）
- 分配至少 2GB 内存给容器
- 定期清理日志文件（设置日志轮转）
- 避免同时运行多个素材处理任务

#### 监控告警

```bash
# 创建监控脚本 /volume1/docker/yqad/healthcheck.sh
#!/bin/bash
curl -f http://localhost:3000/api/health || exit 1
```

在 docker-compose.yml 中添加：
```yaml
healthcheck:
  test: ["CMD", "/bin/sh", "/app/healthcheck.sh"]
  interval: 30s
  timeout: 10s
  retries: 3
```

#### 日志管理

```bash
# 创建日志轮转配置 /volume1/docker/yqad/logrotate.conf
/volume1/docker/yqad/logs/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
}
```

### 7. 附录

#### 常用命令速查

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启容器
docker-compose restart

# 停止容器
docker-compose down

# 重新构建
docker-compose build

# 进入容器 shell
docker exec -it yqad-auto-post /bin/sh

# 查看资源占用
docker stats yqad-auto-post

# 备份数据
tar -czf backup.tar.gz data/ config/ logs/
```

#### 目录结构

```
/volume1/docker/yqad/
├── Dockerfile              # Docker 构建文件
├── docker-compose.yml      # 容器编排配置
├── dist/                   # 编译后的代码
├── config/
│   ├── default.yaml        # 默认配置
│   └── local.yaml          # 本地配置（敏感）
├── data/
│   ├── materials/
│   │   ├── raw/            # 原始素材
│   │   ��── processed/      # 处理后素材
│   └── token.json          # 认证 Token
└── logs/                   # 日志文件
```

#### 资源推荐

- **最低配置**: 2GB 内存，4 核 CPU，10GB 存储
- **推荐配置**: 4GB 内存，4 核 CPU，20GB 存储
- **DSM 版本**: 7.0 或更高
- **Docker 版本**: 20.10 或更高

## 验收标准

1. ✅ 文档覆盖所有部署步骤
2. ✅ 包含常见故障排查指南
3. ✅ 提供最佳实践建议
4. ✅ 命令示例可直接复制使用
5. ✅ 包含安全配置说明
6. ✅ 包含性能优化建议
