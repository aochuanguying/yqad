# 间隔调度器规范

## 目标

为素材整理任务提供基于固定间隔的调度机制，替代原有的 Cron + 随机偏移模式，使配置更简单直观。

## 新增需求

### 需求 1：配置参数

**描述：** 新增 `intervalMinutes` 配置参数，单位为分钟。

#### 场景：配置执行间隔

**给定** 用户需要配置素材整理任务的执行频率
**当** 用户在配置文件中设置 `intervalMinutes` 时
**那么** 系统按照设定的间隔执行素材整理任务

**验收标准：**
- `intervalMinutes` 必须是正整数
- 最小值为 5 分钟（防止资源占用过高）
- 最大值为 1440 分钟（24 小时）
- 默认值为 30 分钟
- 配置变更需要重启后生效（或热重载）

### 需求 2：启动时立即执行

**描述：** 应用启动时立即执行一次素材整理，然后按间隔执行。

#### 场景：应用启动

**给定** 应用已完成初始化
**当** 调度器启动时
**那么** 立即执行一次素材整理任务

**验收标准：**
- 启动后 5 秒内执行第一次素材整理
- 执行完成后开始���时间隔
- 日志中明确记录"启动时立即执行"
- 如果启动时执行失败，不影响间隔调度

### 需求 3：固定间隔执行

**描述：** 使用 `setInterval` 实现固定间隔执行。

#### 场景：间隔执行

**给定** 素材整理任务已完成
**当** 达到设定的间隔时间时
**那么** 再次执行素材整理任务

**验收标准：**
- 间隔时间 = `intervalMinutes * 60 * 1000` 毫秒
- 使用 `setInterval` 定时器
- 每次执行前检查是否有任务正在运行（防重入）
- 记录每次执行的时间和结果

### 需求 4：配置迁移

**描述：** 自动迁移旧配置格式到新格式。

#### 场景：旧配置迁移

**给定** 配置文件使用旧的 `randomOffsetMin/Max` 格式
**当** 应用启动时
**那么** 自动迁移为新的 `intervalMinutes` 格式

**验收标准：**
- 检测到 `randomOffsetMax` 字段时触发迁移
- 默认设置 `intervalMinutes: 30`
- 在日志中记录迁移信息
- 保留旧字段但不使用（向后兼容）

### 需求 5：停止机制

**描述：** 调度器停止时清除定时器。

#### 场景：应用关闭

**给定** 应用收到退出信号
**当** 调度器停止时
**那么** 清除所有间隔定时器

**验收标准：**
- 调用 `clearInterval()` 清除定时器
- 防止内存泄漏
- 防止重复执行
- 日志中记录"调度器已停止"

### 需求 6:Web 配置界面

**描述：** 在 Web 管理界面中添加间隔时间配置模块。

#### 场景：配置间隔时间

**给定** 用户需要修改素材整理任务的执行间隔
**当** 用户访问 Web 管理界面的配置页面时
**那么** 可以看到并修改执行间隔配置

**验收标准：**
- 显示"执行间隔（分钟）"数字输入框
- 最小值为 5，最大值为 1440
- 默认值为 30
- 提供快速选择按钮（5, 10, 15, 30, 60 分钟）
- 点击"保存配置"后实时更新
- 显示当前配置值和上次执行时间

#### 场景：保存配置

**给定** 用户修改了执行间隔
**当** 用户点击"保存配置"按钮时
**那么** 配置立即生效并触发调度器热重载

**验收标准：**
- 验证输入值在 5-1440 范围内
- 保存到配置文件
- 触发热重载（无需重启应用）
- 显示成功提示消息
- 日志中记录配置变更信息

## 修改需求

### 修改 1：配置结构

**描述：** 修改 `scheduler.materialProcessing` 的配置结构。

**旧格式：**
```yaml
scheduler:
  materialProcessing:
    cron: "0 7 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 30
```

**新格式：**
```yaml
scheduler:
  materialProcessing:
    intervalMinutes: 30
    enabled: true
```

**变更说明：**
- 移除 `cron` 字段（不再使用）
- 移除 `randomOffsetMin` 和 `randomOffsetMax` 字段
- 新增 `intervalMinutes` 字段
- 新增 `enabled` 字段（可选，默认 true）

### 修改 2：配置验证

**描述：** 更新配置验证规则。

**旧验证：**
- `cron`: 必须是有效的 Cron 表达式
- `randomOffsetMin`: 必须 >= 0
- `randomOffsetMax`: 必须 >= randomOffsetMin

**新验证：**
- `intervalMinutes`: 必须是 5-1440 之间的整数
- `enabled`: 必须是布尔值（可选）

### 修改 3：Web 界面

**描述：** 更新 Web 配置页面的表单字段。

**旧表单：**
- Cron 表达式输入框
- 最小偏移（分钟）数字输入
- 最大偏移（分钟）数字��入

**新表单：**
- 执行间隔（分钟）数字输入
- 启用/禁用复选框
- 推荐值提示（5, 10, 15, 30, 60 分钟）

## 技术约束

### 约束 1：最小间隔

- 最小间隔必须 >= 5 分钟
- 防止频繁执行导致资源占用
- 在配置验证和 Web 界面中强制执行

### 约束 2：定时器精度

- 使用 `setInterval`，不保证毫秒级精度
- 允许 ±1 秒的误差
- 不使用递归 `setTimeout`（增加复杂度）

### 约束 3：防重入

- 必须检查 `running` 标志
- 如果任务正在运行，跳过本次执行
- 记录"任务正在运行，跳过本次执行"日志

### 约束 4：日志记录

必须记录以下日志：
- 启动时立即执行
- 每次执行开始和结束
- 跳过的执行（如果触发防重入）
- 配置迁移信息

## 验收测试

### 测试 1：启动时立即执行

```typescript
// 启动应用
const app = await startApp();

// 验证：5 秒内执行了第一次
const logs = await getLogs('material-processing');
assert(logs[0].timestamp < 5000);
assert(logs[0].message.includes('启动时立即执行'));
```

### 测试 2：固定间隔执行

```typescript
// 配置间隔为 5 分钟
config.scheduler.materialProcessing.intervalMinutes = 5;

// 启动应用
await startApp();

// 等待 6 分钟
await sleep(6 * 60 * 1000);

// 验证：执行了 2 次（启动时 1 次 + 间隔 1 次）
const logs = await getLogs('material-processing');
assert(logs.filter(l => l.message.includes('执行完成')).length >= 2);
```

### 测试 3：配置迁移

```typescript
// 旧配置
const oldConfig = {
  scheduler: {
    materialProcessing: {
      cron: '0 7 * * *',
      randomOffsetMin: 0,
      randomOffsetMax: 30
    }
  }
};

// 迁移后
const newConfig = migrateConfig(oldConfig);
assert(newConfig.scheduler.materialProcessing.intervalMinutes === 30);
```

### 测试 4：防重入

```typescript
// 模拟长时间运行的任务
const originalHandler = handlers.materialProcessing;
handlers.materialProcessing = async () => {
  await sleep(10 * 60 * 1000); // 运行 10 分钟
};

// 配置间隔为 1 分钟
config.intervalMinutes = 1;

// 启动应用
await startApp();

// 等待 5 分钟
await sleep(5 * 60 * 1000);

// 验证：只执行了 1 次（因为第一次还在运行）
const logs = await getLogs('material-processing');
assert(logs.filter(l => l.message.includes('开始执行')).length === 1);
assert(logs.some(l => l.message.includes('跳过本次执行')));
```

### 测试 5：停止机制

```typescript
// 启动应用
const app = await startApp();

// 停止应用
await app.stop();

// 验证：定时器已清除
// 等待 10 分钟，不应该有新的执行
await sleep(10 * 60 * 1000);
const logs = await getLogs('material-processing');
const lastExecution = logs[logs.length - 1].timestamp;
assert(Date.now() - lastExecution > 10 * 60 * 1000);
```

## 依赖

- Node.js 18+（`setInterval` API）
- 现有调度器框架
- 现有日志系统

## 参考资料

- [Node.js setInterval 文档](https://nodejs.org/api/timers.html#setintervalcallback-delay-args)
- [现有调度器代码](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000%20Workspace/yqad/src/scheduler/index.ts)
