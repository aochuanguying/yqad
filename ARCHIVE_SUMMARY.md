# 一汽奥迪 APP 自动任务系统 - 项目归档总结

## 📋 项目概述

**项目名称**: 一汽奥迪 APP 自动任务系统  
**项目类型**: 社交媒体自动化运营系统  
**技术栈**: Node.js + TypeScript + MySQL + Redis + ChromaDB + Express  
**归档日期**: 2026-06-22  

---

## 🎯 核心功能

### 1. 自动发帖
- 基于 AI 生成帖子内容
- 支持多种帖子类型（纯文字、图片 + 文字）
- 智能图片选择和 OCR 识别
- 发帖间隔控制
- 合规性检查

### 2. 自动评论
- 智能评论生成
- 评论时机控制
- 评论历史记录
- 兜底评论策略

### 3. 主题管理
- 主题创建和配置
- 子方向管理
- 使用次数控制
- 主题多样化策略

### 4. 素材管理
- 本地素材扫描和索引
- 网络素材下载
- 素材质量评估
- 素材使用追溯

### 5. 内容分析
- 每日执行摘要
- 成功率统计
- 失败任务追踪

---

## 🏗️ 系统架构

### 存储架构

#### MySQL (14 张表)
```
✅ members                  - 会员信息
✅ posts                    - 帖子历史
✅ comments                 - 评论历史
✅ post_logs                - 发帖日志
✅ comment_logs             - 评论日志
✅ pending_posts            - 待发布帖子
✅ compliance_reports       - 合规性报告
✅ global_prompts           - 全局人设
✅ topics                   - 主题
✅ topic_sub_directions     - 主题子方向
✅ topic_sub_direction_usages - 子方向使用记录
✅ topic_material_usages    - 素材使用记录
✅ material_records         - 素材记录
✅ daily_summaries          - 每日摘要
```

#### Redis (7 个模块)
```
✅ topic:uses:{topicId}     - 主题可用次数
✅ sensitive:words          - 敏感词库
✅ api:token                - API Token
✅ task:cache               - 任务缓存
✅ vehicle:token            - 车辆 Token
✅ image:cache              - 图片 OCR 缓存
✅ daily:summary            - 每日摘要
```

#### ChromaDB (3 个 Collection)
```
✅ materials                - 素材向量（用于相似度搜索和推荐）
✅ content_dedup            - 内容去重向量（用于发帖内容去重检测）
✅ topic_recommend          - 主题推荐向量（用于主题相似度推荐）
```

#### 文件系统
```
✅ config/default.yaml      - 配置文件
✅ logs/*.log               - 日志文件
✅ data/materials/          - 素材文件
✅ dist/                    - 编译产物
```

---

## 📦 部署脚本

### 1. 数据库表结构创建
**文件**: `scripts/prod-create-tables.sql`

**用途**: 
- 创建数据库和所有表结构
- 创建索引和外键约束
- 初始化基础数据

**使用方法**:
```bash
mysql -u root -p yqad_db < scripts/prod-create-tables.sql
```

### 2. 数据初始化脚本
**文件**: `scripts/prod-init-data.js`

**用途**:
- 初始化默认管理员账户
- 初始化默认全局人设
- 初始化示例主题（可选）
- 初始化敏感词库（可选）

**使用方法**:
```bash
export ADMIN_PASSWORD='secure_password'
node scripts/prod-init-data.js
```

### 3. Redis 初始化脚本
**文件**: `scripts/prod-init-redis.js`

**用途**:
- 初始化 API Token
- 初始化敏感词库
- 初始化车辆 Token（可选）

**使用方法**:
```bash
node scripts/prod-init-redis.js
```

### 4. ChromaDB 初始化脚本
**文件**: `scripts/prod-init-chromadb.js`

**用途**:
- 连接到 ChromaDB 服务
- 创建素材向量 Collection
- 创建内容去重 Collection
- 创建主题推荐 Collection

**使用方法**:
```bash
node scripts/prod-init-chromadb.js
```

### 5. ChromaDB 数据迁移脚本
**文件**: `scripts/migrate-chromadb-collections.ts`

**用途**:
- 从 MySQL 读取素材元数据
- 生成素材向量并存储到 ChromaDB
- 从 MySQL 读取历史发帖内容
- 生成内容向量并存储到 ChromaDB

**使用方法**:
```bash
npx ts-node scripts/migrate-chromadb-collections.ts
```

### 6. 环境变量模板
**文件**: `.env.example`

**用途**:
- 数据库配置
- Redis 配置
- ChromaDB 配置
- AI Provider 配置
- 认证配置
- 服务器配置

**使用方法**:
```bash
cp .env.example .env
vim .env
```

### 5. 部署文档
**文件**: `DEPLOYMENT.md`

**内容**:
- 系统要求
- 环境准备
- 数据库初始化
- Redis 初始化
- 应用部署
- 配置说明
- 启动服务
- 验证部署
- 常见问题
- 维护指南
- 安全建议

---

## 🔧 核心服务模块

### Service 层
- `auto-post.ts` - 自动发帖服务
- `auto-comment.ts` - 自动评论服务
- `topic-diversity-service.ts` - 主题多样化服务
- `posting-interval-control-service.ts` - 发帖间隔控制
- `hybrid-material-service.ts` - 混合素材服务
- `content-analysis.ts` - 内容分析服务
- `daily-summary.ts` - 每日摘要服务
- `compliance-check-orchestrator.ts` - 合规性检查协调器

### Storage 层
- `member-storage.ts` - 会员存储
- `post-storage.ts` - 帖子存储
- `comment-storage.ts` - 评论存储
- `post-log-storage.ts` - 发帖日志存储
- `comment-log-storage.ts` - 评论日志存储
- `pending-post-storage.ts` - 待发布帖子存储
- `compliance-report-storage.ts` - 合规报告存储
- `global-prompt-storage.ts` - 全局人设存储
- `topic-storage.ts` - 主题存储
- `topic-usage-storage.ts` - 主题使用记录存储
- `material-record-storage.ts` - 素材记录存储
- `daily-summary-storage.ts` - 每日摘要存储

### Redis Storage 层
- `topic-uses-storage.ts` - 主题次数存储
- `sensitive-words-storage.ts` - 敏感词存储
- `api-token-storage.ts` - API Token 存储
- `vehicle-token-storage.ts` - 车辆 Token 存储
- `image-cache-storage.ts` - 图片缓存存储

### ChromaDB 集成（可选）
- `prod-init-chromadb.js` - ChromaDB 初始化脚本
- `migrate-chromadb-collections.ts` - ChromaDB 数据迁移脚本

---

## 📊 数据库表结构详解

### 核心业务表

#### 1. members (会员信息表)
```sql
CREATE TABLE `members` (
  `id` VARCHAR(36) PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'user') DEFAULT 'user',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. posts (帖子历史表)
```sql
CREATE TABLE `posts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT,
  `topic_id` VARCHAR(36),
  `topic_name` VARCHAR(200),
  `status` ENUM('draft', 'published', 'failed') DEFAULT 'draft',
  `published_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 3. comments (评论历史表)
```sql
CREATE TABLE `comments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `post_id` VARCHAR(36) NOT NULL,
  `post_title` VARCHAR(500),
  `comment_content` TEXT NOT NULL,
  `status` ENUM('pending', 'published', 'failed') DEFAULT 'pending',
  `published_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 主题相关表

#### 4. topics (主题表)
```sql
CREATE TABLE `topics` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `max_use_count` INT DEFAULT 1,
  `current_use_count` INT DEFAULT 0,
  `status` ENUM('available', 'unavailable') DEFAULT 'available',
  `tags` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 5. topic_sub_directions (主题子方向表)
```sql
CREATE TABLE `topic_sub_directions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `topic_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE
);
```

#### 6. topic_sub_direction_usages (子方向使用记录表)
```sql
CREATE TABLE `topic_sub_direction_usages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `topic_id` VARCHAR(36) NOT NULL,
  `sub_direction_index` INT NOT NULL,
  `used_count` INT DEFAULT 0,
  `last_used_date` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_topic_sub_direction` (`topic_id`, `sub_direction_index`),
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE
);
```

#### 7. topic_material_usages (素材使用记录表)
```sql
CREATE TABLE `topic_material_usages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `topic_id` VARCHAR(36) NOT NULL,
  `material_path` VARCHAR(500) NOT NULL,
  `used_count` INT DEFAULT 0,
  `last_used_date` DATETIME NULL,
  `used_in_posts` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_topic_material` (`topic_id`, `material_path`),
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE
);
```

### 其他核心表

#### 8. material_records (素材记录表)
```sql
CREATE TABLE `material_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `source` ENUM('local', 'internet') NOT NULL,
  `path` VARCHAR(500) NOT NULL,
  `url` VARCHAR(500),
  `quality_score` JSON,
  `matched_keywords` JSON,
  `usage_count` INT DEFAULT 0,
  `last_used_date` DATETIME NULL,
  `associated_posts` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 9. daily_summaries (每日摘要表)
```sql
CREATE TABLE `daily_summaries` (
  `id` VARCHAR(36) PRIMARY KEY,
  `date` DATE NOT NULL UNIQUE,
  `comments_total` INT DEFAULT 0,
  `comments_successful` INT DEFAULT 0,
  `comments_failed` INT DEFAULT 0,
  `posts_total` INT DEFAULT 0,
  `posts_successful` INT DEFAULT 0,
  `posts_failed` INT DEFAULT 0,
  `failed_tasks` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🚀 快速部署流程

### 步骤 1: 环境准备
```bash
# 安装依赖
npm install --production

# 复制环境变量
cp .env.example .env
vim .env
```

### 步骤 2: 数据库初始化
```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE yqad_db DEFAULT CHARACTER SET utf8mb4;"

# 执行表结构脚本
mysql -u root -p yqad_db < scripts/prod-create-tables.sql

# 初始化数据
export ADMIN_PASSWORD='secure_password'
node scripts/prod-init-data.js
```

### 步骤 3: Redis 初始化
```bash
# 启动 Redis
sudo systemctl start redis

# 初始化 Redis 数据
node scripts/prod-init-redis.js
```

### 步骤 4: ChromaDB 初始化（可选）
```bash
# 启动 ChromaDB（Docker）
docker start chromadb

# 安装 ChromaDB 客户端
npm install chromadb

# 初始化 Collections
node scripts/prod-init-chromadb.js

# 迁移现有数据（可选）
npx ts-node scripts/migrate-chromadb-collections.ts
```

### 步骤 5: 启动应用
```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

---

## 📝 配置清单

### 必须配置项
- [ ] MySQL 连接信息
- [ ] Redis 连接信息
- [ ] ChromaDB 连接信息（可选）
- [ ] AI Provider API Keys
- [ ] Session Secret
- [ ] 管理员密码

### 可选配置项
- [ ] 车辆监控配置
- [ ] Home Assistant 集成
- [ ] 自定义日志级别

---

## 🔒 安全建议

1. **修改默认密码**: 立即修改管理员默认密码
2. **启用防火墙**: 只开放必要端口
3. **使用 HTTPS**: 配置 Nginx 反向代理 + SSL
4. **定期备份**: 设置定时任务备份数据库和 Redis
5. **监控告警**: 配置系统监控和告警机制
6. **更新依赖**: 定期检查并更新 npm 依赖

---

## 📚 相关文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 生产环境部署指南
- [scripts/prod-create-tables.sql](./scripts/prod-create-tables.sql) - 数据库表结构脚本
- [scripts/prod-init-data.js](./scripts/prod-init-data.js) - 数据初始化脚本
- [scripts/prod-init-redis.js](./scripts/prod-init-redis.js) - Redis 初始化脚本
- [.env.example](./.env.example) - 环境变量模板

---

## 📊 项目统计

- **总线数**: 14 张
- **Redis 模块**: 7 个
- **核心 Service**: 8 个
- **Storage 模块**: 17 个
- **部署脚本**: 3 个
- **文档**: 2 个

---

## ✅ 归档完成确��

- [x] 数据库表结构脚本创建完成
- [x] 数据初始化脚本创建完成
- [x] Redis 初始化脚本创建完成
- [x] 部署文档编写完成
- [x] 环境变量模板创建完成
- [x] 归档总结文档编写完成

---

**归档日期**: 2026-06-22  
**归档版本**: v1.0  
**归档负责人**: 系统管理员
