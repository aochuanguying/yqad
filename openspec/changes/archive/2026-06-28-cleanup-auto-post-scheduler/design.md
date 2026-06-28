## 上下文

当前系统架构中，所有发帖动作都由外部 autojs 脚本通过远程 API 触发，服务本身只负责：
1. 接收 autojs 的调用请求
2. 执行发帖逻辑（内容生成、素材选择、合规检查等）
3. 返回帖子内容供 autojs 发布

但代码中仍保留了完整的定时发帖调度系统，包括：
- 调度器中的发帖任务注册（`src/scheduler/index.ts`）
- 发帖 handler 的创建和传递（`src/index.ts`）
- 调度配置表中的发帖相关配置（`scheduler_config` 表）

这些代码已经不再使用，需要清理。

## 目标 / 非目标

**目标：**
- 移除调度器中与发帖定时任务相关的所有代码
- 移除主入口中发帖 handler 的创建和传递
- 清理调度配置中的发帖相关配置项
- 保留所有 API 触发发帖的功能（供 autojs 远程调用）
- 保留评论、素材整理、车辆监控等其他定时任务

**非目标：**
- 修改 autojs 脚本的调用逻辑
- 修改远程发帖 API 的接口
- 影响其他定时任务（评论、素材整理等）
- 修改发帖核心业务逻辑（`AutoPostService`）

## 决策

### 1. 调度器修改范围

**决策**: 仅移除发帖定时任务注册，保留调度器框架本身

**理由**: 
- 调度器仍用于评论、素材整理、车辆监控等定时任务
- 框架本身是通用的，不应移除
- 只移除不使用的发帖任务注册代码

**实现**:
```typescript
// src/scheduler/index.ts - 移除发帖任务注册
const postCfg = schedulerConfig?.post;
if (postCfg) {
  // ❌ 移除这段代码
  scheduler.registerTask('自动发帖', postCfg.cron, ...);
}
```

### 2. 配置表处理

**决策**: 保留配置表结构，但不再使用发帖相关字段

**理由**:
- 配置表已有数据，直接删除字段可能导致兼容性问题
- 保留字段不影响功能，只是不再读取和使用
- 简化实现，避免数据库迁移复杂性

**实现**:
```typescript
// src/scheduler/index.ts - 不再读取 post 配置
const postCfg = schedulerConfig?.post;  // 不再使用
// const postMode = postCfg?.mode || 'scheduled';  // 移除
// if (postMode === 'scheduled' && postCfg) { ... }  // 移除
```

### 3. 主入口修改

**决策**: 移除发帖 handler 的创建，但保留 AutoPostService 实例

**理由**:
- AutoPostService 仍用于远程 API 调用
- 只需要移除传递给调度器的 handler
- 保持服务实例化逻辑不变

**实现**:
```typescript
// src/index.ts - 移除发帖 handler
const postService = new AutoPostService(api, authService);

const scheduler = await createScheduler({
  comment: async () => { ... },
  // ❌ 移除 post handler
  // post: async () => {
  //   todayPostResults = await postService.performDailyPosts();
  //   ...
  // },
  materialProcessing: async () => { ... },
});
```

### 4. 日志和监控

**决策**: 添加日志说明发帖定时任务已移除

**理由**:
- 便于运维人员理解系统行为
- 避免混淆为什么配置表有发帖配置但不执行

**实现**:
```typescript
logger.info('发帖模式：API 触发（定时发帖任务已移除）');
```

## 风险 / 权衡

### 风险 1: 配置表字段残留

**风险**: `scheduler_config` 表中的发帖相关字段（`post_cron`, `post_random_offset_min`, `post_random_offset_max`）将保留但不再使用

**缓解措施**: 
- 在文档中说明这些字段已废弃
- 未来可以通过数据库迁移清理
- 当前不影响功能

### 风险 2: 代码引用残留

**风险**: 可能存在其他代码引用发帖定时任务逻辑

**缓解措施**:
- 使用 IDE 全局搜索确认引用点
- 编译检查确保无引用错误
- 测试验证远程 API 功能正常

### 风险 3: 运维脚本依赖

**风险**: 可能有运维脚本或文档提到定时发帖功能

**缓解措施**:
- 更新相关文档
- 通知运维人员变更内容
- 在部署说明中强调此变更

## Open Questions

无待定决策。本次变更是清理性质，不涉及新功能或复杂架构调整。
