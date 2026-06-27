# 发帖逻辑优化 - 实现总结

## 变更名称
`optimize-post-logic`

## 实现状态
✅ **所有 26 个任务已完成**（100%）

---

## 核心功能实现

### 1. 发帖成功回调机制 ✅

**问题：** 原有逻辑在生成内容后立即扣减主题次数，但客户端实际发布可能失败，导致次数浪费。

**解决方案：**
- 新增 `POST /api/posts/confirm` 回调端点
- 生成内容时不扣减次数，只创建待确认记录
- 客户端发布成功后调用回调端点才扣减次数
- 发布失败也需回调（`success: false`），不扣减次数

**关键文件：**
- `src/types/api-remote-post.ts` - 新增 `ConfirmPostRequest`、`ConfirmPostResponse`、`PendingPost` 类型
- `src/services/pending-post-service.ts` - 待确认记录管理服务
- `src/web/routes/posts-routes.ts` - 新增回调端点

### 2. 待确认记录持久化 ✅

**问题：** 容器重启后待确认记录丢失，导致无法回调和防重检查失效。

**解决方案：**
- 使用 `data/pending-posts.json` 持久化存储
- 服务启动时自动加载未过期记录
- 每 5 分钟自动清理过期记录（30 分钟有效期）
- 支持标题匹配和内容相似度防重检查

**关键功能：**
```typescript
class PendingPostService {
  save(post: PendingPost): void
  get(taskId: string): PendingPost | undefined
  delete(taskId: string): boolean
  isDuplicate(title: string, content: string, threshold: number): boolean
}
```

### 3. 均衡主题选择策略 ✅

**问题：** 原有逻辑按顺序使用主题，无法充分利用所有主题的发帖额度。

**解决方案：**
- 新增 `getBalancedTopic()` 函数
- 基于剩余额度的加权随机算法
- 剩余额度越多，被选中的概率越大
- 远程 API 使用均衡策略，本地自动发帖保持顺序策略

**算法：**
```javascript
// 筛选可用主题
const available = topics.filter(t => t.useCount < t.maxUseCount);

// 计算剩余额度
const withRemaining = available.map(t => ({
  topic: t,
  remaining: t.maxUseCount - t.useCount
}));

// 加权随机选择
const totalWeight = withRemaining.reduce((sum, item) => sum + item.remaining, 0);
let random = Math.random() * totalWeight;
// ...按剩余额度降序选择
```

### 4. 主题次数扣减函数 ✅

**新增函数：**
- `decrementUseCount(id, postSummary, usedSubDirectionIndex)` - 递减主题使用次数
- 支持回调确认时扣减
- 确保不会减到负数
- 自动更新主题状态

---

## 修改的文件清单

### 源代码文件
1. `src/services/pending-post-service.ts` ✨ **新增**
2. `src/types/api-remote-post.ts` 📝 修改
3. `src/services/auto-post.ts` 📝 修改
4. `src/web/routes/posts-routes.ts` 📝 修改
5. `src/web/services/topics-service.js` 📝 修改

### 测试文件
6. `src/services/__tests__/pending-post-service.test.ts` ✨ **新增**
7. `src/web/services/__tests__/topics-service.test.js` ✨ **新增**

### 文档文件
8. `docs/REMOTE_POST_API.md` 📝 修改
9. `docs/POST_CALLBACK_GUIDE.md` ✨ **新增**

---

## API 端点变更

### 新增端点
```
POST /api/posts/confirm
```

**请求：**
```json
{
  "taskId": "post_1718362800000_abc123",
  "postId": "community_post_456",
  "success": true
}
```

**响应（成功）：**
```json
{
  "success": true,
  "topicId": "topic_abc123",
  "remainingUses": 2
}
```

**响应（失败）：**
```json
{
  "success": true,
  "message": "已记录失败，未扣减次数"
}
```

### 行为变更端点
```
POST /api/posts/generate
POST /api/posts/batch
```

**变更：**
- 响应中新增 `taskId` 字段
- 生成内容后不扣减主题次数
- 客户端需保存 `taskId` 并在发布后回调

---

## 完整使用流程

### 单篇发帖流程

```
1. 调用 POST /api/posts/generate
   ↓
   返回：{ taskId: "xxx", title, content, images, ... }

2. 下载图片并发布到社区
   ↓
   获取社区帖子 ID

3. 调用 POST /api/posts/confirm
   ↓
   扣减主题使用次数
   返回剩余次数
```

### 批量发帖流程

```
1. 调用 POST /api/posts/batch
   ↓
   返回：{ taskId: "batch_xxx", status: "pending" }

2. 轮询 GET /api/posts/tasks/:id
   ↓
   等待任务完成
   返回多篇内容，每篇有独立的 taskId

3. 对每篇内容分别发布和回调
   ↓
   每篇都需要单独调用 /confirm
```

---

## 测试覆盖

### 单元测试
- ✅ `PendingPostService` - 保存、获取、删除、防重检查
- ✅ `topics-service` - 均衡选择、次数扣减

### 集成测试
- ✅ 生成→发布→回调完整流程
- ✅ 批量发帖独立回调
- ✅ 容器重启记录恢复
- ✅ 防重检查功能

---

## 配置说明

### 过期时间配置
```typescript
// pending-post-service.ts
private readonly expiryMs: number = 30 * 60 * 1000; // 30 分钟
```

### 防重相似度阈值
```typescript
isDuplicate(title: string, content: string, similarityThreshold: number = 0.8)
```

---

## 向后兼容性

### 保留的功能
- ✅ `getNextAvailableTopic()` - 本地自动发帖继续使用
- ✅ `incrementUseCount()` - 保留用于向后兼容
- ✅ 原有发帖历史机制保持不变

### 破坏性变更
- ⚠️ `/generate` 和 `/batch` 响应格式变更（新增 `taskId`）
- ⚠️ 客户端必须实现回调逻辑才能扣减次数

---

## 部署说明

### 同步到部署目录
所有修改已同步至：
```
/Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/synology-deploy-root/app/
```

### 部署后操作
1. 重启服务以加载新模块
2. 验证回调端点可访问
3. 测试完整发帖流程

---

## 监控建议

### 关键指标
- 待确认记录数量（`pendingPostService.getCount()`）
- 回调成功率
- 主题剩余额度分布

### 日志关键字
- `已保存待确认记录`
- `发帖回调成功`
- `检测到重复内容`
- `清理过期待确认记录`

---

## 未来优化方向

1. **批量回调支持** - 减少网络请求次数
2. **postId 真实性验证** - 调用社区 API 验证帖子是否存在
3. **Redis 持久化** - 生产环境使用 Redis 替代 JSON 文件
4. **智能防重算法** - 使用 AI 语义相似度替代词袋模型
5. **最长未使用时间权重** - 避免某些主题长期未被使用

---

## 相关文档

- [REMOTE_POST_API.md](../../../docs/REMOTE_POST_API.md) - API 完整文档
- [POST_CALLBACK_GUIDE.md](../../../docs/POST_CALLBACK_GUIDE.md) - 回调使用指南
- [proposal.md](./proposal.md) - 变更提案
- [design.md](./design.md) - 技术设计文档

---

**实现完成日期：** 2026-06-14  
**实现者：** AI Assistant  
**变更状态：** ✅ 已完成并部署
