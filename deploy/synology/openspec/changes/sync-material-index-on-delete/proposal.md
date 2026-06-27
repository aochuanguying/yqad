## 为什么

当前素材整理流程会为处理后素材生成 `.materials/manifest.json`、`.materials/info/**/*.json` 和 `.materials/index.json`，并且 AI 选图优先依赖索引文件进行检索。若用户删除了已经整理完成的素材文件，但索引和关联记录没有同步更新，系统会继续返回已经不存在的素材，导致素材浏览结果不准确，并可能让 AI 检索命中失效路径。与此同时，当前页面只有“整理素材”入口，缺少一个面向历史脏数据和人工删除场景的显式“重建索引”操作，用户无法主动检测并修复索引异常。

## 变更内容

- **新增**：处理后素材被删除后的索引自愈能力，确保索引、清单和 info 记录与文件系统保持一致
- **新增**：素材页“整理素材”按钮旁的“重建索引”按钮，供用户主动触发检测与修复
- **新增**：面向删除场景和历史脏数据的索引修复入口，检测素材文件、manifest、info 与索引之间的不一致并执行修正
- **修改**：素材浏览和 AI 选图读取索引时，对缺失文件进行过滤或触发修正，避免返回已删除素材
- **修改**：素材管理流程增加一致性保障与可观测日志，便于排查索引污染问题

## 功能 (Capabilities)

### 新增功能

<!-- 无新增功能 -->

### 修改功能

- `post-materials`: 补充“删除整理后素材后索引与 AI 检索结果必须同步更新”的一致性要求

## 影响

- **代码影响**：
  - `src/services/material-processing.js`
  - `src/web/services/materials-service.js`
  - `src/services/image-selector.ts`
  - `src/web/routes/materials-routes.js`
  - `src/web/public/index.html`
  - 可能新增素材删除或索引修复相关服务/路由
- **数据影响**：
  - `.materials/manifest.json`
  - `.materials/index.json`
  - `.materials/info/**/*.json`
- **行为影响**：
  - Web 素材列表不再暴露已删除素材
  - Web 页面支持手动触发“重建索引”修复异常数据
  - AI 检索和选图不再依赖已失效的索引项
