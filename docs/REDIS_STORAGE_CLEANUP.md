# Redis 存储清理 - 移除降级逻辑

## 概述

本次清理移除了所有 Redis 存储模块的内存降级逻辑，改为**仅使用 Redis 存储**。Redis 不可用时直接抛出异常，不再降级到内存存储。

## 修改的文件

### 1. 配置文件

#### `/config/default.yaml`
- ❌ 删除：`auth.tokenStorePath: "./data/api-token.json"`
- ✅ 改为：`# API Token 使用 Redis 存储，无需文件路径`
- ❌ 删除：`sensitiveWordFilter.wordLibraryPath: "./data/sensitive-words.json"`
- ✅ 改为：`# 敏感词库使用 Redis 存储，无需文件路径`

#### `/deploy/synology/config/default.yaml`
- 同上

### 2. Redis 存储模块

#### `src/storage/redis/api-token-storage.ts`
**移除：**
- `private useRedis: boolean = true`
- `private memoryToken: string | null = null`
- 所有 `try-catch` 降级逻辑
- `resetToRedis()` 方法

**修改后：**
- 直接使用 Redis
- 错误时抛出异常

#### `src/storage/redis/sensitive-words-storage.ts`
**移除：**
- `private useRedis: boolean = true`
- `private memoryStore: Set<string> = new Set()`
- 所有 `try-catch` 降级逻辑
- `resetToRedis()` 方法

**修改后：**
- 直接使用 Redis
- 简化代码逻辑

#### `src/storage/redis/topic-uses-storage.ts`
**移除：**
- `private useRedis: boolean = true`
- `private memoryStore: Map<string, number> = new Map()`
- 所有 `try-catch` 降级逻辑
- `resetToRedis()` 方法

**修改后：**
- 直接使用 Redis
- 无内存降级

#### `src/storage/redis/task-cache-storage.ts`
**移除：**
- `private useRedis: boolean = true`
- `private memoryStore: Map<string, AsyncTask> = new Map()`
- 所有 `try-catch` 降级逻辑
- `resetToRedis()` 方法

**修改后：**
- 直接使用 Redis
- 简化实现

### 3. 初始化代码

#### `src/storage/redis/init.ts`
**修改：**
```typescript
// 修改前
logger.warn('应用将继续运行，但将使用内存/文件存储作为降级方案');
throw error; // 重新抛出错误，让调用者决定是否继续

// 修改后
throw error; // Redis 不可用时抛出异常
```

#### `src/index.ts`
**修改：**
```typescript
// 修改前
// 初始化 Redis 存储（可选，失败时降级到内存存储）
try {
  await initializeRedisStorage();
} catch (error) {
  logger.warn('Redis 初始化失败，将使用内存存储:', error);
}

// 初始化 MySQL 存储（可选，失败时不影响运行）
try {
  await initializeMySQLStorage();
} catch (error) {
  logger.warn('MySQL 初始化失败，将仅使用 Redis 存储:', error);
}

// 修改后
// 初始化 Redis 存储（必需，失败时抛出异常）
try {
  await initializeRedisStorage();
} catch (error) {
  logger.error('Redis 初始化失败，无法启动:', error);
  process.exit(1);
}

// 初始化 MySQL 存储（必需，失败时抛出异常）
try {
  await initializeMySQLStorage();
} catch (error) {
  logger.error('MySQL 初始化失败，无法启动:', error);
  process.exit(1);
}
```

### 4. 文档

#### `src/storage/redis/README.md`
**更新：**
- 删除所有关于"降级到内存"的说明
- 更新"设计原则"章节，说明无降级方案

#### `src/web/public/index.html`
**删除：**
- 删除注释 `// 保存 tokenStorePath 配置`

## 影响范围

### ✅ 保留的降级逻辑（合理）

以下降级逻辑是**业务层面**的，与存储无关，**保留不变**：
- AI 模型 fallback（`ai.fallback.*` 配置）
- 向量生成降级（返回零向量）
- 情感分析降级（关键词匹配）
- 本地素材 fallback（网络素材）
- 分词降级（简单分词）
- 合规检查降级（允许通过）

### ❌ 移除的降级逻辑（存储层）

以下存储层的降级逻辑**全部移除**：
- Redis 不可用时降级到内存 Map/Set
- Token 的内存存储
- 敏感词的内存存储
- 主题次数的内存存储
- 任务缓存的内存存储
- `resetToRedis()` 方法

## 设计原则

### 修改前
```
┌─────────────────────────────────────┐
│   应用层                              │
│         ↓                            │
│   存储层（自动降级）                   │
│   ├─ Redis ✅                        │
│   └─ Memory (降级方案) ⚠️            │
└─────────────────────────────────────┘
```

### 修改后
```
┌─────────────────────────────────────┐
│   应用层                              │
│         ↓                            │
│   存储层（仅 Redis）                   │
│   └─ Redis ✅                        │
│      (失败时抛出异常)                 │
└─────────────────────────────────────┘
```

## 优势

1. **代码简化**：移除了大量的 `try-catch` 和降级判断逻辑
2. **职责清晰**：存储层专注于 Redis，不处理降级
3. **问题暴露**：Redis 故障时立即暴露，便于快速发现和修复
4. **减少隐患**：避免内存存储导致的数据不一致问题

## 部署注意事项

### 启动前检查

确保以下服务可用：
1. ✅ Redis 服务正常运行
2. ✅ MySQL 服务正常运行
3. ✅ 网络连接正常

### 环境变量

确保以下环境变量正确配置：
```bash
# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PREFIX=prod:

# MySQL 配置
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=yqad_db
```

### 故障处理

如果 Redis 不可用：
1. 应用将**无法启动**
2. 日志会显示：`Redis 初始化失败，无法启动`
3. 需要先修复 Redis 服务

## 迁移步骤

### 1. 备份现有数据（如需要）

如果之前使用了内存降级，数据可能丢失：
```bash
# 检查 Redis 数据
redis-cli keys "prod:*"

# 检查旧的文件存储（如果还在使用）
ls -la ./data/*.json
```

### 2. 更新配置

确保 `config/default.yaml` 中：
- 删除 `tokenStorePath` 配置
- 删除 `wordLibraryPath` 配置

### 3. 重启应用

```bash
docker-compose restart yqad
```

### 4. 验证

```bash
# 检查 Redis 连接
redis-cli ping

# 检查应用日志
docker logs yqad-auto-tasks | grep "Redis 存储系统初始化完成"
```

## 总结

本次清理使存储层更加简洁和专注：
- ✅ 仅使用 Redis 存储
- ✅ 无降级逻辑
- ✅ 故障快速暴露
- ✅ 代码更易维护

**注意**：AI 模型、业务逻辑等其他层面的降级机制仍然保留，与本次清理无关。
