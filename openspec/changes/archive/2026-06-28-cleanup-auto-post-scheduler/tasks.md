## 1. 调度器修改

- [x] 1.1 移除 `src/scheduler/index.ts` 中的发帖定时任务注册逻辑
- [x] 1.2 移除 `createScheduler` 函数中的发帖 handler 参数
- [x] 1.3 更新调度器日志，说明发帖模式为 API 触发

## 2. 主入口修改

- [x] 2.1 移除 `src/index.ts` 中发帖 handler 的创建和传递
- [x] 2.2 清理不再使用的发帖结果收集变量（`todayPostResults`）
- [x] 2.3 验证其他定时任务（评论、素材整理、车辆监控）仍正常工作

## 3. 配置存储修改

- [x] 3.1 更新 `src/storage/mysql/scheduler-config-storage.ts` 接口，标记发帖配置字段为废弃
- [x] 3.2 移除配置保存逻辑中的发帖相关字段

## 4. 验证和清理

- [x] 4.1 编译检查确保无引用错误
- [x] 4.2 全局搜索确认无遗漏的发帖定时任务引用
- [x] 4.3 验证远程发帖 API (`/api/posts/generate`) 仍正常工作
- [x] 4.4 更新相关文档说明发帖由 autojs 触发
