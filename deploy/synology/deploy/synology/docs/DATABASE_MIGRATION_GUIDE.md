# 数据库迁移指南

## 文档信息

- **版本**: v2.0
- **更新时间**: 2026-06-22
- **用途**: 指导将项目中的内存存储和文件存储迁移到数据库
- **部署环境**: 群晖 NAS Docker (IP: 192.168.50.50)
- **迁移状态**: ✅ 全部完成（Redis + MySQL + ChromaDB）

---

## 一、数据库环境概览

### 1.1 已部署数据库

| 数据库 | 容器名 | 访问地址 (宿主机) | 容器内地址 | 端口 | 认证信息 | 状态 |
|--------|--------|------------------|-----------|------|---------|------|
| **Redis** | `redis` | `192.168.50.50:6379` | `redis:6379` | 6379 | 无密码 | ✅ 运行中 |
| **MySQL** | `mysql` | `192.168.50.50:3306` | `mysql:3306` | 3306 | `root / Wfw7539148@` | ✅ 运行中 |
| **ChromaDB** | `chromadb` | `192.168.50.50:8000` | `chromadb:8000` | 8000 | 无认证 | ✅ 运行中 |

### 1.2 应用容器

| 容器名 | 镜像 | 端口映射 | 网络 | 状态 |
|--------|------|---------|------|------|
| `yqad-auto-tasks` | `yqad-auto-tasks:latest` | `3002→3000` | `app_default` | 运行中 |

### 1.3 网络连接建议

**当前状态**: 应用容器 (`yqad-auto-tasks`) 在 `app_default` 网络，数据库在 `bridge` 网络。

**推荐方案**: 将应用容器迁移到 `bridge` 网络，使用容器名通信。

```bash
# 停止并删除应用容器
docker stop yqad-auto-tasks
docker rm yqad-auto-tasks

# 重新创建，加入 bridge 网络
docker run -d \
  --name yqad-auto-tasks \
  --network bridge \
  -p 3002:3000 \
  --restart always \
  yqad-auto-tasks:latest
```

**迁移后的连接配置**:
```typescript
// 使用容器名（推荐）
const config = {
  redis: { host: 'redis', port: 6379 },
  mysql: { host: 'mysql', port: 3306, user: 'root', password: 'Wfw7539148@' },
  chromadb: { host: 'chromadb', port: 8000 }
};
```

**本地开发环境配置**:
```typescript
// 使用宿主机 IP（本地开发）
const config = {
  redis: { host: '192.168.50.50', port: 6379, prefix: 'dev:' },
  mysql: { host: '192.168.50.50', port: 3306, user: 'root', password: 'Wfw7539148@' },
  chromadb: { host: '192.168.50.50', port: 8000 }
};
```

**环境隔离方案**:
- **本地开发**: 使用 `dev:` 前缀，数据库 `yqad_dev`
- **生产环境**: 使用 `prod:` 前缀，数据库 `yqad_db`

---

## 二、当前存储状况分析

### 2.1 内存存储（需要迁移）

#### 1. 任务存储 - `Map<string, AsyncTask>`

**位置**: [`src/web/routes/posts-routes.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/web/routes/posts-routes.ts#L21)

```typescript
const taskStore = new Map<string, AsyncTask>();
```

**用途**: 存储异步发帖任务
**数据量**: 动态，通常 < 100 条
**生命周期**: 临时存储，30 分钟过期

**迁移方案**:
- **主存储**: MySQL `async_tasks` 表
- **缓存层**: Redis (加速查询)
- **过期清理**: MySQL Event 或定时任务

**表结构设计**:
```sql
CREATE TABLE async_tasks (
  task_id VARCHAR(64) PRIMARY KEY,
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  content TEXT,
  images JSON,
  platform VARCHAR(50),
  scheduled_time DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME,
  result TEXT,
  error_message TEXT,
  INDEX idx_status (status),
  INDEX idx_scheduled_time (scheduled_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Redis 缓存**:
- Key: `task:{task_id}`
- TTL: 30 分钟
- 结构: Hash

---

#### 2. 主题可用次数 - `Map<string, number>`

**位置**: [`src/web/services/topics-service.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/web/services/topics-service.ts)

**用途**: 记录主题剩余可用次数
**数据量**: < 50 条
**更新频率**: 高频

**迁移方案**:
- **存储**: Redis Sorted Set
- **Key**: `topic:uses`
- **TTL**: 7 天

**Redis 结构**:
```
ZADD topic:uses <timestamp> <topic_id>:<remaining_uses>
```

---

### 2.2 文件存储（需要迁移）

#### 1. Token 存储

**文件路径**: `./data/token.json`

**配置项**: [`config/default.yaml:9`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/config/default.yaml#L9)
```yaml
auth:
  tokenStorePath: ./data/token.json
```

**用途**: 存储 API 访问 Token
**迁移方案**: 
- **存储**: MySQL `tokens` 表
- **加密**: AES-256 加密存储

**表结构**:
```sql
CREATE TABLE tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_type VARCHAR(50) NOT NULL,
  token_value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT TRUE,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (token_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 2. API Token

**文件路径**: `./data/api-token.json`

**位置**: [`src/utils/api-token.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/utils/api-token.ts)

**用途**: 远程发帖 API 鉴权 Token
**迁移方案**: 
- **存储**: MySQL `tokens` 表 (token_type='api')
- **或**: Redis `api:token`

---

#### 3. 评论历史

**文件路径**: `./data/comment-history.json`

**位置**: [`src/services/auto-comment.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/auto-comment.ts)

**用途**: 记录评论历史，避免重复
**数据量**: 每日约 10-50 条
**迁移方案**: 
- **存储**: MySQL `comment_history` 表
- **清理策略**: 保留 30 天

**表结构**:
```sql
CREATE TABLE comment_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id VARCHAR(64),
  content TEXT NOT NULL,
  platform VARCHAR(50),
  commented_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post_id (post_id),
  INDEX idx_commented_at (commented_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 4. 发帖历史

**文件路径**: `./data/post-history.json`

**位置**: [`src/services/auto-post.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/auto-post.ts)

**用途**: 记录发帖历史
**数据量**: 每日 1-5 条
**迁移方案**: 
- **存储**: MySQL `post_history` 表

**表结构**:
```sql
CREATE TABLE post_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(64),
  content TEXT NOT NULL,
  images JSON,
  platform VARCHAR(50),
  topic_id VARCHAR(64),
  posted_at DATETIME,
  status VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_posted_at (posted_at),
  INDEX idx_topic_id (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 5. 待确认发帖

**文件路径**: `./data/pending-posts.json`

**位置**: [`src/services/pending-post-service.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/pending-post-service.ts)

**用途**: 存储待用户确认的发帖
**迁移方案**: 
- **存储**: MySQL `pending_posts` 表

**表结构**:
```sql
CREATE TABLE pending_posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(64) UNIQUE,
  content TEXT NOT NULL,
  images JSON,
  topic_id VARCHAR(64),
  status VARCHAR(20) DEFAULT 'pending',
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  posted_at DATETIME,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 6. 敏感词库

**文件路径**: `./data/sensitive-words.json`

**配置项**: [`config/default.yaml:188`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/config/default.yaml#L188)
```yaml
sensitiveWordFilter:
  wordLibraryPath: ./data/sensitive-words.json
```

**用途**: 敏感词过滤
**数据量**: 约 1000-5000 条
**迁移方案**: 
- **存储**: Redis Set (快速查询)
- **备份**: MySQL `sensitive_words` 表

**Redis 结构**:
```
SADD sensitive:words <word1> <word2> ...
```

**MySQL 表结构**:
```sql
CREATE TABLE sensitive_words (
  id INT AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),
  level VARCHAR(20) DEFAULT 'warning', -- warning / forbidden
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_word (word),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 7. 素材索引

**文件路径**: `./data/materials/processed/.materials/index.json`

**位置**: [`src/services/hybrid-material-service.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/hybrid-material-service.ts)

**用途**: 本地素材元数据索引
**数据量**: 约 100-500 条
**迁移方案**: 
- **元数据**: MySQL `materials` 表
- **向量**: ChromaDB (相似度搜索)
- **文件**: 保留文件系统存储

**MySQL 表结构**:
```sql
CREATE TABLE materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_path VARCHAR(500) NOT NULL UNIQUE,
  file_name VARCHAR(200),
  file_type VARCHAR(20), -- image / text
  file_size INT,
  width INT,
  height INT,
  description TEXT,
  tags JSON,
  location VARCHAR(100),
  taken_at DATETIME,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  vector_id VARCHAR(64), -- ChromaDB 中的向量 ID
  is_available BOOLEAN DEFAULT TRUE,
  use_count INT DEFAULT 0,
  last_used_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_file_type (file_type),
  INDEX idx_location (location),
  INDEX idx_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**ChromaDB Collection**:
```typescript
const collection = await chroma.getOrCreateCollection({
  name: 'materials',
  metadata: { description: 'Material embeddings for similarity search' }
});
```

---

#### 8. 图片缓存

**文件路径**: `./data/image-cache.json`

**用途**: 网络图片缓存元数据
**迁移方案**: 
- **存储**: MySQL `image_cache` 表

**表结构**:
```sql
CREATE TABLE image_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(500) NOT NULL UNIQUE,
  local_path VARCHAR(500),
  file_hash VARCHAR(64),
  file_size INT,
  width INT,
  height INT,
  source VARCHAR(100),
  downloaded_at DATETIME,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_url (url),
  INDEX idx_downloaded_at (downloaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 9. 全局提示词

**文件路径**: `./data/global-prompt.json`

**位置**: [`src/services/global-prompt-service.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/global-prompt-service.ts)

**用途**: 全局 AI 提示词配置
**迁移方案**: 
- **存储**: MySQL `global_prompts` 表

**表结构**:
```sql
CREATE TABLE global_prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prompt_key VARCHAR(100) UNIQUE NOT NULL,
  prompt_content TEXT NOT NULL,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  updated_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (prompt_key),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 10. 发帖日志

**文件路径**: `./data/post-logs.json`

**位置**: [`src/services/post-logging-service.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/post-logging-service.ts)

**用途**: 发帖详细日志
**数据量**: 较大
**迁移方案**: 
- **存储**: MySQL `post_logs` 表
- **归档策略**: 按月分表

**表结构**:
```sql
CREATE TABLE post_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(64),
  post_id VARCHAR(64),
  action VARCHAR(50),
  status VARCHAR(20),
  details JSON,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task_id (task_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 11. 合规性报告

**文件路径**: `./data/compliance-reports/`

**配置项**: [`config/default.yaml:219`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/config/default.yaml#L219)
```yaml
complianceCheckReport:
  storagePath: ./data/compliance-reports
```

**用途**: 存储合规性检查报告
**迁移方案**: 
- **元数据**: MySQL `compliance_reports` 表
- **文件**: 保留文件系统或迁移到对象存储

**表结构**:
```sql
CREATE TABLE compliance_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id VARCHAR(64) UNIQUE NOT NULL,
  task_id VARCHAR(64),
  check_type VARCHAR(50),
  result VARCHAR(20), -- pass / warning / fail
  score DECIMAL(5,2),
  details JSON,
  file_path VARCHAR(500),
  checked_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_id (report_id),
  INDEX idx_checked_at (checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### 12. 车辆监控 Token

**文件路径**: `./data/vehicle-token.json`

**位置**: [`src/services/vehicle-monitor-service.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/vehicle-monitor-service.ts)

**用途**: Home Assistant API Token
**迁移方案**: 
- **存储**: MySQL `tokens` 表 (token_type='vehicle')

---

#### 13. 每日摘要

**文件路径**: `./data/summaries/*.json`

**位置**: [`src/services/daily-summary.ts`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/src/services/daily-summary.ts)

**用途**: 每日任务摘要
**迁移方案**: 
- **存储**: MySQL `daily_summaries` 表

**表结构**:
```sql
CREATE TABLE daily_summaries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  summary_date DATE NOT NULL UNIQUE,
  post_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  material_count INT DEFAULT 0,
  summary_data JSON,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (summary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 2.3 文件存储（保留）

以下文件建议**保留文件系统存储**：

#### 1. 素材文件

**路径**: `./data/materials/raw/`, `./data/materials/processed/`

**内容**: HEIC、JPG 图片文件
**原因**: 
- 文件较大，不适合数据库存储
- 文件系统访问效率高
- 只需在数据库存储元数据

**建议**: 
- 保留当前结构
- 在 MySQL 中存储元数据
- 在 ChromaDB 中存储向量

---

#### 2. 临时图片

**路径**: `./data/temp-images/`

**内容**: 临时下载的网络图片
**原因**: 临时文件，不需要持久化
**建议**: 保留，定期清理

---

#### 3. 日志文件

**路径**: `./logs/`

**配置项**: [`config/default.yaml:93`](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/config/default.yaml#L93)
```yaml
logging:
  level: info
  dir: ./logs
  retainDays: 30
```

**原因**: 文本日志适合文件系统
**建议**: 保留，使用日志轮转

---

## 三、迁移实施步骤

### 3.1 第一阶段：数据库初始化

#### 步骤 1: 创建 MySQL 数据库和用户

```sql
-- 连接到 MySQL
mysql -h 192.168.50.50 -u root -pWfw7539148@

-- 创建数据库
CREATE DATABASE IF NOT EXISTS yqad_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（可选，更安全）
CREATE USER IF NOT EXISTS 'yqad_user'@'%' IDENTIFIED BY 'Yqad@2026Secure';
GRANT ALL PRIVILEGES ON yqad_db.* TO 'yqad_user'@'%';
FLUSH PRIVILEGES;

-- 使用数据库
USE yqad_db;
```

#### 步骤 2: 创建数据表

执行上述所有 `CREATE TABLE` 语句。

#### 步骤 3: 初始化 Redis 结构

```bash
# 连接到 Redis
docker exec -it redis redis-cli

# 初始化敏感词集合（示例）
SADD sensitive:words 敏感词 1 敏感词 2 敏感词 3

# 设置 API Token
SET api:token "your_api_token_here"

# 设置主题可用次数（示例）
ZADD topic:uses 1718841600 "topic1:5"
```

#### 步骤 4: 初始化 ChromaDB Collection

```typescript
import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient({
  path: 'http://chromadb:8000' // 容器内访问
});

// 创建素材向量集合
const collection = await chroma.getOrCreateCollection({
  name: 'materials',
  metadata: { 
    description: 'Material embeddings for similarity search',
    dimension: 512 // 根据使用的 embedding 模型调整
  }
});

console.log('✅ ChromaDB Collection 创建成功');
```

---

### 3.2 第二阶段：代码改造

#### 步骤 1: 创建数据库连接模块

**文件**: `src/database/index.ts`

```typescript
import { createPool, Pool } from 'mysql2/promise';
import { createClient } from 'redis';
import { ChromaClient } from 'chromadb';
import { getLogger } from '../utils/logger';

const logger = getLogger('database');

// MySQL 连接池
let mysqlPool: Pool;

// Redis 客户端
let redisClient: ReturnType<typeof createClient>;

// ChromaDB 客户端
let chromaClient: ChromaClient;

/**
 * 初始化 MySQL 连接
 */
export async function initMySQL() {
  mysqlPool = createPool({
    host: process.env.MYSQL_HOST || 'mysql',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'Wfw7539148@',
    database: process.env.MYSQL_DATABASE || 'yqad_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  // 测试连接
  try {
    const connection = await mysqlPool.getConnection();
    logger.info('✅ MySQL 连接成功');
    connection.release();
  } catch (error) {
    logger.error('❌ MySQL 连接失败:', error);
    throw error;
  }

  return mysqlPool;
}

/**
 * 初始化 Redis 连接
 */
export async function initRedis() {
  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379')
    }
  });

  redisClient.on('error', (err) => logger.error('Redis 错误:', err));

  await redisClient.connect();
  logger.info('✅ Redis 连接成功');

  return redisClient;
}

/**
 * 初始化 ChromaDB 连接
 */
export async function initChromaDB() {
  chromaClient = new ChromaClient({
    path: process.env.CHROMADB_URL || 'http://chromadb:8000'
  });

  try {
    const collections = await chromaClient.listCollections();
    logger.info(`✅ ChromaDB 连接成功，现有 ${collections.length} 个集合`);
  } catch (error) {
    logger.error('❌ ChromaDB 连接失败:', error);
    throw error;
  }

  return chromaClient;
}

/**
 * 获取 MySQL 连接池
 */
export function getMySQLPool(): Pool {
  if (!mysqlPool) {
    throw new Error('MySQL 未初始化');
  }
  return mysqlPool;
}

/**
 * 获取 Redis 客户端
 */
export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis 未初始化');
  }
  return redisClient;
}

/**
 * 获取 ChromaDB 客户端
 */
export function getChromaDBClient(): ChromaClient {
  if (!chromaClient) {
    throw new Error('ChromaDB 未初始化');
  }
  return chromaClient;
}

/**
 * 关闭所有数据库连接
 */
export async function closeAllConnections() {
  if (mysqlPool) {
    await mysqlPool.end();
    logger.info('MySQL 连接已关闭');
  }
  
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis 连接已关闭');
  }
}
```

---

#### 步骤 2: 创建环境变量配置

**文件**: `.env.example`

```bash
# MySQL 配置
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=Wfw7539148@
MYSQL_DATABASE=yqad_db

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379

# ChromaDB 配置
CHROMADB_URL=http://chromadb:8000

# 应用配置
NODE_ENV=production
PORT=3000
```

---

#### 步骤 3: 迁移任务存储

**文件**: `src/database/repositories/task-repository.ts`

```typescript
import { getMySQLPool, getRedisClient } from '../index';
import { AsyncTask, TaskStatus } from '../../types/api-remote-post';
import { getLogger } from '../../utils/logger';

const logger = getLogger('task-repository');

export class TaskRepository {
  /**
   * 保存任务到 MySQL
   */
  async save(task: AsyncTask): Promise<void> {
    const pool = getMySQLPool();
    const redis = getRedisClient();

    try {
      // 写入 MySQL
      await pool.execute(
        `INSERT INTO async_tasks 
         (task_id, task_type, status, content, images, platform, scheduled_time)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         updated_at = CURRENT_TIMESTAMP`,
        [
          task.taskId,
          task.taskType,
          task.status,
          task.content,
          JSON.stringify(task.images),
          task.platform,
          task.scheduledTime || null
        ]
      );

      // 写入 Redis 缓存
      await redis.hSet(`task:${task.taskId}`, {
        task_id: task.taskId,
        status: task.status,
        created_at: task.createdAt.toString()
      });
      
      // 设置 30 分钟过期
      await redis.expire(`task:${task.taskId}`, 1800);

      logger.debug(`任务 ${task.taskId} 已保存`);
    } catch (error) {
      logger.error(`保存任务失败:`, error);
      throw error;
    }
  }

  /**
   * 获取任务
   */
  async getById(taskId: string): Promise<AsyncTask | null> {
    const pool = getMySQLPool();
    
    try {
      const [rows]: any = await pool.execute(
        'SELECT * FROM async_tasks WHERE task_id = ?',
        [taskId]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        taskId: row.task_id,
        taskType: row.task_type,
        status: row.status as TaskStatus,
        content: row.content,
        images: JSON.parse(row.images || '[]'),
        platform: row.platform,
        scheduledTime: row.scheduled_time,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined
      };
    } catch (error) {
      logger.error(`获取任务失败:`, error);
      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  async updateStatus(taskId: string, status: TaskStatus, result?: string): Promise<void> {
    const pool = getMySQLPool();
    const redis = getRedisClient();

    try {
      await pool.execute(
        `UPDATE async_tasks 
         SET status = ?, 
             result = ?,
             completed_at = CASE WHEN ? IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE task_id = ?`,
        [status, result, status, taskId]
      );

      // 更新 Redis 缓存
      await redis.hSet(`task:${taskId}`, {
        status,
        result: result || '',
        updated_at: Date.now().toString()
      });

      logger.debug(`任务 ${taskId} 状态更新为 ${status}`);
    } catch (error) {
      logger.error(`更新任务状态失败:`, error);
      throw error;
    }
  }

  /**
   * 删除任务
   */
  async delete(taskId: string): Promise<void> {
    const pool = getMySQLPool();
    const redis = getRedisClient();

    try {
      await pool.execute('DELETE FROM async_tasks WHERE task_id = ?', [taskId]);
      await redis.del(`task:${taskId}`);
      logger.debug(`任务 ${taskId} 已删除`);
    } catch (error) {
      logger.error(`删除任务失败:`, error);
      throw error;
    }
  }

  /**
   * 清理过期任务
   */
  async cleanupExpired(expiryMinutes: number = 30): Promise<number> {
    const pool = getMySQLPool();

    try {
      const [result]: any = await pool.execute(
        `DELETE FROM async_tasks 
         WHERE completed_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [expiryMinutes]
      );

      logger.info(`清理了 ${result.affectedRows} 个过期任务`);
      return result.affectedRows;
    } catch (error) {
      logger.error(`清理过期任务失败:`, error);
      throw error;
    }
  }
}

export const taskRepository = new TaskRepository();
```

---

#### 步骤 4: 修改路由使用数据库

**文件**: `src/web/routes/posts-routes.ts`

修改前：
```typescript
const taskStore = new Map<string, AsyncTask>();
```

修改后：
```typescript
import { taskRepository } from '../../database/repositories/task-repository';

// 移除 Map，使用数据库
// const taskStore = new Map<string, AsyncTask>();
```

修改任务创建逻辑：
```typescript
// 原代码
// taskStore.set(taskId, task);

// 新代码
await taskRepository.save(task);
```

---

### 3.3 第三阶段：数据迁移

#### 步骤 1: 迁移现有 JSON 数据

**脚本**: `scripts/migrate-json-to-db.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { getMySQLPool, getRedisClient } from '../src/database';

async function migrateJsonFiles() {
  console.log('开始迁移 JSON 数据到数据库...');

  // 初始化数据库连接
  await getMySQLPool();
  await getRedisClient();

  const dataDir = path.join(__dirname, '../data');

  // 1. 迁移 token.json
  try {
    const tokenData = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'token.json'), 'utf-8')
    );
    // 写入 MySQL tokens 表
    console.log('✅ token.json 迁移完成');
  } catch (error) {
    console.error('❌ token.json 迁移失败:', error);
  }

  // 2. 迁移 api-token.json
  try {
    const apiTokenData = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'api-token.json'), 'utf-8')
    );
    // 写入 MySQL 或 Redis
    console.log('✅ api-token.json 迁移完成');
  } catch (error) {
    console.error('❌ api-token.json 迁移失败:', error);
  }

  // 3. 迁移 sensitive-words.json
  try {
    const sensitiveData = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'sensitive-words.json'), 'utf-8')
    );
    // 写入 Redis Set
    console.log('✅ sensitive-words.json 迁移完成');
  } catch (error) {
    console.error('❌ sensitive-words.json 迁移失败:', error);
  }

  // 4. 迁移其他 JSON 文件...
  // comment-history.json, post-history.json, pending-posts.json 等

  console.log('迁移完成！');
  process.exit(0);
}

migrateJsonFiles().catch(console.error);
```

---

#### 步骤 2: 迁移素材元数据

**脚本**: `scripts/migrate-materials.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { getMySQLPool, getChromaDBClient } from '../src/database';

async function migrateMaterials() {
  console.log('开始迁移素材元数据...');

  const pool = await getMySQLPool();
  const chroma = await getChromaDBClient();

  const materialsDir = path.join(__dirname, '../data/materials/processed/.materials');
  const indexFile = path.join(materialsDir, 'index.json');

  // 读取现有索引
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));

  for (const material of index.materials) {
    try {
      // 插入 MySQL
      await pool.execute(
        `INSERT INTO materials 
         (file_path, file_name, file_type, file_size, width, height, location, taken_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          material.path,
          material.fileName,
          material.type,
          material.size,
          material.width,
          material.height,
          material.location,
          material.takenAt
        ]
      );

      // 如果有向量数据，迁移到 ChromaDB
      if (material.embedding) {
        const collection = await chroma.getOrCreateCollection({ name: 'materials' });
        await collection.add({
          ids: [material.id],
          embeddings: [material.embedding],
          metadatas: [{ file_path: material.path }]
        });
      }

      console.log(`✅ 迁移素材：${material.fileName}`);
    } catch (error) {
      console.error(`❌ 迁移素材失败：${material.fileName}`, error);
    }
  }

  console.log('素材迁移完成！');
  process.exit(0);
}

migrateMaterials().catch(console.error);
```

---

### 3.4 第四阶段：测试验证

#### 步骤 1: 单元测试

为每个 Repository 编写单元测试：

```typescript
// tests/task-repository.test.ts
import { taskRepository } from '../src/database/repositories/task-repository';

describe('TaskRepository', () => {
  it('应该成功保存和获取任务', async () => {
    const task = {
      taskId: 'test-123',
      taskType: 'post',
      status: 'pending',
      content: '测试内容',
      images: [],
      platform: 'xiaohongshu',
      createdAt: Date.now()
    };

    await taskRepository.save(task);
    const saved = await taskRepository.getById('test-123');
    
    expect(saved).toBeDefined();
    expect(saved?.taskId).toBe('test-123');
  });
});
```

#### 步骤 2: 集成测试

测试完整的发帖流程：

```bash
npm run test:integration
```

#### 步骤 3: 性能测试

```bash
# 测试数据库连接性能
npm run bench:database
```

---

### 3.5 第五阶段：部署上线

#### 步骤 1: 更新 Docker 配置

**文件**: `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制代码
COPY . .

# 构建
RUN npm run build

# 环境变量
ENV NODE_ENV=production
ENV MYSQL_HOST=mysql
ENV MYSQL_USER=root
ENV MYSQL_PASSWORD=Wfw7539148@
ENV MYSQL_DATABASE=yqad_db
ENV REDIS_HOST=redis
ENV CHROMADB_URL=http://chromadb:8000

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### 步骤 2: 重新构建和部署

```bash
# 构建新镜像
docker build -t yqad-auto-tasks:latest .

# 停止旧容器
docker stop yqad-auto-tasks
docker rm yqad-auto-tasks

# 启动新容器（加入 bridge 网络）
docker run -d \
  --name yqad-auto-tasks \
  --network bridge \
  -p 3002:3000 \
  --env-file .env \
  --restart always \
  yqad-auto-tasks:latest

# 查看日志
docker logs -f yqad-auto-tasks
```

---

## 四、迁移检查清单

### 4.1 数据库初始化

- [ ] MySQL 数据库创建成功
- [ ] 所有数据表创建成功
- [ ] MySQL 用户和权限配置正确
- [ ] Redis 连接成功
- [ ] ChromaDB 连接成功
- [ ] ChromaDB Collection 创建成功

### 4.2 代码改造

- [ ] 数据库连接模块创建完成
- [ ] 环境变量配置完成
- [ ] TaskRepository 实现完成
- [ ] 所有使用 Map 的地方改为使用 Repository
- [ ] 所有文件读写改为使用数据库
- [ ] 错误处理完善

### 4.3 数据迁移

- [ ] token.json 迁移完成
- [ ] api-token.json 迁移完成
- [ ] sensitive-words.json 迁移完成
- [ ] comment-history.json 迁移完成
- [ ] post-history.json 迁移完成
- [ ] pending-posts.json 迁移完成
- [ ] materials index.json 迁移完成
- [ ] image-cache.json 迁移完成
- [ ] global-prompt.json 迁移完成
- [ ] post-logs.json 迁移完成
- [ ] vehicle-token.json 迁移完成
- [ ] summaries 迁移完成

### 4.4 测试验证

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 性能测试通过
- [ ] 手动测试发帖功能
- [ ] 手动测试评论功能
- [ ] 手动测试素材管理
- [ ] 验证数据持久化
- [ ] 验证 Redis 缓存
- [ ] 验证 ChromaDB 向量搜索

### 4.5 部署上线

- [ ] Docker 镜像构建成功
- [ ] 容器启动成功
- [ ] 数据库连接正常
- [ ] 应用功能正常
- [ ] 日志输出正常
- [ ] 监控告警配置

---

## 五、回滚方案

如果迁移过程中出现问题，需要能够快速回滚：

### 5.1 代码回滚

```bash
# 使用 Git 回滚到迁移前的版本
git checkout <migration-before-commit>

# 重新构建和部署
docker-compose up -d --build
```

### 5.2 数据回滚

```bash
# 从备份恢复 JSON 文件
cp /backup/data_20260620/* ./data/

# 清空数据库表
mysql -u root -p yqad_db -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE async_tasks; ..."
```

### 5.3 混合模式

可以暂时同时使用内存/文件和数据库，逐步切换：

```typescript
// 双写模式
async function saveTask(task: AsyncTask) {
  // 写入数据库
  await taskRepository.save(task);
  
  // 同时写入内存（回滚保障）
  taskStore.set(task.taskId, task);
}

async function getTask(taskId: string) {
  // 优先从数据库读取
  try {
    return await taskRepository.getById(taskId);
  } catch (error) {
    // 失败时从内存读取
    return taskStore.get(taskId);
  }
}
```

---

## 六、性能优化建议

### 6.1 MySQL 优化

1. **连接池配置**:
   ```typescript
   createPool({
     connectionLimit: 10,
     waitForConnections: true,
     queueLimit: 0
   })
   ```

2. **索引优化**:
   - 为常用查询字段添加索引
   - 定期分析慢查询日志

3. **批量操作**:
   ```typescript
   // 使用批量插入
   await pool.execute(
     'INSERT INTO table (col1, col2) VALUES (?, ?), (?, ?), (?, ?)',
     [val1, val2, val3, val4, val5, val6]
   );
   ```

### 6.2 Redis 优化

1. **合理使用数据结构**:
   - Hash: 对象存储
   - Set: 唯一值集合（如敏感词）
   - Sorted Set: 排行榜（如主题使用次数）
   - List: 队列

2. **设置合适的 TTL**:
   ```typescript
   await redis.setex('key', 1800, 'value'); // 30 分钟过期
   ```

3. **Pipeline 批量操作**:
   ```typescript
   const pipeline = redis.pipeline();
   pipeline.set('key1', 'value1');
   pipeline.set('key2', 'value2');
   await pipeline.exec();
   ```

### 6.3 ChromaDB 优化

1. **批量添加向量**:
   ```typescript
   await collection.add({
     ids: ['id1', 'id2', 'id3'],
     embeddings: [emb1, emb2, emb3],
     metadatas: [meta1, meta2, meta3]
   });
   ```

2. **使用过滤查询**:
   ```typescript
   const results = await collection.query({
     queryEmbeddings: [query],
     where: { file_type: 'image' },
     nResults: 10
   });
   ```

---

## 七、监控和告警

### 7.1 数据库连接监控

```typescript
// 定期检查数据库连接健康状态
setInterval(async () => {
  try {
    const pool = getMySQLPool();
    await pool.execute('SELECT 1');
    logger.debug('MySQL 连接健康');
  } catch (error) {
    logger.error('MySQL 连接异常:', error);
    // 发送告警
  }
}, 60000); // 每分钟检查
```

### 7.2 慢查询日志

在 MySQL 配置中启用慢查询日志：
```cnf
slow_query_log=1
slow_query_log_file=/logs/slow.log
long_query_time=2
```

### 7.3 Redis 内存监控

```bash
# 定期检查 Redis 内存使用
docker exec redis redis-cli INFO memory
```

---

## 八、迁移完成状态

### 8.1 Redis 迁移 ✅ 完成

**迁移内容**:
- ✅ 主题可用次数存储 (`topic:uses:{topicId}`)
- ✅ 敏感词库 (`sensitive:words`)
- ✅ API Token (`api:token`)
- ✅ 任务缓存 (`task:cache`)
- ✅ 车辆 Token (`vehicle:token`)
- ✅ 图片 OCR 缓存 (`image:cache`)
- ✅ 每日摘要 (`daily:summary`)

**相关文件**:
- `src/storage/redis/topic-uses-storage.ts`
- `src/storage/redis/sensitive-words-storage.ts`
- `src/storage/redis/api-token-storage.ts`
- `src/utils/redis-connection-manager.ts`

---

### 8.2 MySQL 迁移 ✅ 完成

**迁移内容**:
- ✅ members (会员信息)
- ✅ posts (帖子历史)
- ✅ comments (评论历史)
- ✅ post_logs (发帖日志)
- ✅ comment_logs (评论日志)
- ✅ pending_posts (待发布帖子)
- ✅ compliance_reports (合规性报告)
- ✅ global_prompts (全局人设)
- ✅ topics (主题)
- ✅ topic_sub_directions (主题子方向)
- ✅ topic_sub_direction_usages (子方向使用记录)
- ✅ topic_material_usages (素材使用记录)
- ✅ material_records (素材记录)
- ✅ daily_summaries (每日摘要)

**相关文件**:
- `src/storage/mysql/*.ts` (所有 MySQL Storage 模块)
- `src/utils/mysql-connection-manager.ts`
- `scripts/prod-create-tables.sql`
- `scripts/prod-init-data.js`

---

### 8.3 ChromaDB 迁移 ✅ 完成

**迁移内容**:
- ✅ materials Collection (素材向量)
- ✅ content_dedup Collection (内容去重)
- ✅ topic_recommend Collection (主题推荐)

**相关文件**:
- `src/utils/chroma-connection-manager.ts` - ChromaDB 连接管理
- `src/storage/chroma/material-vector-storage.ts` - 素材向量存储
- `scripts/migrate-to-chromadb.ts` - 数据迁移脚本

**环境配置**:
```bash
# 本地开发
CHROMADB_URL=http://192.168.50.50:8000

# 生产环境
CHROMADB_URL=http://chromadb:8000
```

**使用方法**:
```typescript
import { initChromaDB, getChromaCollection } from './utils/chroma-connection-manager';
import { materialVectorStorage } from './storage/chroma/material-vector-storage';

// 初始化
await initChromaDB();

// 添加素材向量
await materialVectorStorage.addVector(
  'material_123',
  embedding,
  { file_path: '/path/to/image.jpg', file_name: 'image.jpg' }
);

// 相似度搜索
const results = await materialVectorStorage.searchSimilar(queryEmbedding, { nResults: 10 });
```

---

## 八、常见问题解答

### Q1: 迁移过程中服务需要停机吗？

**A**: 建议采用渐进式迁移：
1. 先部署数据库
2. 代码支持双写（同时写入内存和数据库）
3. 验证数据库写入正常
4. 切换到只读数据库
5. 完全切换

### Q2: 数据迁移失败怎么办？

**A**: 
1. 立即停止迁移脚本
2. 检查错误日志
3. 修复问题后重新运行
4. 脚本应支持断点续传

### Q3: 数据库性能不如内存怎么办？

**A**:
1. 添加 Redis 缓存层
2. 优化 SQL 查询和索引
3. 调整连接池大小
4. 考虑读写分离

### Q4: 如何保证数据一致性？

**A**:
1. 使用事务
2. 实现重试机制
3. 定期数据对账
4. 记录详细日志

---

## 九、附录

### 9.1 完整 SQL 脚本

**文件**: `scripts/init-database.sql`

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS yqad_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE yqad_db;

-- 创建所有数据表
-- (包含本文档中所有 CREATE TABLE 语句)

-- 创建索引
-- (包含本文档中所有 CREATE INDEX 语句)

-- 初始化数据
INSERT INTO global_prompts (prompt_key, prompt_content, category) VALUES
  ('post_template', '默认发帖模板', 'post'),
  ('comment_template', '默认评论模板', 'comment');

-- 创建数据库用户
CREATE USER IF NOT EXISTS 'yqad_user'@'%' IDENTIFIED BY 'Yqad@2026Secure';
GRANT ALL PRIVILEGES ON yqad_db.* TO 'yqad_user'@'%';
FLUSH PRIVILEGES;
```

### 9.2 迁移脚本清单

| 脚本名称 | 用途 | 执行顺序 |
|---------|------|---------|
| `init-database.sql` | 初始化数据库结构 | 1 |
| `migrate-json-to-db.ts` | 迁移 JSON 文件 | 2 |
| `migrate-materials.ts` | 迁移素材元数据 | 3 |
| `verify-migration.ts` | 验证迁移结果 | 4 |

### 9.3 参考文档

- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [Redis 官方文档](https://redis.io/docs/)
- [ChromaDB 官方文档](https://docs.trychroma.com/)
- [Node.js MySQL2 文档](https://github.com/sidorares/node-mysql2)
- [Node.js Redis 文档](https://github.com/redis/node-redis)

---

**文档版本**: v1.0  
**最后更新**: 2026-06-20  
**维护人员**: [待填写]  
**审核状态**: 待审核
