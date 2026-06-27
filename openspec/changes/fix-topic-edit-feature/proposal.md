## 为什么

Web 管理界面的发帖主题功能中，主题创建后无法再次编辑，只能删除或重置。用户在主题信息需要调整时（如修改标题、方向、提纲、素材或复用次数），必须删除后重新创建，导致使用计数和历史记录丢失，操作繁琐且容易出错。

## 变更内容

- **新增主题编辑功能**：在主题卡片上添加编辑按钮（✏️），点击后打开编辑表单
- **支持全字段编辑**：可修改标题、方向描述、内容提纲、最大复用次数、关联素材
- **后端 API 增强**：PUT /api/topics/:id 接口现在支持更新 maxUseCount 字段
- **前端编辑表单**：新增编辑表单组件，支持素材选择器集成
- **单元测试覆盖**：新增 service 层和 routes 层测试，验证编辑功能的所有场景

## 功能 (Capabilities)

### 新增功能
- `topic-edit-ui`: 前端编辑主题的用户界面，包括编辑按钮、表单、素材选择器
- `topic-edit-api`: 后端 PUT /api/topics/:id 接口支持更新所有主题字段

### 修改功能
- 无（纯新增功能，不修改现有规范）

## 影响

- **前端代码**：`src/web/public/index.html` - 新增编辑函数和按钮
- **后端路由**：`src/web/routes/topics-routes.ts` - PUT 接口增加 maxUseCount 参数支持
- **测试代码**：新增 `tests/topics-service.test.ts` 测试用例、`tests/topics-routes-edit.test.ts` 路由测试
- **API 兼容性**：向后兼容，现有 API 调用不受影响
