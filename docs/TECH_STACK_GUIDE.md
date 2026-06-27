# 技术栈使用指南

**项目**: 一汽奥迪 APP 自动签到、评论与发帖系统  
**技术栈**: MySQL + Redis + ChromaDB  
**更新时间**: 2026-06-23

---

## 📊 技术架构总览

本项目采用 **三数据库架构**，充分发挥各数据库的优势：

```
┌─────────────────────────────────────────────────────────┐
│                     应用层 (Node.js)                     │
└─────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌────────────┐      ┌────────────┐      ┌────────────┐
    │   MySQL    │      │   Redis    │      │ ChromaDB   │
    │  关系型 DB  │      │  缓存/实时  │      │  向量数据库 │
    └────────────┘      └────────────┘      └────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    - 发帖历史           - Token 缓存          - 素材向量
    - 素材记录           - 敏感词             - 内容去重
    - 评论数据           - 任务缓存           - 主题推荐
    - 用户数据           - 车辆 Token         - 敏感词变体
                         - 图片缓存           - 评论情感
```

---

## 🗄️ MySQL - 结构化数据存储

### 定位
**关系型数据库**，用于存储结构化、需要事务支持的核心业务数据。

### 存储内容
| 数据类型 | 说明 | 表名 |
|---------|------|-----|
| 发帖历史 | 所有发帖记录 | `post_history` |
| 素材记录 | 本地和网络素材 | `material_records` |
| 评论数据 | 评论历史和日志 | `comments`, `comment_logs` |
| 用户数据 | 账户信息 | `users` |
| 主题数据 | 主题配置 | `topics` |

### 使用场景
- ✅ 需要复杂查询和关联的数据
- ✅ 需要事务支持的操作
- ✅ 历史数据归档和统计
- ✅ 结构化数据的 CRUD

### 代码示例
```typescript
import { getPostHistoryStorage } from './storage/mysql/post-history-storage';

const storage = getPostHistoryStorage();

// 保存发帖历史
await storage.savePost({
  title: '奥迪 Q5L 试驾体验',
  content: '今天去试驾了...',
  topic_id: 'topic_123',
});

// 语义搜索（集成 ChromaDB）
const results = await storage.searchPostsBySemantic('SUV 试驾', 10, 0.6);
```

### 配置文件
```yaml
# config/default.yaml
database:
  mysql:
    host: localhost
    port: 3306
    database: audi_app
    user: root
    password: your_password
```

---

## 🚀 Redis - 缓存和实时数据

### 定位
**内存数据库**，用于高速缓存、实时数据和轻量级存储。

### 存储内容
| 数据类型 | 说明 | TTL |
|---------|------|-----|
| API Token | 接口访问令牌 | 2 小时 |
| 敏感词 | 敏感词列表（精确匹配） | 永久 |
| 任务缓存 | 当前任务状态 | 24 小时 |
| 车辆 Token | 车辆监控 Token | 1 小时 |
| 图片缓存 | 图片元数据 | 7 天 |

### 使用场景
- ✅ 高频访问的缓存数据
- ✅ Token 和会话管理
- ✅ 实时状态和计数器
- ✅ 轻量级键值存储

### 代码示例
```typescript
import { apiTokenStorage } from './storage/redis/api-token-storage';
import { sensitiveWordsStorage } from './storage/redis/sensitive-words-storage';

// 获取 Token
const token = await apiTokenStorage.getToken();

// 检查敏感词（精确匹配）
const result = sensitiveWordsStorage.checkSensitiveWord('加微信');
if (result.contains) {
  console.log('包含敏感词:', result.words);
}

// 设置任务缓存
await taskCacheStorage.setTaskStatus('task_123', 'running');
```

### 配置文件
```yaml
# config/default.yaml
redis:
  production:
    host: redis
    port: 6379
    password: your_password
  development:
    host: localhost
    port: 6379
```

---

## 🔮 ChromaDB - 向量数据搜索

### 定位
**向量数据库**，用于语义搜索、相似度匹配和 AI 向量存储。

### Collections
| Collection | 用途 | 向量维度 | 距离函数 |
|-----------|------|---------|---------|
| `materials` | 素材向量存储 | 1536 | cosine |
| `content_dedup` | 内容去重 | 1536 | cosine |
| `topic_recommend` | 主题推荐 | 1536 | cosine |
| `sensitive_variants` | 敏感词变体 | 1536 | cosine |
| `comment_sentiment` | 评论情感分析 | 1536 | cosine |

### 使用场景
- ✅ 语义搜索（不只是关键词匹配）
- ✅ 内容去重（语义层面）
- ✅ 相似度推荐
- ✅ 情感分析和聚类
- ✅ 变体识别

### 代码示例
```typescript
import { materialVectorStorage } from './storage/chroma/material-vector-storage';
import { contentDedupStorage } from './storage/chroma/content-dedup-storage';
import { embeddingVectorizer } from './utils/embedding-vectorizer';

// 生成向量
const embedding = await embeddingVectorizer.generateEmbedding('奥迪 SUV 试驾体验');

// 素材语义搜索
const materials = await materialVectorStorage.searchSimilar(embedding, {
  nResults: 10,
  minSimilarity: 0.7,
});

// 内容去重检查
const isDuplicate = await contentDedupStorage.isDuplicate(embedding, 0.85);
if (isDuplicate) {
  console.log('内容重复度过高');
}
```

### 配置文件
```yaml
# config/default.yaml
chromadb:
  local:
    host: http://10.6.0.5:8000
  production:
    host: http://chromadb:8000
```

---

## 🔧 三数据库协同工作

### 场景 1: 发帖流程

```
1. 用户触发发帖
   ↓
2. MySQL: 检查发帖历史（频率限制）
   ↓
3. Redis: 检查敏感词（精确匹配）
   ↓
4. ChromaDB: 内容去重（语义层面）✅
   ↓
5. ChromaDB: 敏感词变体检测 ✅
   ↓
6. 发帖成功
   ↓
7. MySQL: 保存发帖记录
   ↓
8. ChromaDB: 同步向量（用于后续去重）✅
   ↓
9. ChromaDB: 推荐相似主题 ✅
```

### 场景 2: 评论流程

```
1. 用户发表评论
   ↓
2. Redis: 敏感词检查（精确匹配）
   ↓
3. MySQL: 保存评论
   ↓
4. ChromaDB: 情感分析（异步）✅
   ↓
5. ChromaDB: 水军检测（相似度 + 时间窗口）✅
```

### 场景 3: 素材搜索

```
1. 需要素材（如：SUV、夜景）
   ↓
2. ChromaDB: 语义搜索（优先）✅
   - 根据描述搜索，不仅关键词
   ↓
3. 如果 ChromaDB 无结果
   ↓
4. MySQL: 关键词搜索（回退）
   - LIKE 查询
```

---

## 📁 核心文件结构

```
src/
├── storage/
│   ├── mysql/              # MySQL 存储层
│   │   ├── post-history-storage.ts
│   │   ├── material-record-storage.ts
│   │   ├── comment-storage.ts
│   │   └── ...
│   ├── redis/              # Redis 存储层
│   │   ├── api-token-storage.ts
│   │   ├── sensitive-words-storage.ts
│   │   ├── task-cache-storage.ts
│   │   └── ...
│   └── chroma/             # ChromaDB 存储层
│       ├── material-vector-storage.ts
│       ├── content-dedup-storage.ts
│       ├── topic-recommend-storage.ts
│       ├── sensitive-variant-storage.ts      ⭐ 新增
│       └── comment-sentiment-storage.ts      ⭐ 新增
├── services/
│   ├── chroma-search-service.ts              # ChromaDB 搜索服务
│   ├── compliance-check-orchestrator.ts      # 合规检查（集成变体检测）⭐
│   ├── enhanced-comment-service.ts           # 增强评论服务（情感分析）⭐
│   └── ...
└── utils/
    ├── chroma-connection-manager.ts          # ChromaDB 连接管理
    ├── redis-connection-manager.ts           # Redis 连接管理
    ├── embedding-vectorizer.ts               # OpenAI 向量生成
    └── ...
```

---

## 🧪 测试脚本

### 运行测试

```bash
# 1. 敏感词变体识别
npx ts-node scripts/test-sensitive-variants.ts

# 2. 评论情感分析
npx ts-node scripts/test-comment-sentiment.ts

# 3. 主题推荐
npx ts-node scripts/test-topic-recommendation.ts

# 4. 语义搜索
npx ts-node scripts/test-semantic-search.ts
```

### 测试内容
- ✅ 向量生成和存储
- ✅ 相似度搜索
- ✅ 变体检测
- ✅ 情感分析
- ✅ 水军检测
- ✅ 主题推荐

---

## 📊 性能对比

| 操作 | MySQL | Redis | ChromaDB |
|-----|-------|-------|----------|
| 简单查询 | ~10ms | ~1ms | ~50ms |
| 复杂查询 | ~100ms | ❌ | ~100ms |
| 语义搜索 | ❌ | ❌ | ~100ms |
| 相似度匹配 | ❌ | ❌ | ~50ms |
| 写入速度 | ~20ms | ~1ms | ~100ms |
| 并发能力 | 中 | 高 | 中 |

**建议**：
- 高频缓存 → Redis
- 结构化数据 → MySQL
- 语义搜索 → ChromaDB

---

## 🔧 环境隔离

### 开发环境
```yaml
MySQL: localhost:3306
Redis: localhost:6379
ChromaDB: http://10.6.0.5:8000
```

### 生产环境
```yaml
MySQL: mysql:3306
Redis: redis:6379
ChromaDB: http://chromadb:8000
```

### Collection 前缀
- 开发：`dev:materials`, `dev:content_dedup`, ...
- 生产：`prod:materials`, `prod:content_dedup`, ...

---

## 🚨 注意事项

### 1. 数据一致性
- MySQL 和 ChromaDB 需要保持同步
- 使用事务保证 MySQL 写入成功后再同步 ChromaDB
- 失败时记录日志，支持手动修复

### 2. 向量生成成本
- OpenAI Embedding: $0.0000002 / 条
- 使用缓存机制（1 小时 TTL）
- 批量生成（每批 10 条）

### 3. Redis 过期策略
- Token 类：2 小时
- 缓存类：24 小时 - 7 天
- 永久数据：敏感词列表

### 4. ChromaDB 性能
- 单 Collection 建议 < 100 万条
- 定期清理过期数据
- 使用相似度阈值过滤

---

## 📈 监控和维护

### 健康检查
```typescript
import { checkChromaDBHealth, checkRedisHealth } from './utils/health-check';

const chromaHealth = await checkChromaDBHealth();
const redisHealth = await checkRedisHealth();

if (!chromaHealth.healthy || !redisHealth.healthy) {
  logger.error('数据库健康检查失败');
}
```

### 统计信息
```typescript
// ChromaDB 向量数量
const count = await contentDedupStorage.count();

// Redis 键数量
const keys = await redisClient.keys('*');
console.log('Redis 键数量:', keys.length);

// MySQL 表大小
const result = await mysql.query('SELECT COUNT(*) FROM post_history');
```

---

## 🎯 最佳实践

### 1. 选择合适的数据库
```typescript
// ❌ 错误：用 MySQL 做语义搜索
const posts = await mysql.query(
  "SELECT * FROM post_history WHERE content LIKE '%SUV%'"
);

// ✅ 正确：用 ChromaDB 做语义搜索
const embedding = await embeddingVectorizer.generateEmbedding('SUV 试驾');
const posts = await chromaDB.searchSimilar(embedding, { nResults: 10 });
```

### 2. 合理使用缓存
```typescript
// ✅ 高频数据使用 Redis
const token = await redis.get('api_token');
if (!token) {
  token = await fetchNewToken();
  await redis.set('api_token', token, 'EX', 7200);  // 2 小时
}
```

### 3. 向量生成优化
```typescript
// ✅ 批量生成（而不是逐个）
const texts = ['文本 1', '文本 2', '文本 3'];
const embeddings = await embeddingVectorizer.batchGenerateEmbeddings(texts, 10);

// ✅ 使用缓存
const cached = embeddingVectorizer.getCachedEmbedding(text);
if (cached) return cached;
```

### 4. 错误处理
```typescript
try {
  await chromaDB.addVector(id, embedding, metadata);
} catch (error) {
  logger.error('ChromaDB 写入失败:', error);
  // 记录到 MySQL，稍后重试
  await mysql.query(
    'INSERT INTO chroma_sync_queue (...) VALUES (...)'
  );
}
```

---

## 📚 相关文档

- [MySQL 迁移指南](./DATABASE_MIGRATION_GUIDE.md)
- [ChromaDB 复盘和改进](./CHROMADB_REVIEW_AND_IMPROVEMENT.md)
- [部署指南](../DEPLOYMENT.md)

---

**最后更新**: 2026-06-23  
**维护者**: Development Team
