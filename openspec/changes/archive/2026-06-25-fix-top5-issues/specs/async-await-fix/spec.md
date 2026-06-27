## 新增需求

### 需求:发帖完成后必须 await 每日摘要生成和告警检查

发帖任务完成后调用的 `generateDailySummary`、`checkAlerts`、`cleanOldLogs` 必须使用 `await` 等待其完成，确保异常能被正确捕获和处理。

#### 场景:发帖完成后等待每日摘要生成
- **当** 发帖任务执行完成
- **那么** 系统 await `generateDailySummary()` 完成后再继续

#### 场景:发帖完成后等待告警检查
- **当** 发帖任务执行完成
- **那么** 系统 await `checkAlerts()` 完成后再继续

#### 场景:发帖完成后等待日志清理
- **当** 发帖任务执行完成
- **那么** 系统 await `cleanOldLogs()` 完成后再继续

### 需求:AuthService 禁止在构造函数中调用异步方法

AuthService 构造函数禁止直接调用 `loadStoredToken()` 和 `setupTokenRenewal()` 等异步方法。必须通过静态工厂方法或显式的 `initialize()` 方法在构造后异步初始化。

#### 场景:通过工厂方法创建并初始化 AuthService
- **当** 系统需要创建 AuthService 实例
- **那么** 使用 `AuthService.create(api)` 静态工厂方法，该方法在返回实例前完成所有异步初始化

#### 场景:初始化失败时抛出明确错误
- **当** AuthService 异步初始化过程中发生错误
- **那么** 错误被正确传播，调用方可以捕获并处理
