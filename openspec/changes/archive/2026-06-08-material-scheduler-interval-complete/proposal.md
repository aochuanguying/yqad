## 为什么

当前素材整理任务使用"Cron 表达式 + 随机偏移"的调度方式，用户难以直观理解实际执行时间，也无法精确控制执行间隔。改为"固定间隔执行"模式后，用户可以更直观地配置"每隔 X 分钟执行一次"。**通过将间隔时间作为 Web 页面配置项**，用户无需手动编辑配置文件，即可在浏览器中实时调整和保存执行间隔，降低配置复杂度，提高可预测性和易用性。

## 变更内容

- **移除随机偏移逻辑**：删除 `randomOffsetMin` 和 `randomOffsetMax` 参数及其相关代码
- **新增间隔执行模式**：使用 `intervalMinutes` 参数配置执行间隔
- **修改调度器实现**：从 Cron 定时改为固定间隔执行（使用 `setInterval`）
- **更新配置结构**：简化素材整理任务的调度配置
- **新增 Web 配置界面**：在 Web 管理页面中添加间隔时间配置表单，支持实时保存和热重载

**BREAKING**: 配置文件中的 `scheduler.materialProcessing.randomOffsetMin` 和 `randomOffsetMax` 字段将被移除，替换为 `intervalMinutes` 字段。

## 功能 (Capabilities)

### 新增功能

- `interval-scheduler`: 新增基于固定间隔的调度器实现，支持配置执行间隔（分钟）。
- `web-interval-config`: 在 Web 管理界面中添加间隔时间配置页面，支持实时调整和保存。

### 修改功能

- `scheduler`: 修改素材整理任务的调度方式，从 Cron 定时改为固定间隔执行。
- `config-api`: 扩展配置 API，支持间隔时间配置的读取和保存。

## 影响

- **配置文件变更**：需要更新 `config/default.yaml` 和 `config/local.yaml` 中的素材整理调度配置
- **调度器代码**：需要修改 `src/scheduler/index.ts` 中的素材整理任务注册逻辑
- **Web 界面**：需要更新配置页面的表单字段和说明文字，添加间隔时间输入框
- **配置验证**：需要更新 `src/web/services/config-validator.ts` 中的验证规则
- **配置 API**：需要更新配置读取和保存接口，支持 `intervalMinutes` 字段
- **向后兼容**：旧配置文件中的 `randomOffsetMin/Max` 字段需要迁移或忽略
