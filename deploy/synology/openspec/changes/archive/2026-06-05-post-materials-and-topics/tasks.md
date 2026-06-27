## 1. 移除认证和脱敏

- [x] 1.1 移除 src/web/server.ts 中的 basicAuth 中间件引用，所有路由无需认证
- [x] 1.2 删除 src/web/middleware/auth.ts 文件
- [x] 1.3 移除 config/default.yaml 中的 web.auth 配置段
- [x] 1.4 修改 src/web/public/index.html，将所有 type=password 输入框改为 type=text
- [x] 1.5 移除前端 SENSITIVE_FIELDS 相关逻辑
- [x] 1.6 更新 AppConfig 接口，移除 web.auth 类型定义

## 2. 素材库配置与服务

- [x] 2.1 在 config/default.yaml 添加 materials.basePath 配置项（默认 ./data/materials）
- [x] 2.2 更新 AppConfig 接口添加 materials 类型定义
- [x] 2.3 创建 src/web/services/materials-service.ts，实现目录扫描和图片索引（递归扫描 jpg/jpeg/png/gif/webp）
- [x] 2.4 实现内存缓存索引和手动刷新功能
- [x] 2.5 实现路径安全校验（防止路径穿越）

## 3. 素材库 API

- [x] 3.1 创建 src/web/routes/materials-routes.ts，实现 GET /api/materials 返回素材列表
- [x] 3.2 实现 GET /api/materials?dir=xxx 按子目录筛选
- [x] 3.3 实现 GET /api/materials/file/:path 返回图片文件（设置正确 Content-Type）
- [x] 3.4 实现 POST /api/materials/refresh 手动刷新索引
- [x] 3.5 在 src/web/server.ts 中注册素材路由

## 4. 主题数据存储

- [x] 4.1 定义 Topic 接口（id, title, direction, outline, materialPaths[], status, usedAt?）
- [x] 4.2 创建 src/web/services/topics-service.ts，实现 topics.json 的读写操作
- [x] 4.3 实现主题 CRUD：创建、读取列表、更新、删除
- [x] 4.4 实现主题状态管理：标记已使用、重置单个、重置全部
- [x] 4.5 实现获取下一个可用主题（按创建时间 FIFO 顺序，返回第一个未使用的主题）

## 5. 主题管理 API

- [x] 5.1 创建 src/web/routes/topics-routes.ts，实现 GET /api/topics 返回主题列表
- [x] 5.2 实现 POST /api/topics 创建主题
- [x] 5.3 实现 PUT /api/topics/:id 更新主题
- [x] 5.4 实现 DELETE /api/topics/:id 删除主题
- [x] 5.5 实现 POST /api/topics/:id/reset 重置单个主题状态
- [x] 5.6 实现 POST /api/topics/reset-all 重置所有主题
- [x] 5.7 在 src/web/server.ts 中注册主题路由

## 6. 自动发帖流程改造

- [x] 6.1 修改 src/services/auto-post.ts，在发帖前先查询下一个可用主题
- [x] 6.2 实现基于主题的帖子生成（使用方向描述和提纲作为 AI prompt 约束）
- [x] 6.3 实现发帖时附带关联素材图片
- [x] 6.4 发帖成功后调用 topics-service 标记主题已使用
- [x] 6.5 无可用主题时回退到原有的热点自由生成模式

## 7. Web UI 扩展

- [x] 7.1 在 index.html 添加"素材库"Tab，实现网格缩略图展示
- [x] 7.2 实现素材按目录分类浏览和刷新按钮
- [x] 7.3 在 index.html 添加"发帖主题"Tab，实现主题卡片列表展示（区分已使用/未使用）
- [x] 7.4 实现新建/编辑主题表单（标题、方向、提纲、素材选择器）
- [x] 7.5 实现素材选择弹窗组件（从素材库选择图片关联到主题）
- [x] 7.6 实现主题的删除、重置和批量重置操作按钮

## 8. 测试

- [x] 8.1 为 materials-service 编写单元测试（目录扫描、路径校验）
- [x] 8.2 为 topics-service 编写单元测试（CRUD、状态管理、FIFO 选取）
- [x] 8.3 为发帖流程编写测试（主题优先、回退逻辑）
