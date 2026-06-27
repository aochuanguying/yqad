# YQAD 生产环境部署指南（源码构建版）

## 📦 部署包说明

本部署包包含**完整的源码和构建配置**，可直接在 Synology NAS 的 Docker 中构建并运行应用。

### 部署包结构

```
synology/
├── DEPLOY.md                     # 本文件（部署指南）
├── README.md                     # 项目说明
├── docker-compose.yml            # Docker 编排文件
├── Dockerfile                    # 应用镜像构建文件
├── package.json                  # Node.js 项目配置
├── package-lock.json             # 依赖锁定文件
├── tsconfig.json                 # TypeScript 配置
├── .env.example                  # 环境变量模板
├── config/                       # 应用配置（挂载到容器 /app/config）
│   └── default.yaml              # 应用配置文件
├── data/                         # 应用数据（挂载到容器 /app/data）
│   ├── materials/                # 素材目录
│   └── ...                       # 其他数据文件
├── logs/                         # 应用日志（挂载到容器 /app/logs）
│   └── *.log                     # 日志文件
├── src/                          # TypeScript 源码
│   ├── index.ts                  # 入口文件
│   ├── services/                 # 业务服务
│   ├── controllers/              # Web 控制器
│   ├── utils/                    # 工具函数
│   └── ...
├── sql/
│   └── init-complete.sql         # 数据库初始化脚本
└── scripts/
    ├── init-redis.sh             # Redis 初始化脚本
    └── init-chromadb.sh          # ChromaDB 初始化脚本
```

### 目录说明

部署后，Docker 容器会创建以下目录结构：

```
synology/
├── config/                       # 配置文件（手动维护）
├── data/                         # 运行时数据（自动创建）
│   ├── mysql/                    # MySQL 数据
│   ├── redis/                    # Redis 数据
│   ├── chromadb/                 # ChromaDB 数据
│   ├── materials/                # 素材文件
│   └── ...                       # 其他应用数据
├── logs/                         # 日志文件（自动创建）
│   ├── mysql/                    # MySQL 日志
│   └── app/                      # 应用日志
└── ...（其他部署文件）
```

---

## 🚀 部署步骤

### 步骤 1：准备环境

**系统要求**：
- Synology DSM 7.0+
- Docker（Container Manager）已安装
- 至少 8GB 内存
- 至少 50GB 可用存储空间

**复制部署包到 NAS**：
```bash
# 方法 1：使用 SCP 上传
scp -r /Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000\ Workspace/yqad/deploy/synology admin@nas:/volume1/docker/yqad-prod/

# 方法 2：使用 Synology File Station 上传
# 将整个 synology 目录上传到 NAS
```

### 步骤 2：配置环境变量

```bash
# SSH 登录 NAS
ssh admin@nas-ip

# 进入部署目录
cd /volume1/docker/yqad-prod/synology

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件
vi .env
```

**必须修改的配置**：
```bash
# MySQL 密码（务必使用强密码）
MYSQL_ROOT_PASSWORD=你的强密码

# Session 密钥（建议生成新的 32 位随机字符串）
# 生成命令：openssl rand -hex 32
SESSION_SECRET=你的随机密钥

# Web 访问端口（可选，默认 3000）
YQAD_PORT=3000
```

### 步骤 3：构建并启动服务

```bash
# 一键构建并启动所有服务
docker-compose up -d --build
```

**构建时间**：约 5-10 分钟（首次构建）

**查看构建日志**：
```bash
docker-compose logs -f yqad
```

### 步骤 4：等待服务就绪

```bash
# 查看所有服务状态
docker-compose ps
```

**预期结果**（所有服务状态应为 `healthy`）：
```
NAME                 STATUS
yqad-mysql           Up (healthy)
yqad-redis           Up (healthy)
yqad-chromadb        Up (healthy)
yqad-auto-tasks      Up (healthy)
```

### 步骤 5：验证数据库初始化

```bash
# 进入 MySQL 容器
docker exec -it yqad-mysql mysql -u root -p

# 输入密码（.env 中设置的 MYSQL_ROOT_PASSWORD）

# 执行以下 SQL 命令
mysql> USE yqad_prod_db;
mysql> SHOW TABLES;
mysql> SELECT COUNT(*) FROM topics;
mysql> SELECT name FROM global_prompts;
mysql> EXIT;
```

**预期结果**：
- 显示 14 张表
- 主题数量：4
- 全局人设名称：默认人设

### 步骤 6：访问应用

**Web 管理界面**：
```
http://<NAS-IP>:3000
```

**默认登录凭据**：
- 用户名：`admin`
- 密码：`admin123`

**⚠️ 请立即修改密码！**

---

## 🔧 日常运维

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看应用日志
docker-compose logs -f yqad

# 查看最近 100 行
docker-compose logs --tail=100 yqad
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart yqad
```

### 重新构建应用

```bash
# 强制重新构建（适用于修改源码后）
docker-compose up -d --build --force-recreate yqad
```

### 停止服务

```bash
# 停止所有服务
docker-compose down
```

### 备份数据

```bash
# 备份 MySQL 数据库
docker exec yqad-mysql mysqldump -u root -p<密码> yqad_prod_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份 Redis 数据
docker cp yqad-redis:/data/dump.rdb redis_backup_$(date +%Y%m%d_%H%M%S).rdb

# 备份 ChromaDB 数据
docker cp yqad-chromadb:/chroma/chroma chromadb_backup_$(date +%Y%m%d_%H%M%S)
```

---

## ⚠️ 重要提醒

### 1. 修改默认密码

**必须立即修改！**

```bash
# 修改 MySQL root 密码
docker exec -it yqad-mysql mysql -u root -pYqad@2026Secure
mysql> ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';
mysql> FLUSH PRIVILEGES;
mysql> EXIT;

# 修改 Web 管理员密码（admin/admin123）
# 方法 1：通过 Web 界面登录后修改
# 方法 2：生成新密码哈希并更新
docker exec yqad-auto-tasks node -e "console.log(require('bcryptjs').hashSync('新密码', 10))"
# 复制输出的哈希值，然后：
docker exec -it yqad-mysql mysql -u root -pYqad@2026Secure yqad_prod_db
mysql> UPDATE members SET password_hash='新哈希值' WHERE username='admin';
mysql> EXIT;
```

### 2. 复制素材文件

```bash
# 复制现有生产环境的素材
cp -r /Volumes/docker/yqad/data/materials ./data/
```

### 3. 监控资源使用

```bash
# 查看 Docker 资源使用
docker stats

# 查看 NAS 资源使用
# 在 Synology DSM 中打开 Resource Monitor
```

---

## 🆘 故障排查

### 构建失败

```bash
# 查看详细构建日志
docker-compose build --progress=plain yqad

# 清理缓存并重新构建
docker-compose down
docker system prune -f
docker-compose up -d --build --force-recreate
```

### 服务无法启动

```bash
# 查看服务状态
docker-compose ps

# 查看详细日志
docker-compose logs <服务名>

# 检查端口占用
netstat -tulpn | grep 3000
```

### MySQL 连接失败

```bash
# 检查 MySQL 是否就绪
docker exec yqad-mysql mysqladmin -u root -p ping

# 查看 MySQL 错误日志
docker logs yqad-mysql
```

### 应用错误

```bash
# 查看应用日志
docker logs yqad-auto-tasks

# 进入容器调试
docker exec -it yqad-auto-tasks sh

# 检查配置文件
cat /app/config/default.yaml
```

---

## 📊 部署概览

### 服务组成

| 服务 | 容器名 | 镜像 | 端口 | 说明 |
|------|--------|------|------|------|
| MySQL | yqad-mysql | mysql:8.0 | 3306（内部） | 关系型数据库 |
| Redis | yqad-redis | redis:7-alpine | 6379（内部） | 缓存存储 |
| ChromaDB | yqad-chromadb | chromadb/chroma:latest | 8000（内部） | 向量数据库 |
| YQAD | yqad-auto-tasks | yqad-auto-tasks:latest | 3000（外部） | 应用服务 |

### 数据隔离

| 组件 | 测试环境 | 生产环境 | 隔离方式 |
|------|----------|----------|----------|
| MySQL | `yqad_db` | `yqad_prod_db` | 数据库名不同 |
| Redis | DB 0, `test:` | DB 1, `prod:` | DB + Key 前缀不同 |
| ChromaDB | `dev:*` | `prod:*` | Collection 前缀不同 |

### 持久化存储

| 宿主机路径 | 容器路径 | 说明 |
|-----------|----------|------|
| ./data/mysql | /var/lib/mysql | MySQL 数据 |
| ./data/redis | /data | Redis 数据 |
| ./data/chromadb | /chroma/chroma | ChromaDB 数据 |
| ./data/app | /app/data | YQAD 应用数据 |
| ./logs/mysql | /var/log/mysql | MySQL 日志 |
| ./logs/app | /app/logs | YQAD 应用日志 |

---

## 📚 相关文档

- [README.md](./README.md) - 项目说明
- [QUICK_START.md](./QUICK_START.md) - 快速开始指南
- [DATA_MIGRATION.md](./DATA_MIGRATION.md) - 数据迁移说明

---

**部署时间**: 2026-06-26  
**版本**: Production v1.0 (源码构建版)  
**构建方式**: Docker Compose 本地构建  
**数据来源**: `/Volumes/docker/yqad/data/`  
**数据库**: yqad_prod_db（与测试环境隔离）
