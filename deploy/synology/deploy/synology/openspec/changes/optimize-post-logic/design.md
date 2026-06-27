## 上下文

当前发帖系统采用远程 API 架构：服务端生成发帖内容，客户端调用 API 获取内容后在移动端发布。现有逻辑在服务端调用 `publishPost()` API 成功后立即扣减主题使用次数，但该 API 调用仅代表内容生成成功，客户端实际发布可能因网络、验证等原因失败。同时，主题选择采用 FIFO 顺序策略，无法均衡利用所有主题的发帖额度。

**约束条件：**
- 远程 API 使用独立的 API Token 鉴权，与登录会话分离
- 客户端可能离线或发布失败，需要支持异步回调
- 主题使用次数存储在 `data/topics.json`，需保证并发安全
- 保持向后兼容，不影响现有的自动发帖功能

## 目标 / 非目标

**目标：**
- 实现发帖成功回调机制，确保次数扣减与实际发布成功一致
- 优化主题选择策略，实现多主题均衡使用
- 支持生成内容与扣减次数解耦，允许客户端延迟确认
- 提供主题剩余额度查询接口，便于客户端决策

**非目标：**
- 不修改本地自动发帖逻辑（`auto-post.ts` 的 `performDailyPosts()`）
- 不改变精华帖评估、话题匹配等现有功能
- 不引入外部数据库，继续使用 JSON 文件存储

## 决策

### 0. 防重检查机制
**决策：** 基于持久化的发帖历史记录进行防重检查，包括待确认记录和已确认记录

**防重策略：**
- **待确认记录防重**：生成新内容时，检查 `pending-posts.json` 中是否有相同标题或内容
- **历史发帖防重**：检查 `post-history.json` 和 `topics.json` 中的历史发帖记录
- **防重时间窗口**：默认检查最近 7 天内的发帖（可配置）

**防重比对维度：**
- 标题完全匹配
- 内容相似度（基于文本相似度算法，阈值可配置）
- 同一主题的发帖间隔检查

**理由：**
- 容器重启后待确认记录恢复，防重检查依然有效
- 完整的发帖内容持久化支持精确防重
- 多维度防重避免重复内容发布

### 1. 发帖记录存储策略
**决策：** 使用**持久化文件存储**已生成未发布的帖子记录，30 分钟过期自动清理，容器重启后自动恢复

**理由：**
- 发帖记录需要支持容器重启后恢复
- 防重检查需要访问历史发帖内容（标题 + 正文）
- 持久化到文件简单可靠，无需外部数据库
- 30 分钟过期窗口足够客户端完成发布
- 启动时自动加载未过期的待确认记录

**数据结构：**
```typescript
interface PendingPost {
  taskId: string;           // 生成任务 ID
  topicId: string;          // 主题 ID
  title: string;
  content: string;
  images: ImageInfo[];
  topics?: MatchedTopic[];
  mode: PostingMode;
  createdAt: number;        // 时间戳
  subDirectionIndex?: number;
}
```

**持久化文件：** `data/pending-posts.json`

**重启恢复流程：**
1. 服务启动时读取 `pending-posts.json`
2. 过滤掉超过 30 分钟的过期记录
3. 将未过期记录加载到内存 Map
4. 后续操作与内存存储一致

### 2. 回调端点设计
**决策：** 新增 `POST /api/posts/confirm` 端点，客户端发布成功后调用

**适用范围：** 单个发帖 API（`/generate`）和批量发帖 API（`/batch`）生成的内容都使用同一个回调端点

**请求体：**
```typescript
interface ConfirmPostRequest {
  taskId: string;           // 生成时的任务 ID
  postId?: string;          // 实际发布的帖子 ID（可选）
  success: boolean;         // 发布是否成功
}
```

**响应：**
```typescript
interface ConfirmPostResponse {
  success: boolean;
  topicId?: string;         // 扣减的主题 ID
  remainingUses?: number;   // 主题剩余可用次数
  error?: string;
}
```

**理由：**
- 简单明确，客户端只需传递任务 ID 和结果
- 支持发布失败的回溯（success: false 时不扣减次数）
- 返回剩余额度便于客户端后续决策
- 单个和批量 API 统一使用同一回调机制，简化客户端实现

### 3. 均衡主题选择算法
**决策：** 基于使用次数比例的加权随机选择

**算法：**
```typescript
function selectBalancedTopic(topics: Topic[]): Topic | null {
  // 筛选可用主题（useCount < maxUseCount）
  const available = topics.filter(t => t.useCount < t.maxUseCount);
  if (available.length === 0) return null;
  
  // 计算剩余额度
  const withRemaining = available.map(t => ({
    topic: t,
    remaining: t.maxUseCount - t.useCount
  }));
  
  // 按剩余额度降序排序，优先使用剩余多的
  withRemaining.sort((a, b) => b.remaining - a.remaining);
  
  // 加权随机选择（剩余额度越多，被选中的概率越大）
  const totalWeight = withRemaining.reduce((sum, item) => sum + item.remaining, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of withRemaining) {
    random -= item.remaining;
    if (random <= 0) return item.topic;
  }
  
  return withRemaining[0].topic;
}
```

**理由：**
- 相比纯随机，优先使用剩余额度多的主题
- 相比严格顺序，保留一定随机性避免机械模式
- 实现简单，计算开销小
- 自动处理不同 maxUseCount 的场景

### 4. 次数扣减服务函数
**决策：** 在 `topics-service.js` 中新增 `decrementUseCount()` 函数

**函数签名：**
```javascript
/**
 * 递减主题使用计数（用于客户端回调确认）
 * @param {string} id - 主题 ID
 * @param {PostSummary} postSummary - 发帖摘要
 * @param {number} [usedSubDirectionIndex] - 使用的子方向索引
 * @returns {Topic|null} 更新后的主题，未找到返回 null
 */
function decrementUseCount(id, postSummary, usedSubDirectionIndex)
```

**理由：**
- 与 `incrementUseCount()` 对称，语义清晰
- 支持回调时传入发帖摘要和子方向索引
- 包含并发锁保护，保证数据一致性

### 5. 生成内容时不扣减次数
**决策：** 修改 `generatePostContent()` 方法，生成内容时不调用 `incrementUseCount()`

**适用范围：** `/generate` 和 `/batch` 端点都调用同一个 `generatePostContent()` 方法，因此自动适用同样逻辑

**实现：**
- 生成内容时记录到 `PendingPost` 内存存储
- 返回 `taskId` 给客户端
- 客户端调用 `/confirm` 端点时才扣减次数
- 如果 30 分钟内未回调，自动清理记录且不扣减次数

**理由：**
- 解耦内容生成与次数扣减
- 允许客户端发布失败后重试或放弃
- 避免次数浪费
- 单个和批量 API 行为一致，降低客户端学习成本

## 风险 / 权衡

### 风险 1：客户端不调用回调端点
**风险：** 客户端可能因 bug、离线等原因未调用回调端点，导致次数未扣减

**缓解措施：**
- 30 分钟过期自动清理，防止记录堆积
- 服务端日志监控回调率，及时发现异常
- 未来可考虑增加补偿机制（如检测到客户端在线时主动询问）

### 风险 2：内存存储丢失
**风险：** 服务端重启导致未回调记录丢失

**缓解措施：**
- 记录丢失影响有限，只是延迟扣减
- 下次客户端重启后可能重新生成
- 未来如需改进，可考虑 Redis 持久化

### 风险 3：并发回调
**风险：** 同一任务 ID 被多次回调

**缓解措施：**
- 回调后立即从内存删除记录
- 重复回调返回错误（任务不存在）
- 使用写入锁保护 `decrementUseCount()`

### 风险 4：均衡策略可能导致某些主题长期未被使用
**风险：** 加权随机仍可能使某些主题被冷落

**缓解措施：**
- 监控主题使用分布，必要时调整算法
- 可考虑增加"最长未使用时间"权重
- 当前版本先观察效果，后续优化

## 迁移计划

### 阶段 1：新增回调端点（向后兼容）
- 实现 `/api/posts/confirm` 端点
- 客户端可选择性调用
- 现有逻辑保持不变

### 阶段 2：调整生成逻辑
- 修改 `generatePostContent()` 不立即扣减次数
- 启用回调确认模式
- 客户端开始调用回调端点

### 阶段 3：启用均衡选择
- 修改 `getNextAvailableTopic()` 为 `getBalancedTopic()`
- 远程 API 使用新策略
- 本地自动发帖保持原逻辑

### 回滚策略
- 保留 `incrementUseCount()` 函数
- 配置开关控制是否启用回调确认
- 紧急情况下可快速回退到旧逻辑

## Open Questions

1. **是否需要支持批量回调？** 
   - 当前设计为单次回调，如果客户端批量发布，需多次调用
   - 后续可根据需求增加批量端点

2. **是否需要验证 postId 真实性？**
   - 当前设计信任客户端传入的 postId
   - 未来可考虑调用奥迪 API 验证帖子是否存在

3. **过期时间 30 分钟是否合适？**
   - 基于典型用户行为设定
   - 可根据实际数据调整
