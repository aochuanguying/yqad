# Token 持久化改进 - 双重存储方案

## 问题发现

**用户提问**: "刷新 Token 之后更新到数据库了吗？"

**发现的问题**:
- ❌ Token 只保存到 Redis，没有保存到数据库
- ❌ Redis 重启或故障时 Token 会丢失
- ❌ 服务重启后需要重新登录或通过 Telecom API 刷新

---

## 解决方案：双重存储架构

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     Token 存储架构                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  主存储：Redis (auth:token)                                  │
│  - 快速访问（内存级）                                        │
│  - 支持降级到内存                                            │
│  - 服务运行时的首选存储                                      │
│                                                              │
│  备份存储：MySQL (auth_tokens 表)                            │
│  - 持久化保存                                                │
│  - 服务重启后可恢复                                          │
│  - 审计和故障排查                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 存储策略

| 操作 | Redis | 数据库 | 说明 |
|------|-------|--------|------|
| Token 刷新 | ✅ 保存 | ✅ 保存 | 双重保存 |
| 服务启动 | ✅ 读取 | ✅ 备份读取 | 优先 Redis，失败时读数据库 |
| Redis 故障 | ❌ 降级 | ✅ 可用 | 数据库作为备份 |
| 数据库故障 | ✅ 可用 | ❌ 跳过 | 不影响主流程 |

---

## 数据库表设计

### 表结构

**文件**: [`src/db/migrations/035_create_auth_tokens_table.sql`](file:///Users/mac/Documents/workspace/krio/yqad/src/db/migrations/035_create_auth_tokens_table.sql)

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键 ID',
  access_token TEXT NOT NULL COMMENT 'JWT 登录 Token',
  expires_at DATETIME NOT NULL COMMENT 'Token 过期时间',
  refreshed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后刷新时间',
  refresh_source VARCHAR(50) NOT NULL DEFAULT 'telecom_api' COMMENT '刷新来源',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_expires_at (expires_at),
  INDEX idx_refreshed_at (refreshed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INT | 主键 ID |
| `access_token` | TEXT | JWT 登录 Token（加密存储） |
| `expires_at` | DATETIME | Token 过期时间 |
| `refreshed_at` | DATETIME | 最后刷新时间 |
| `refresh_source` | VARCHAR(50) | 刷新来源：`telecom_api`, `web_ui`, `response_header` |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

---

## 实现细节

### 1. 数据库存储模块

**文件**: [`src/storage/mysql/auth-token-storage.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/storage/mysql/auth-token-storage.ts)

**核心方法**:

```typescript
class AuthTokenDatabaseStorage {
  // 保存 Token 到数据库
  async saveToken(token: AuthTokenRecord): Promise<boolean>
  
  // 从数据库获取 Token
  async getToken(): Promise<AuthTokenRecord | null>
  
  // 删除数据库中的 Token
  async deleteToken(): Promise<boolean>
  
  // 检查数据库中是否有 Token
  async hasToken(): Promise<boolean>
}
```

---

### 2. 双重保存到数据库

**文件**: [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts#L469)

**修改后的 `persistTokenToRedis()` 方法**:

```typescript
private async persistTokenToRedis(): Promise<void> {
  if (!this.token) return;
  
  // 1. 保存到 Redis（主存储）
  try {
    await authTokenStorage.saveToken(this.token.accessToken);
    logger.debug('Token 已保存到 Redis');
  } catch (error) {
    logger.warn('保存到 Redis 失败，降级到内存存储:', error);
  }
  
  // 2. 保存到数据库（持久化备份）
  try {
    const { authTokenDatabaseStorage } = await import('../storage/mysql/auth-token-storage');
    const saved = await authTokenDatabaseStorage.saveToken({
      access_token: this.token.accessToken,
      expires_at: new Date(this.token.expiresAt),
      refreshed_at: new Date(this.token.savedAt),
      refresh_source: 'telecom_api',
    });
    
    if (saved) {
      logger.debug('Token 已保存到数据库');
    } else {
      logger.warn('保存到数据库失败');
    }
  } catch (error: any) {
    logger.warn('保存到数据库失败:', error.message);
  }
}
```

**调用时机**:
- ✅ Token 刷新时（`forceRefreshToken()`）
- ✅ Web UI 登录时（`saveLoginToken()`）
- ✅ 响应头 Token 续期时（`updateTokenFromResponse()`）

---

### 3. 从数据库恢复 Token

**文件**: [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts#L503)

**修改后的 `loadStoredToken()` 方法**:

```typescript
private async loadStoredToken(): Promise<void> {
  // 1. 尝试从 Redis 加载
  try {
    const redisToken = await authTokenStorage.getToken();
    if (redisToken) {
      logger.info('已从 Redis 加载 Token');
      this.token = {
        accessToken: redisToken,
        refreshToken: '',
        expiresAt: Date.now() + 83 * 3600 * 1000,
        savedAt: Date.now(),
      };
      return;
    }
  } catch (error) {
    logger.warn('从 Redis 加载 Token 失败，尝试从数据库恢复:', error);
  }
  
  // 2. Redis 没有 Token，尝试从数据库恢复
  try {
    const { authTokenDatabaseStorage } = await import('../storage/mysql/auth-token-storage');
    const dbToken = await authTokenDatabaseStorage.getToken();
    
    if (dbToken && dbToken.access_token) {
      logger.info('已从数据库恢复 Token');
      this.token = {
        accessToken: dbToken.access_token,
        refreshToken: '',
        expiresAt: dbToken.expires_at.getTime(),
        savedAt: dbToken.refreshed_at ? dbToken.refreshed_at.getTime() : Date.now(),
      };
      
      // 同步回 Redis
      try {
        await authTokenStorage.saveToken(this.token.accessToken);
        logger.info('Token 已同步到 Redis');
      } catch (error) {
        logger.warn('同步 Token 到 Redis 失败:', error);
      }
      
      return;
    }
  } catch (error) {
    logger.warn('从数据库加载 Token 失败:', error);
  }
  
  // 3. Redis 和数据库都没有 Token，需要重新登录
  logger.info('Redis 和数据库中均无 Token，需要重新登录');
  this.token = null;
}
```

**恢复流程**:
```
服务启动
  ↓
从 Redis 加载 Token
  ├─ 成功 → 使用 Redis Token
  └─ 失败 → 从数据库加载
        ├─ 成功 → 使用数据库 Token + 同步到 Redis
        └─ 失败 → 需要重新登录
```

---

## 日志输出示例

### 场景 1: Token 刷新成功

```
[INFO] ========================================
[INFO] 【Token 强制刷新结果 - 成功】
[INFO]   刷新接口：Telecom API (/api/v1/audi/token)
[INFO]   请求耗时：234ms
[INFO]   刷新状态：✅ 成功
[INFO]   旧 Token: eyJhbGciOiJIUzI1NiIs...
[INFO]   新 Token: eyJhbGciOiJIUzI1NiIs...
[INFO]   延长小时数：96.0 小时
[INFO] ========================================
[DEBUG] Token 已保存到 Redis
[DEBUG] Token 已保存到数据库
```

### 场景 2: 服务启动，从数据库恢复

```
[INFO] 已从数据库恢复 Token
[INFO] Token 已同步到 Redis
```

### 场景 3: 数据库保存失败

```
[DEBUG] Token 已保存到 Redis
[WARN] 保存到数据库失败：Connection refused
```

---

## 优势分析

### 1. 持久化保障

| 场景 | 之前 | 现在 |
|------|------|------|
| Redis 重启 | ❌ Token 丢失 | ✅ 从数据库恢复 |
| 服务重启 | ❌ Token 丢失 | ✅ 从数据库恢复 |
| Redis 故障 | ⚠️ 降级到内存 | ✅ 数据库可用 |
| 数据库故障 | ✅ 不影响 | ✅ Redis 可用 |

### 2. 审计能力

**查询 Token 刷新历史**:
```sql
SELECT 
  id,
  refreshed_at,
  refresh_source,
  expires_at,
  TIMESTAMPDIFF(HOUR, refreshed_at, expires_at) as validity_hours
FROM auth_tokens
ORDER BY refreshed_at DESC
LIMIT 10;
```

**监控 Token 刷新频率**:
```sql
SELECT 
  DATE(refreshed_at) as date,
  refresh_source,
  COUNT(*) as refresh_count
FROM auth_tokens
GROUP BY DATE(refreshed_at), refresh_source
ORDER BY date DESC;
```

### 3. 故障排查

**检查 Token 是否过期**:
```sql
SELECT 
  access_token,
  expires_at,
  NOW() as current_time,
  CASE 
    WHEN expires_at > NOW() THEN '有效'
    ELSE '已过期'
  END as status
FROM auth_tokens;
```

**查看最近一次刷新**:
```sql
SELECT 
  refreshed_at,
  refresh_source,
  TIMESTAMPDIFF(MINUTE, refreshed_at, NOW()) as minutes_ago
FROM auth_tokens
ORDER BY refreshed_at DESC
LIMIT 1;
```

---

## 迁移步骤

### 1. 执行数据库迁移

```bash
# 执行迁移
mysql -u root -p yqad_db < src/db/migrations/035_create_auth_tokens_table.sql
```

### 2. 重启服务

```bash
npm run build
node dist/index.js
```

### 3. 验证双重存储

**查看日志**:
```
[DEBUG] Token 已保存到 Redis
[DEBUG] Token 已保存到数据库
```

**查询数据库**:
```sql
SELECT id, refreshed_at, refresh_source FROM auth_tokens LIMIT 1;
```

---

## 回滚方案

如果出现问题，可以快速回滚到只使用 Redis 的方案：

### 回滚步骤

1. **注释掉数据库保存逻辑**

```typescript
// src/services/auth.ts - persistTokenToRedis()

// 注释掉这部分：
// const { authTokenDatabaseStorage } = await import('../storage/mysql/auth-token-storage');
// const saved = await authTokenDatabaseStorage.saveToken({...});
```

2. **注释掉数据库加载逻辑**

```typescript
// src/services/auth.ts - loadStoredToken()

// 注释掉从数据库恢复的部分
```

3. **重启服务**

```bash
npm run build
node dist/index.js
```

---

## 总结

### 核心改进

| 改进点 | 之前 | 现在 |
|--------|------|------|
| **存储方式** | 仅 Redis | Redis + 数据库 |
| **持久化** | ❌ 无 | ✅ 数据库持久化 |
| **恢复能力** | ❌ Redis 故障需重新登录 | ✅ 从数据库恢复 |
| **审计能力** | ❌ 无历史记录 | ✅ 完整刷新历史 |
| **故障排查** | ❌ 无据可查 | ✅ 可查询分析 |

### 关键特性

1. ✅ **双重存储**: Redis（主）+ 数据库（备���
2. ✅ **自动同步**: Token 刷新时自动保存到两者
3. ✅ **自动恢复**: 服务启动时优先 Redis，失败时读数据库
4. ✅ **故障隔离**: 任一存储故障不影响服务
5. ✅ **审计支持**: 记录刷新历史，便于排查

---

**改进完成时间**: 2026-07-26  
**涉及文件**:
- [`src/db/migrations/035_create_auth_tokens_table.sql`](file:///Users/mac/Documents/workspace/krio/yqad/src/db/migrations/035_create_auth_tokens_table.sql)
- [`src/storage/mysql/auth-token-storage.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/storage/mysql/auth-token-storage.ts)
- [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts)
