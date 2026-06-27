# YQAD 生产环境目录结构说明

## 📦 实际 Docker 项目结构（/Volumes/docker/yqad）

当前生产环境的 Docker 项目采用以下结构：

```
/Volumes/docker/yqad/
├── app/                          # 源码目录（挂载到容器 /app）
│   ├── src/                      # TypeScript 源码
│   ├── config/                   # 应用配置（内部，不常用）
│   ├── package.json              # Node.js 配置
│   ├── package-lock.json         # 依赖锁定
│   ├── tsconfig.json             # TypeScript 配置
│   ├── Dockerfile                # 镜像构建文件
│   └── docker-compose.yml        # Docker 编排（已废弃，使用外部 compose）
│
├── config/                       # 外部配置目录（挂载到容器 /app/config）
│   ├── default.yaml              # 默认配置
│   └── local.yaml                # 本地配置（覆盖默认配置）
│
├── data/                         # 应用数据目录（挂载到容器 /app/data）
│   ├── materials/                # 素材文件
│   │   ├── raw/                  # 原始素材
│   │   └── processed/            # 处理后的素材
│   ├── summaries/                # 每日摘要
│   ├── compliance-reports/       # 合规报告
│   ├── api-token.json            # API Token
│   ├── token.json                # 车辆 Token
│   ├── vehicle-token.json        # Home Assistant Token
│   ├── topics.json               # 主题数据
│   ├── global-prompt.json        # 全局人设
│   ├── comment-history.json      # 评论历史
│   ├── image-cache.json          # 图片缓存
│   └── pending-posts.json        # 待发布帖子
│
└── logs/                         # 日志目录（挂载到容器 /app/logs）
    ├── *.log                     # 应用日志
    └── comment-log.json          # 评论日志
```

---

## 🐳 Docker 容器挂载关系

### docker-compose.yml 配置

```yaml
services:
  yqad:
    image: yqad-auto-tasks:latest
    volumes:
      - ../config:/app/config     # 外部配置 → 容器配置
      - ../data:/app/data         # 外部数据 → 容器数据
      - ../logs:/app/logs         # 外部日志 → 容器日志
```

### 挂载说明

| 宿主机路径 | 容器路径 | 说明 |
|-----------|----------|------|
| `/Volumes/docker/yqad/config` | `/app/config` | 应用配置文件 |
| `/Volumes/docker/yqad/data` | `/app/data` | 应用数据（素材、Token 等） |
| `/Volumes/docker/yqad/logs` | `/app/logs` | 应用日志 |

---

## 📋 配置文件说明

### config/default.yaml

**应用默认配置**，包含：
- API 客户端配置（奥迪 API）
- MySQL 数据库配置
- Redis 缓存配置
- AI Provider 配置（GPT、HiGPT）
- 评论/发帖策略配置
- 素材处理配置
- 内容合规检查配置
- Web 服务配置
- 车辆监控配置
- 电信 API 配置
- AutoJS API 配置

### config/local.yaml

**本地覆盖配置**，用于：
- 覆盖 default.yaml 中的配置项
- 环境特定配置（开发/生产）
- 敏感信息（密码、Token 等）

**优先级**：`local.yaml` > `default.yaml`

---

## 📊 数据文件说明

### Token 文件

| 文件 | 说明 | 更新频率 |
|------|------|---------|
| `api-token.json` | API 调用 Token | 长期有效 |
| `token.json` | 车辆访问 Token | 定期更新 |
| `vehicle-token.json` | Home Assistant Token | 长期有效 |

### 业务数据

| 文件 | 说明 | 更新方式 |
|------|------|---------|
| `topics.json` | 主题配置 | 手动/自动 |
| `global-prompt.json` | 全局人设 | 手动 |
| `comment-history.json` | 评论历史 | 自动 |
| `image-cache.json` | 图片缓存 | 自动 |
| `pending-posts.json` | 待发布帖子 | 自动 |

### 素材目录

```
data/materials/
├── raw/              # 原始素材（HEIC 图片）
│   └── [分类文件夹]/
└── processed/        # 处理后的素材（JPEG 图片）
    └── [分类文件夹]/
```

---

## 🔧 部署到 Synology NAS

### 推荐的 NAS 部署结构

```
/volume1/docker/yqad-prod/
├── synology/                   # 部署包目录
│   ├── docker-compose.yml      # Docker 编排
│   ├── Dockerfile              # 镜像构建
│   ├── package.json            # Node.js 配置
│   ├── src/                    # 源码
│   ├── config/                 # 配置文件
│   ├── data/                   # 数据目录
│   └── logs/                   # 日志目录
└── ...（其他支持文件）
```

### 挂载关系（NAS）

```yaml
services:
  yqad:
    volumes:
      - ./config:/app/config    # 配置
      - ./data:/app/data        # 数据
      - ./logs:/app/logs        # 日志
```

---

## 📝 注意事项

1. **配置文件**
   - `default.yaml` 包含完整配置，不要随意修改
   - `local.yaml` 用于覆盖特定配置，生产环境使用

2. **数据文件**
   - `data/` 目录包含所有运行时数据
   - 定期备份 `data/` 目录
   - Token 文件包含敏感信息，不要提交到版本控制

3. **日志文件**
   - 日志按日期分割：`YYYY-MM-DD.log`
   - 定期清理旧日志，避免占用过多磁盘空间

4. **素材文件**
   - `materials/raw/` 存储原始 HEIC 图片
   - `materials/processed/` 存储处理后的 JPEG 图片
   - 素材文件较大，注意磁盘空间

---

**更新时间**: 2026-06-27  
**参考路径**: `/Volumes/docker/yqad`  
**部署目标**: Synology NAS Docker  
**数据库表**: 14 张（与代码完全一致）
