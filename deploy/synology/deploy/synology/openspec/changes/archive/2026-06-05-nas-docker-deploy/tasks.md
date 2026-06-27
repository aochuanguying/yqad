## 1. Docker 配置更新

- [x] 1.1 在 `docker-compose.yml` 中新增独立的素材库 volume 条目：`${MATERIALS_PATH:-./data/materials}:/app/data/materials`
- [x] 1.2 在 `docker-compose.yml` 的 `environment` 中添加 `MATERIALS_PATH` 环境变量说明（注释）
- [x] 1.3 创建 `.env.example` 文件（若不存在），添加 `MATERIALS_PATH=/volume1/docker/audi-tasks/materials` 的 NAS 示例配置

## 2. 后端文件列表 API

- [x] 2.1 在 Web 服务路由中新增 `GET /api/materials/files` 端点
- [x] 2.2 实现文件扫描逻辑：读取 `materials.basePath` 目录，过滤目录项，只返回文件，最多返回 500 条
- [x] 2.3 返回结构为 `{ files: [{name, path, size, mtime}] }`，`path` 为相对路径
- [x] 2.4 素材目录为空或不存在时返回 `{ files: [] }` 而非错误

## 3. 前端文件选择器组件

- [x] 3.1 在 Web 管理界面中创建素材文件选择器弹窗组件，包含文件列表（调用 `/api/materials/files`）和多选复选框
- [x] 3.2 发帖主题配置表单中，将素材路径文本输入字段替换为「选择素材」按钮 + 已选文件展示区
- [x] 3.3 用户选择确认后，将选中文件的相对路径写入配置字段
- [x] 3.4 已选文件展示区显示文件名而非原始路径字符串，并提供清除按钮
- [x] 3.5 API 请求失败时在弹窗内显示友好错误提示，不影响整体页面

## 4. 配置存储适配

- [x] 4.1 确认发帖任务在读取素材时将相对路径与 `materials.basePath` 正确拼接（`path.join(basePath, relativePath)`）
- [x] 4.2 若现有配置中存有旧的绝对路径素材值，编写迁移提示或处理逻辑（检测绝对路径格式并告警）

## 5. 文档更新

- [x] 5.1 在 `README.md` 的 Docker 部署章节补充 `MATERIALS_PATH` 配置说明和群晖 NAS 示例路径
- [x] 5.2 更新 `docs/` 下相关部署文档，说明素材库宿主机路径映射的完整步骤
