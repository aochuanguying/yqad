## 为什么

当前发帖逻辑存在三个核心问题：
1) 发帖次数在 API 调用成功后立即扣减，但客户端实际发布可能失败，导致次数浪费；
2) 多主题使用时采用顺序策略而非均衡使用，无法充分利用所有主题的发帖额度；
3) 缺少容器重启后的待确认记录恢复机制，且防重检查依赖的发帖内容持久化不够完善。

## 变更内容

- **新增发帖成功回调 API**：客户端调用远程 API 生成内容后，在实际发布成功时回调服务端扣减主题使用次数
- **优化主题选择策略**：从顺序使用改为基于使用次数的加权均衡选择，优先使用使用次数少的主题
- **调整次数扣减时机**：从"生成内容后扣减"改为"客户端回调确认发布成功后扣减"
- **持久化待确认记录**：将待确认发帖记录持久化到文件，支持容器重启后恢复和防重检查
- **适用范围**：单个发帖 API（`/generate`）和批量发帖 API（`/batch`）均适用同样的优化逻辑

## 功能 (Capabilities)

### 新增功能
- `post-callback-api`: 新增客户端发帖成功回调端点，支持客户端在发布成功后调用以扣减主题使用次数
- `balanced-topic-selection`: 基于使用次数的加权均衡主题选择策略，优先使用剩余额度多的主题
- `pending-post-persistence`: 待确认发帖记录的持久化存储，支持容器重启恢复和防重检查

### 修改功能
- `remote-post-api`: 远程发帖 API 的行为变更 - 从生成即扣减次数改为回调确认后才扣减次数

## 影响

- **代码影响**：
  - `src/web/routes/posts-routes.ts`：新增回调端点，修改 `/generate` 和 `/batch` 端点逻辑
  - `src/web/services/topics-service.js`：新增扣减次数函数，修改主题选择逻辑
  - `src/services/auto-post.ts`：调整 `generatePostContent()` 方法，支持回调确认模式和持久化
  - **新增服务模块**：`src/services/pending-post-service.ts` - 待确认记录的持久化管理
- **API 影响**：
  - 新增 `POST /api/posts/confirm` 端点（需 API Token 鉴权）
  - `/api/posts/generate` 和 `/api/posts/batch` 的行为变更：生成后不扣减次数，等待回调
  - 远程客户端需要在发布成功后调用回调端点
- **数据影响**：
  - `data/topics.json`：主题使用次数的扣减时机延后
  - `data/pending-posts.json`：**新增**待确认发帖记录持久化文件（包含完整内容用于防重）
  - `data/post-history.json`：继续保留全局发帖历史记录
  - 容器重启后自动恢复待确认记录，确保防重检查的连续性
