# YQAD 生产环境部署包

## 📦 部署包内容

本目录包含一汽奥迪 APP 自动任务系统（YQAD）的**完整生产环境部署文件**，所有服务均运行在 Docker 容器中。

### 文件结构

```
synology/
├── README.md                     # 本文件
├── DEPLOY.md                     # 详细部署指南（⚠️ 部署前必读）
├── STRUCTURE.md                  # 目录结构说明
├── docker-compose.yml            # Docker 编排文件
├── Dockerfile                    # 应用镜像构建文件
├── .env.example                  # 环境变量模板
├── config/
│   └── default.yaml              # 应用默认配置
├── sql/
│   └── init-complete.sql         # MySQL 完整初始化脚本（表结构 + 默认数据）
└── scripts/
    ├── init-redis.sh             # Redis 初始化脚本（包含现有 Token）
    └── init-chromadb.sh          # ChromaDB 初始化脚本
```

## 🚀 快速开始

### 1. 复制并配置环境变量

```bash
cd /path/to/synology
cp .env.example .env
# 编辑 .env 文件，修改密码等配置
```

### 2. 启动所有服务

```bash
docker-compose up -d --build
```

### 3. 验证部署

```bash
# 查看所有服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 访问应用

- **Web 界面**: `http://<NAS-IP>:3000`
- **默认凭据**: `admin` / `admin123`（⚠️ 请立即修改）

## ⚙️ 服务组成

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| MySQL | yqad-mysql | 3306（内部） | 关系型数据库 |
| Redis | yqad-redis | 6379（内部） | 缓存存储 |
| ChromaDB | yqad-chromadb | 8000（内部） | 向量数据库 |
| YQAD | yqad-auto-tasks | 3000（外部） | 应用服务 |

## 🔒 数据隔离

本部署包使用**完全隔离**的生产环境数据：

- **MySQL**: `yqad_prod_db`（测试环境：`yqad_db`）
- **Redis**: DB 1, `prod:` 前缀（测试环境：DB 0, `test:`）
- **ChromaDB**: `prod:*` Collections（测试环境：`dev:*`）

## 📚 详细文档

请阅读 [DEPLOY.md](./DEPLOY.md) 获取完整的部署指南，包括：

- 系统架构说明
- 详细部署步骤
- 验证部署方法
- 日常运维操作
- 故障排查指南
- 数据备份恢复

请阅读 [STRUCTURE.md](./STRUCTURE.md) 了解目录结构和文件组织。

## ⚠️ 重要提醒

1. **修改默认密码**：MySQL、Web 管理员、Session Secret
2. **备份数据**：定期备份 MySQL、Redis、ChromaDB 数据
3. **监控日志**：定期检查服务日志，及时发现并解决问题
4. **安全配置**：使用防火墙限制访问，考虑使用反向代理

## 🆘 获取帮助

- 详细文档：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 项目文档：`../../README.md`
- 应用日志：`docker-compose logs yqad`

---

**部署时间**：2026-06-27  
**版本**：Production v1.0  
**架构**：完全容器化（MySQL + Redis + ChromaDB + YQAD）  
**表结构**：14 张表（与代码完全一致）
