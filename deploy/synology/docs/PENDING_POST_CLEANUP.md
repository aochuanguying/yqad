# 待确认帖子清理时级联更新日志状态

## 问题描述

当手工发帖通过 AutoJS API 远程执行脚本后，如果 AutoJS 脚本执行异常（如崩溃、网络问题等），不会调用回调 API，导致发帖日志一直处于 `pending` 状态，无法反映真实的发帖结果。

## 解决方案

在待确认帖子（Pending Post）服务清理过期记录时，**级联更新**对应的发帖日志状态为 `failed`，确保日志状态与实际情况一致。

## 实现细节

### 1. 待确认帖子服务修改

**文件**: `src/services/pending-post-service.ts`

**修改内容**:
- 导入 `postLoggingService`
- 在 `cleanupExpired()` 方法中，删除过期待确认记录前，先查找对应的日志记录
- 如果日志存在且状态为 `pending`，则将其更新为 `failed`，并设置错误信息

**关键代码**:
```typescript
private cleanupExpired(): void {
  const now = Date.now();
  let cleaned = 0;
  let logsUpdated = 0;

  for (const [taskId, record] of this.pendingPosts.entries()) {
    if (now - record.createdAt >= this.expiryMs) {
      // 级联更新：将对应的日志记录标记为失败
      try {
        const log = postLoggingService.findByTaskId(taskId);
        if (log && log.status === 'pending') {
          log.status = 'failed';
          log.errorMessage = '发帖任务超时未确认（AutoJS 脚本可能执行异常或未调用回调 API）';
          postLoggingService.update(log);
          logsUpdated++;
          logger.warn(`级联更新日志状态为失败：${taskId} (${log.title})`);
        }
      } catch (error: any) {
        logger.error(`更新日志状态失败：${taskId}, ${error.message}`);
      }
      
      // 删除待确认记录
      this.pendingPosts.delete(taskId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`清理 ${cleaned} 条过期待确认记录，级联更新 ${logsUpdated} 条日志状态`);
    this.saveToDisk();
  }
}
```

### 2. 发帖日志服务修改

**文件**: `src/services/post-logging-service.ts`

**修改内容**:
- 添加 `findByTaskId(taskId: string)` 方法：根据任务 ID 查找日志记录
- 添加 `update(log: PostLog)` 方法：更新日志记录

**关键代码**:
```typescript
/**
 * 根据 ID 查找日志
 * @param taskId 任务 ID（taskId 字段）
 * @returns 日志记录，不存在返回 null
 */
findByTaskId(taskId: string): PostLog | null {
  const log = this.logs.find(l => l.taskId === taskId);
  return log || null;
}

/**
 * 更新日志记录
 * @param log 更新后的日志记录
 */
update(log: PostLog): void {
  const index = this.logs.findIndex(l => l.id === log.id);
  if (index !== -1) {
    this.logs[index] = log;
    logger.debug(`更新日志记录：${log.id}`);
    
    // 异步保存
    setImmediate(() => {
      this.saveToDisk();
    });
  } else {
    logger.warn(`更新失败：日志记录不存在 - ${log.id}`);
  }
}
```

### 3. 类型定义修改

**文件**: `src/types/post-logging.ts`

**修改内容**:
- 添加 `pending` 状态到 `PostLog.status` 字段

```typescript
export interface PostLog {
  // ...
  status: 'success' | 'failed' | 'pending';  // 发帖状态（pending=等待回调）
  // ...
}
```

## 工作流程

```
1. 用户点击"立即发帖"
   ↓
2. 调用 AutoJS API 执行脚本（异步）
   ↓
3. 创建日志记录，状态为 `pending`
   ↓
4. 等待 AutoJS 脚本回调（30 分钟内）
   │
   ├─→ 回调成功 → 更新状态为 `success`
   │
   └─→ 超时未回调 → 待确认记录过期清理
                      ↓
                   级联更新日志状态为 `failed`
```

## 配置参数

### 待确认记录过期时间

**位置**: `src/services/pending-post-service.ts`

```typescript
private readonly expiryMs: number = 30 * 60 * 1000; // 30 分钟
```

**说明**: 待确认记录会在 30 分钟后过期并被清理，同时触发日志状态更新。

### 清理定时器

**位置**: `src/services/pending-post-service.ts`

```typescript
private startCleanupTimer(): void {
  // 每 5 分钟清理一次过期记录
  setInterval(() => {
    this.cleanupExpired();
  }, 5 * 60 * 1000);
}
```

**说明**: 每 5 分钟检查一次，清理过期的待确认记录并级联更新日志。

## 日志示例

### 正常回调成功
```
[INFO] 收到 AutoJS 脚本发帖回调请求
[INFO] AutoJS 回调发帖成功：我的奥迪 Q5L 使用体验
[DEBUG] 更新日志记录：xxx-xxx-xxx
```

### 超时未回调（级联更新）
```
[INFO] 清理 1 条过期待确认记录，级联更新 1 条日志状态
[WARN] 级联更新日志状态为失败：autojs_1234567890 (远程脚本执行：audi_post.js)
[DEBUG] 更新日志记录：xxx-xxx-xxx
```

## 优势

1. **自动化**: 无需手动干预，系统自动处理异常情况
2. **状态一致**: 确保日志状态与实际情况一致
3. **可追溯**: 错误信息明确指出是"AutoJS 脚本可能执行异常或未调用回调 API"
4. **性能优化**: 每 5 分钟批量清理，避免频繁 IO 操作
5. **容错性强**: 即使日志更新失败，也不影响待确认记录的清理

## 测试方法

### 1. 查看 pending 状态的日志
```bash
# 查询所有 pending 状态的日志
curl http://localhost:3000/api/posts/logs?triggerType=manual
```

### 2. 模拟超时场景
1. 手工发帖（不调用回调 API）
2. 等待 30 分钟
3. 查看日志状态是否变为 `failed`

### 3. 查看服务日志
```bash
# 查看待确认帖子服务日志
tail -f logs/app.log | grep pending-post-service

# 查看发帖日志服务日志
tail -f logs/app.log | grep post-logging-service
```

## 相关文件

- `src/services/pending-post-service.ts`: 待确认帖子服务（主修改）
- `src/services/post-logging-service.ts`: 发帖日志服务（新增方法）
- `src/types/post-logging.ts`: 类型定义（添加 pending 状态）
- `src/web/routes/posts-routes.ts`: 路由（AutoJS 回调接口）
- `docs/AUTOJS_API_USAGE.md`: AutoJS API 使用说明
- `docs/PENDING_POST_CLEANUP.md`: 本文档

## 注意事项

1. **不要删除级联更新逻辑**: 这是确保日志状态一致性的关键
2. **错误信息要明确**: 必须说明是 AutoJS 脚本执行异常或未调用回调
3. **异步保存**: 日志更新使用异步保存，不影响主流程
4. **异常处理**: 即使日志更新失败，也要继续删除待确认记录
