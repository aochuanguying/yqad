## 1. 核心模块实现

- [x] 1.1 创建 API Token 配置管理模块 (`src/utils/api-token.ts`)
- [x] 1.2 实现 Token 生成函数（使用 `crypto.randomBytes(32).toString('hex')`）
- [x] 1.3 实现 Token 保存函数（写入 `data/api-token.json`）
- [x] 1.4 实现 Token 读取函数（从配置文件读取）
- [x] 1.5 实现 Token 状态查询函数（返回是否已配置、创建时间等）

## 2. 鉴权中间件实现

- [x] 2.1 在 `posts-routes.ts` 中创建 `apiTokenMiddleware` 函数
- [x] 2.2 实现 Authorization 头解析逻辑
- [x] 2.3 实现 Token 验证逻辑（对比配置文件中的 Token）
- [x] 2.4 实现错误响应（401，包含清晰的错误码和消息）
- [x] 2.5 将 `/api/posts/generate` 端点的中间件从 `authMiddleware` 改为 `apiTokenMiddleware`
- [x] 2.6 将 `/api/posts/batch` 端点的中间件改为 `apiTokenMiddleware`

## 3. Web UI 管理界面

- [x] 3.1 在 Web UI 中新增"API Token"Tab 页面
- [x] 3.2 实现 Token 状态显示组件（显示是否已配置、创建时间）
- [x] 3.3 实现 Token 生成按钮和交互逻辑
- [x] 3.4 实现 Token 重置功能和确认对话框
- [x] 3.5 实现 Token 复制功能和提示
- [x] 3.6 添加 API 路由：`GET /api/config/api-token`（查询状态）
- [x] 3.7 添加 API 路由：`POST /api/config/api-token/generate`（生成/重置 Token）

## 4. 配置文件管理

- [x] 4.1 创建 `data` 目录（如果不存在）
- [x] 4.2 初始化 `data/api-token.json` 文件（首次生成时创建）
- [x] 4.3 设置文件权限为 600（仅所有者可读写）

## 5. 文档更新

- [x] 5.1 更新 `docs/REMOTE_POST_API.md`，说明新的 Token 机制
- [x] 5.2 更新 Postman 集合（`docs/postman_collection.json`）中的 Token 配置说明
- [x] 5.3 添加迁移指南，指导用户从登录 Token 切换到 API Token

## 6. 测试验证

- [ ] 6.1 编写 Token 生成和保存的单元测试（待手动完成）
- [ ] 6.2 编写 Token 验证中间件的单元测试（待手动完成）
- [ ] 6.3 编写 Token 状态查询的单元测试（待手动完成）
- [ ] 6.4 集成测试：使用有效 API Token 调用发帖 API（待手动完成）
- [ ] 6.5 集成测试：使用无效 Token 调用发帖 API（应返回 401）（待手动完成）
- [ ] 6.6 手动测试：通过 Web UI 生成和管理 Token（待手动完成）

## 7. 代码审查和清理

- [x] 7.1 代码审查：检查 Token 安全性（随机数生成、存储权限）
- [x] 7.2 代码审查：检查错误处理是否完善
- [x] 7.3 清理未使用的旧鉴权代码（可选，保留向后兼容）
- [x] 7.4 运行 TypeScript 编译检查
- [ ] 7.5 运行现有测试套件，确保无破坏性变更（待手动完成）
