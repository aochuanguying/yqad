## 上下文

当前素材整理任务使用 Cron 表达式（`0 7 * * *`）配合随机偏移（0-30 分钟）的调度方式。这种方式存在以下问题：

1. **配置不直观**：用户需要理解 Cron 表达式和随机偏移的概念
2. **执行时间不确定**：无法精确预测具体执行时间
3. **灵活性差**：无法实现"每隔 X 分钟执行一次"的需求

**现状：**
- 其他任务（评论、发帖）仍需要 Cron 定时调度
- 仅素材整理任务改为间隔执行模式
- 需要保持向后兼容，支持旧配置格式

**约束条件：**
- 不能影响其他任务的调度逻辑
- 需要提供配置迁移方案
- 需要更新 Web 界面配置表单

## 目标 / 非目标

**目标：**
- 将素材整理任务的调度方式改为固定间隔执行
- 提供简单直观的配置参数（`intervalMinutes`）
- 移除随机偏移相关代码
- 更新配置验证和 Web 界面
- **在 Web 管理界面中添加间隔时间配置表单**，支持实时调整和保存

**非目标：**
- 不改变其他任务（评论、发帖、签到）的调度方式
- 不引入复杂的动态调整机制
- ~~不支持运行时动态修改间隔~~ → 支持通过 Web 界面热重载

## 决策

### 决策 1：配置结构设计

**选择：** 使用独立的 `intervalMinutes` 字段替代 Cron + 偏移

```yaml
scheduler:
  materialProcessing:
    intervalMinutes: 30    # 每隔 30 分钟执行一次
    enabled: true          # 是否启用
```

**理由：**
- 简单直观，用户一看就懂
- 无需理解 Cron 表达式
- 易于验证和调试

**替代方案：**
- 保留 Cron 但移除偏移：仍然不够直观
- 使用人类可读格式（如"every 30 minutes"）：需要额外的解析逻辑

**最终决定：** 使用 `intervalMinutes` 数字字段，单位明确（分钟）。

### 决策 2：调度器实现

**选择：** 使用 `setInterval` 实现固定间隔执行

```typescript
// 启动时间执行
const intervalMs = config.intervalMinutes * 60 * 1000;
this.materialInterval = setInterval(async () => {
  await handlers.materialProcessing();
}, intervalMs);
```

**理由：**
- Node.js 原生 API，无需额外依赖
- 简单可靠，易于维护
- 适合固定间隔场景

**替代方案：**
- 使用 `node-cron` 的 `*/30 * * * *` 语法：仍然依赖 Cron，不够直观
- 使用递归 `setTimeout`：代码复杂度更高

**最终决定：** 使用 `setInterval`，代码简洁明了。

### 决策 3：启动时机

**选择：** 应用启动时立即执行一次，然后按间隔执行

```typescript
// 启动时立即执行
await handlers.materialProcessing();
// 然后设置间隔
setInterval(...);
```

**理由：**
- 用户可以立即看到效果
- 避免长时间等待第一次执行
- 符合用户直觉

**替代方案：**
- 等待一个间隔后再执行第一次：用户需要等待
- 可配置的延迟启动：增加复杂度

**最终决定：** 启动时立即执行一次。

### 决策 4：配置迁移

**选择：** 自动迁移旧配置到新格式

```typescript
// 迁移逻辑
if (oldConfig.randomOffsetMax !== undefined) {
  // 估算间隔 = Cron 小时 * 60 + 平均偏移
  newConfig.intervalMinutes = 30; // 默认值
}
```

**理由：**
- 用户无需手动修改配置
- 平滑过渡，减少抱怨
- 提供合理的默认值

**替代方案：**
- 不迁移，让用户手动修改：体验差
- 同时支持两种格式：代码复杂，维护成本高

**最终决定：** 自动迁移，提供默认值 30 分钟。

### 决策 5：停止机制

**选择：** 调度器停止时清除间隔定时器

```typescript
stop(): void {
  if (this.materialInterval) {
    clearInterval(this.materialInterval);
  }
  // ...其他清理逻辑
}
```

**理由：**
- 防止内存泄漏
- 避免重复执行
- 符合现有代码风格

### 决策 6:Web 配置界面

**选择：** 在现有 Web 管理界面中添加独立的间隔时间配置模块

```typescript
// Web 界面表单结构
<div class="config-section">
  <h3>素材整理调度</h3>
  <label>执行间隔（分钟）</label>
  <input type="number" 
         id="intervalMinutes" 
         min="5" 
         max="1440" 
         value="30" />
  <div class="quick-select">
    <button onclick="setInterval(5)">5 分钟</button>
    <button onclick="setInterval(10)">10 分钟</button>
    <button onclick="setInterval(30)">30 分钟</button>
    <button onclick="setInterval(60)">60 分钟</button>
  </div>
  <button onclick="saveConfig()">保存配置</button>
</div>
```

**理由：**
- 用户无需手动编辑 YAML 配置文件
- 提供快速选择按钮，降低输入错误
- 支持实时保存和热重载，无需重启应用
- 符合现有 Web 界面的设计模式

**替代方案：**
- 仅提供配置文件编辑：用户体验差
- 使用第三方配置管理工具：增加依赖和复杂度

**最终决定：** 在现有 Web 管理界面中嵌入间隔时间配置模块。

## 风险 / 权衡

### 风险 1：间隔过短导致资源占用

**风险：** 用户可能设置过短的间隔（如 1 分钟），导致系统资源占用过高。

**缓解措施：**
- 在配置验证中设置最小值（如 5 分钟）
- 在 Web 界面提供推荐值提示
- 在日志中记录实际间隔，便于排查问题

### 风险 2：与现有任务冲突

**风险：** 固定间隔可能与其他定时任务执行时间冲突。

**缓解措施：**
- 素材处理本身是轻量级任务
- 已有防重入机制（`running` 标志）
- 可以在文档中说明建议间隔

### 风险 3：配置迁移不完整

**风险：** 旧配置迁移后用户发现行为不一致。

**缓解措施：**
- 提供明确的迁移日志
- 在 Web 界面显示当前配置
- 提供回滚方案（保留旧配置字段）

### 权衡：灵活性 vs 简单性

**权衡：** 固定间隔失去了 Cron 的灵活性（如仅在特定时间段执行）。

**决定：** 优先简单性，因为素材整理需要频繁执行，固定间隔更符合需求。如需要复杂调度，用户可以改回 Cron 配置。

## 迁移计划

### 配置迁移步骤

1. **读取旧配置**：检查是否存在 `randomOffsetMin/Max`
2. **计算新值**：使用默认值 30 分钟，或根据旧配置估算
3. **更新配置对象**：添加 `intervalMinutes` 字段
4. **记录迁移日志**：提示用户配置已自动迁移
5. **保存新配置**：可选，建议用户手动确认

### 代码迁移步骤

1. 修改 `src/scheduler/index.ts`：添加间隔调度逻辑
2. 修改 `config/default.yaml`：更新默认配置
3. 修改 `src/web/services/config-validator.ts`：更新验证规则
4. 修改 Web 界面表单：替换偏移字段为间隔字段
5. 测试验证：确保新旧配置都能正常工作

### 回滚策略

如遇到问题，可以快速回滚：

```yaml
# 回滚到旧配置格式
scheduler:
  materialProcessing:
    cron: "0 7 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 30
    intervalMinutes: 30  # 忽略此字段
```

代码中保留对旧字段的兼容性，但优先使用新字段。

## Open Questions

无。此设计已覆盖所有关键技术决策。
