## 1. 后端 API 实现

- [x] 1.1 创建 `src/web/routes/comment-routes.ts` 文件
- [x] 1.2 实现 `POST /api/comment/execute` 端点：同步执行评论任务，返回成功/失败结果
- [x] 1.3 在 `src/web/server.ts` 中注册新的路由（使用 API Token 鉴权）

## 2. 服务层改造

- [x] 2.1 修改 `AutoCommentService.performDailyComments()` 为 public 方法（已为 public，无需修改）

## 3. 前端 UI 实现

- [x] 3.1 在 `src/web/public/index.html` 评论 Tab 的保存按钮左侧添加"立即评论"按钮
- [x] 3.2 实现按钮点击事件：调用 API，显示 Toast 提示（执行中、成功、失败）
- [x] 3.3 按钮执行中禁用，防止重复点击
