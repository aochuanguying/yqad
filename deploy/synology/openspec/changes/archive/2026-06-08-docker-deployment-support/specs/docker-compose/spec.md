# Docker Compose 配置规范

## 目标

提供一个完整的 docker-compose.yml 配置文件，简化群晖 NAS Docker 部署流程，实现一键启动和持久化存储。

## 功能需求

### F1: 服务定义

定义名为 `yqad` 的服务：

```yaml
version: '3.8'
services:
  yqad:
    build: .
    container_name: yqad-auto-post
```

### F2: 卷挂载

必须挂载以下三个数据卷：

```yaml
volumes:
  - ./data:/app/data          # 素材库和 token 数据
  - ./config:/app/config      # 配置文件
  - ./logs:/app/logs          # 日志文件
```

**说明：**
- `./data`: 存储原始素材、处理后素材、token.json
- `./config`: 存储配置文件（default.yaml, local.yaml）
- `./logs`: 存储日志文件，便于查看和排查问题

### F3: 端口映射

```yaml
ports:
  - "3000:3000"
```

**说明：**
- 宿主机端口 3000 → 容器端口 3000
- 用于访问 Web 管理界面

### F4: 环境变量

```yaml
environment:
  - NODE_ENV=production
```

**说明：**
- 设置生产环境模式
- 可添加其他环境变量（如时区）

### F5: 重启策略

```yaml
restart: unless-stopped
```

**说明：**
- 容器异常退出时自动重启
- 手动停止时不重启
- 群晖 NAS 重启后自动启动容器

### F6: 网络配置（可选）

```yaml
networks:
  - yqad-network

networks:
  yqad-network:
    driver: bridge
```

**说明：**
- 使用标准桥接网络
- 可自定义网络名称

## 非功能需求

### NFR1: 易用性

- 配置文件简洁明了
- 注释完整，便于理解
- 支持一键启动：`docker-compose up -d`

### NFR2: 可维护性

- 便于修改配置
- 便于升级版本
- 便于备份数据

### NFR3: 兼容性

- 兼容 Docker Compose v2+
- 兼容群晖 Container Manager
- 兼容 Linux/macOS/Windows

## 完整配置示例

```yaml
version: '3.8'

services:
  yqad:
    # 构建配置
    build: .
    
    # 容器名称
    container_name: yqad-auto-post
    
    # 卷挂载（数据持久化）
    volumes:
      - ./data:/app/data          # 素材库和 token
      - ./config:/app/config      # 配置文件
      - ./logs:/app/logs          # 日志文件
    
    # 端口映射
    ports:
      - "3000:3000"
    
    # 环境变量
    environment:
      - NODE_ENV=production
      - TZ=Asia/Shanghai          # 时区设置（可选）
    
    # 重启策略
    restart: unless-stopped
    
    # 网络配置（可选）
    networks:
      - yqad-network

# 网络定义（可选）
networks:
  yqad-network:
    driver: bridge
```

## 验收标准

1. ✅ `docker-compose up -d` 可以成功启动容器
2. ✅ 数据卷正确挂载，容器重启后数据不丢失
3. ✅ Web 界面可通过 http://localhost:3000 访问
4. ✅ 容器异常退出后自动重启
5. ✅ 群晖 NAS 重启后容器自动启动
6. ✅ 日志文件可在宿主机的 `./logs` 目录查看

## 使用指南

### 首次部署

```bash
# 1. 克隆项目代码
git clone <repo-url>
cd yqad

# 2. 构建并启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 访问 Web 界面
# http://localhost:3000
```

### 日常操作

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs

# 重启容器
docker-compose restart

# 停止容器
docker-compose down

# 重新构建（代码更新后）
docker-compose up -d --build
```

### 数据备份

```bash
# 备份数据和配置
tar -czf yqad-backup-$(date +%Y%m%d).tar.gz \
  data/ config/ logs/
```

## 依赖

- Docker 20.10+
- Docker Compose 2.0+
- 群晖 DSM 7.0+（带 Container Manager）
