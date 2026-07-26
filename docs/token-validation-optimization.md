# Token 验证与自动刷新优化

## 优化概述

**优化目标**：在所有需要 Token 的场景中，增加 Token 有效性校验和自动刷新机制，确保服务稳定性。

**核心改进**：
1. ✅ 新增 `validateAndRefreshToken()` 方法
2. ✅ 自动评论服务集成 Token 验证
3. ✅ 热门话题获取集成 Token 验证
4. ✅ 会员信息查询集成 Token 验证
5. ✅ 刷新失败时明确抛出异常，终止后续操作

---

## 新增核心方法

### 1. validateAndRefreshToken()

**文件**: [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts)

**功能**: 校验 Token 有效性并在需要时自动刷新

**方法签名**:
```typescript
async validateAndRefreshToken(): Promise<string>
```

**执行流程**:
```
1. 从 Redis 同步最新 Token
   ↓
2. 检查 Token 是否存在
   ├─ 不存在 → 抛出异常："Token 不存在，请通过 Web UI 重新登录"
   ↓
3. 检查 Token 是否有效
   ├─ 有效 → 直接返回 Token
   ↓
4. Token 已过期，尝试刷新
   ├─ 刷新成功 → 返回新 Token
   └─ 刷新失败 → 抛出异常："Token 自动刷新失败，请检查 Telecom API 服务状态"
```

**日志输出**:

**场景 1: Token 有效**
```
[DEBUG] Token 有效，继续使用
```

**场景 2: Token 过期，刷新成功**
```
[WARN] Token 已过期或即将过期，开始自动刷新...
[INFO] ========================================
[INFO] 【Token 强制刷新】
[INFO]   当前 Token: eyJhbGciOiJIUzI1NiIs...
[INFO]   当前剩余时间：-2 小时
[INFO]   过期时间：2026-07-26 15:30:00
[INFO]   刷新方式：Telecom API（手机 APP 提取）
[INFO] ========================================
[INFO] 开始调用 Telecom API 获取最新 Token...
[INFO] ========================================
[INFO] 【Token 强制刷新结果 - 成功】
[INFO]   刷新接口：Telecom API (/api/v1/audi/token)
[INFO]   请求耗时：234ms
[INFO]   刷新状态：✅ 成功
[INFO]   旧 Token: eyJhbGciOiJIUzI1NiIs...
[INFO]   新 Token: eyJhbGciOiJIUzI1NiIs...
[INFO]   续期前过期时间：2026-07-26 15:30:00
[INFO]   续期后过期时间：2026-07-30 15:30:00
[INFO]   延长小时数：96.0 小时
[INFO] ========================================
[INFO] Token 自动刷新成功
```

**场景 3: Token 过期，刷新失败**
```
[WARN] Token 已过期或即将过期，开始自动刷新...
[ERROR] ========================================
[ERROR] 【Token 强制刷新结果 - 失败】
[ERROR]   刷新接口：Telecom API
[ERROR]   刷新状态：❌ 失败
[ERROR]   错误类型：Error
[ERROR]   错误信息：Telecom API 返回错误：未知错误
[ERROR] ========================================
[ERROR] Token 自动刷新失败，请检查 Telecom API 服务状态
```

---

## 集成场景

### 场景 1：自动评论服务

**文件**: [`src/services/auto-comment.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-comment.ts)

#### 单次评论

**修改前**:
```typescript
const currentToken = await this.authService.getAccessToken();
const response = await this.api.publishComment(currentToken, enrichedPost.id, generated.content, enrichedPost.contentType);
```

**修改后**:
```typescript
// 发布评论 - 使用增强的 Token 验证和刷新
let currentToken: string;
try {
  currentToken = await this.authService.validateAndRefreshToken();
} catch (error: any) {
  logger.error(`评论发布失败：Token 验证/刷新错误 - ${error.message}`);
  const postTitle = enrichedPost.title || '未知帖子';
  results.push({
    success: false,
    postId: enrichedPost.id,
    postTitle: postTitle,
    error: `Token 验证失败：${error.message}`,
  });
  return results;
}

const response = await this.api.publishComment(currentToken, enrichedPost.id, generated.content, enrichedPost.contentType);
```

**效果**:
- ✅ Token 无效时自动刷新
- ✅ 刷新失败时评论终止，返回明确错误
- ✅ 避免使用过期 Token 导致评论失败

---

#### 批量评论

**修改前**:
```typescript
const currentToken = await this.authService.getAccessToken();
const response = await this.api.publishComment(currentToken, enrichedPost.id, generated.content, enrichedPost.contentType);
```

**修改后**:
```typescript
// 发布评论 - 使用增强的 Token 验证和刷新
let currentToken: string;
try {
  currentToken = await this.authService.validateAndRefreshToken();
} catch (error: any) {
  logger.error(`批量评论失败：Token 验证/刷新错误 - ${error.message}`);
  // 将剩余帖子标记为失败
  for (let j = i; j < postsToComment.length; j++) {
    const enrichedPost = postsToComment[j];
    const postTitle = enrichedPost.title || '未知帖子';
    results.push({
      success: false,
      postId: enrichedPost.id,
      postTitle: postTitle,
      error: `Token 验证失败：${error.message}`,
    });
  }
  break;
}

const response = await this.api.publishComment(currentToken, enrichedPost.id, generated.content, enrichedPost.contentType);
```

**效果**:
- ✅ 批量评论中 Token 失效时立即刷新
- ✅ 刷新失败时停止后续评论，避免全部失败
- ✅ 已处理的评论保留，未处理的标记为失败

---

### 场景 2：热门话题获取

**文件**: [`src/services/auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts)

**修改前**:
```typescript
private async matchHotTopics(ctx: PostPipelineContext): Promise<void> {
  const token = await this.authService.getAccessToken();
  // ...
}
```

**修改后**:
```typescript
private async matchHotTopics(ctx: PostPipelineContext): Promise<void> {
  let token: string;
  
  // 使用增强的 Token 验证和刷新
  try {
    token = await this.authService.validateAndRefreshToken();
  } catch (error: any) {
    logger.warn(`话题匹配：Token 验证/刷新失败 - ${error.message}，以无话题方式继续发帖`);
    ctx.matchedTopics = [];
    return;
  }
  
  // ...
}
```

**效果**:
- ✅ Token 无效时自动刷新
- ✅ 刷新失败时降级为无话题发帖，不影响主流程
- ✅ 确保发帖流程继续进行

---

### 场景 3：会员信息查询

**文件**: [`src/web/routes/member-routes.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/web/routes/member-routes.ts)

**修改前**:
```typescript
// 检查 token 有效性
const tokenStatus = auth.getTokenStatus();
if (!tokenStatus.valid) {
  return res.status(401).json({ error: 'Token 缺失或已过期，请重新登录' });
}

const accessToken = await auth.getAccessToken();
const memberInfo = await api.getMemberInfo(accessToken);
```

**修改后**:
```typescript
// 使用增强的 Token 验证和刷新
let accessToken: string;
try {
  accessToken = await auth.validateAndRefreshToken();
} catch (error: any) {
  logger.error(`会员信息查询：Token 验证/刷新失败 - ${error.message}`);
  return res.status(401).json({ 
    error: `Token 验证失败：${error.message}`,
    code: 'TOKEN_VALIDATION_FAILED'
  });
}

const memberInfo = await api.getMemberInfo(accessToken);
```

**效果**:
- ✅ Token 无效时自动刷新
- ✅ 刷新失败时返回 401 和明确错误码
- ✅ 前端可据此提示用户重新登录

---

## 错误处理机制

### 错误类型与处理

| 错误场景 | 错误信息 | 处理方式 |
|---------|---------|---------|
| Token 不存在 | `Token 不存在，请通过 Web UI 重新登录` | 返回 401，提示重新登录 |
| Telecom API 未配置 | `手机服务 API 未配置，无法自动刷新 Token` | 返回 401，提示检查配置 |
| Telecom API 返回错误 | `Telecom API 返回错误：xxx` | 返回 401，提示检查服务状态 |
| 网络连接失败 | `ETIMEDOUT` / `ECONNREFUSED` | 返回 401，提示网络问题 |
| Token 格式错误 | `Telecom API 返回的 Token 格式不正确` | 返回 401，提示服务异常 |

### 日志级别

| 场景 | 日志级别 | 示例 |
|------|---------|------|
| Token 有效 | DEBUG | `Token 有效，继续使用` |
| Token 过期，开始刷新 | WARN | `Token 已过期或即将过期，开始自动刷新...` |
| 刷新成功 | INFO | `Token 自动刷新成功` |
| 刷新失败 | ERROR | `Token 自动刷新失败，请检查 Telecom API 服务状态` |

---

## 配置要求

### Telecom API 配置

**数据库表**: `mobile_service_config`

**必要字段**:
```sql
api_url: "http://10.6.0.2:5000"
api_token: "your_telecom_api_token"
```

**配置检查**:
- ✅ `api_url` 必须有效且可达
- ✅ `api_token` 必须正确
- ✅ 手机服务必须正常运行

---

## 监控建议

### 关键指标

1. **Token 刷新成功率**
   ```
   指标：token_refresh_success_rate
   计算：成功刷新次数 / 总刷新请求次数
   告警：< 90% 时触发
   ```

2. **Token 刷新耗时**
   ```
   指标：token_refresh_duration_ms
   计算：Telecom API 请求耗时
   告警：P95 > 5 秒时触发
   ```

3. **Token 验证失败次数**
   ```
   指标：token_validation_failures
   计算：validateAndRefreshToken() 抛出异常次数
   告警：1 小时内 > 10 次时触发
   ```

### 日志监控关键词

**成功场景**:
- `Token 自动刷新成功`
- `【Token 强制刷新结果 - 成功】`

**失败场景**:
- `Token 自动刷新失败`
- `【Token 强制刷新结果 - 失败】`
- `Token 验证失败`

---

## 测试验证

### 测试场景 1: Token 有效

```bash
# 调用会员信息查询
curl http://localhost:3000/api/member/info

# 预期输出：
# - DEBUG 日志：Token 有效，继续使用
# - 返回 200，包含会员信息
```

### 测试场景 2: Token 过期，刷新成功

```bash
# 1. 手动修改 Redis 中的 Token 过期时间
redis-cli EXPIRE auth:token 1

# 2. 调用会员信息查询
curl http://localhost:3000/api/member/info

# 预期输出：
# - WARN 日志：Token 已过期或即将过期，开始自动刷新...
# - INFO 日志：Token 自动刷新成功
# - 返回 200，包含会员信息
```

### 测试场景 3: Token 过期，刷新失败

```bash
# 1. 停止 Telecom API 服务
# 2. 调用会员信息查询
curl http://localhost:3000/api/member/info

# 预期输出：
# - WARN 日志：Token 已过期或即将过期，开始自动刷新...
# - ERROR 日志：Token 自动刷新失败，请检查 Telecom API 服务状态
# - 返回 401，包含错误信息
```

---

## 回滚方案

如果优化后出现问题，可以快速回滚到原来的逻辑：

### 回滚步骤

1. **替换 validateAndRefreshToken 为 getAccessToken**

```typescript
// 将所有的 validateAndRefreshToken() 改回 getAccessToken()
const token = await this.authService.getAccessToken();
```

2. **恢复原有的 Token 检查逻辑**

```typescript
// member-routes.ts
const tokenStatus = auth.getTokenStatus();
if (!tokenStatus.valid) {
  return res.status(401).json({ error: 'Token 缺失或已过期，请重新登录' });
}
```

3. **重启服务**

```bash
npm run build
node dist/index.js
```

---

## 总结

### 优化成果

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| **自动评论** | Token 过期导致评论失败 | 自动���新，确保评论成功 |
| **热门话题** | Token 过期导致话题获取失败 | 自动刷新，失败时降级处理 |
| **会员查询** | Token 过期返回模糊错误 | 自动刷新，返回明确错误码 |
| **错误处理** | 无统一错误处理 | 统一验证 + 刷新 + 错误抛出 |

### 核心价值

1. ✅ **自动化**: Token 过期时自动刷新，无需人工干预
2. ✅ **可靠性**: 刷新失败时明确抛出异常，避免隐性失败
3. ✅ **可维护性**: 统一的验证逻辑，便于监控和调试
4. ✅ **用户体验**: 减少因 Token 问题导致的服务中断

---

**优化完成时间**: 2026-07-26  
**涉及文件**:
- [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts)
- [`src/services/auto-comment.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-comment.ts)
- [`src/services/auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts)
- [`src/web/routes/member-routes.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/web/routes/member-routes.ts)
