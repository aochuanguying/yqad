## 1. 新增发帖成功回调 API

- [x] 1.1 定义 `ConfirmPostRequest` 和 `ConfirmPostResponse` 类型接口
- [x] 1.2 实现 `PendingPostService` 服务类（持久化管理、重启恢复）
- [x] 1.3 实现 `POST /api/posts/confirm` 回调端点（包含鉴权和日志）
- [x] 1.4 实现定期清理过期记录的定时器（30 分钟过期）
- [x] 1.5 添加回调端点的单元测试（PendingPostService 测试）

## 2. 实现均衡主题选择策略

- [x] 2.1 在 `topics-service.js` 中实现 `getBalancedTopic()` 函数（加权随机算法）
- [x] 2.2 在 `topics-service.js` 中实现 `decrementUseCount()` 函数（递减次数）
- [x] 2.3 导出新增的函数
- [x] 2.4 添加均衡选择的单元测试

## 3. 调整发帖内容生成逻辑

- [x] 3.1 修改 `auto-post.ts` 的 `generatePostContent()` 方法，生成内容时不扣减次数
- [x] 3.2 在 `generatePostContent()` 中调用 `PendingPostService.save()` 持久化记录
- [x] 3.3 返回包含 `taskId` 的响应（单个和批量 API 都返回 taskId）
- [x] 3.4 修改回调端点调用 `decrementUseCount()` 扣减次数
- [x] 3.5 验证 `/generate` 端点适用新逻辑
- [x] 3.6 验证 `/batch` 端点为每篇内容创建独立记录
- [x] 3.7 添加集成测试验证完整流程（单个和批量）
- [x] 3.8 实现防重检查逻辑（标题匹配 + 内容相似度）

## 4. 启用远程 API 使用均衡策略

- [x] 4.1 修改 `auto-post.ts` 中远程 API 相关逻辑调用 `getBalancedTopic()`
- [x] 4.2 确保本地自动发帖 `performDailyPosts()` 继续使用 `getNextAvailableTopic()`
- [x] 4.3 验证两种模式互不影响

## 5. 文档与验证

- [x] 5.1 更新 `REMOTE_POST_API.md` 文档，添加回调端点说明
- [x] 5.2 编写客户端调用示例代码（见 POST_CALLBACK_GUIDE.md）
- [x] 5.3 手动测试完整流程（生成→回调→扣减）
- [x] 5.4 验证均衡策略的主题使用分布
- [x] 5.5 测试容器重启后待确认记录恢复
- [x] 5.6 测试防重检查功能（重复标题、相似内容）
