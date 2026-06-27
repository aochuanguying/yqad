## 1. 删除签到服务

- [x] 1.1 删除 src/services/signin.ts 文件
- [x] 1.2 删除 dist/services/signin.* 编译文件

## 2. 删除 API 接口

- [x] 2.1 从 src/api/types.ts 移除 SigninResponse 接口
- [x] 2.2 从 IAudiApi 接口移除 signin 方法定义
- [x] 2.3 从 src/api/real-client.ts 移除 signin 方法实现
- [x] 2.4 从 src/api/mock-client.ts 移除 signin 方法实现

## 3. 删除调度器中的签到任务

- [x] 3.1 从 scheduler/index.ts 移除签到任务配置
- [x] 3.2 修改 createScheduler 函数签名，移除 signin handler

## 4. 更新主程序

- [x] 4.1 从 src/index.ts 移除 SigninService 导入和初始化
- [x] 4.2 移除签到相关的调度器 handler
- [x] 4.3 更新 generateDailySummary 调用

## 5. 更新每日摘要服务

- [x] 5.1 从 daily-summary.ts 移除 DailySummary 接口的 signin 字段
- [x] 5.2 修改 generateDailySummary 函数签名
- [x] 5.3 移除签到相关的告警逻辑

## 6. 更新前端界面

- [x] 6.1 从 index.html 移除签到 Tab 按钮
- [x] 6.2 从 FIELD_LABELS 移除 signin 配置项
- [x] 6.3 从 scheduler 标签移除 signin 配置

## 7. 更新配置文件

- [x] 7.1 从 config/default.yaml 移除 signin 配置块
- [x] 7.2 从 config/default.yaml 移除 scheduler.signin 配置
- [x] 7.3 从 config/local.yaml 移除 signin 配置

## 8. 验证和归档

- [ ] 8.1 运行 TypeScript 编译检查是否有残留引用
- [ ] 8.2 验证所有签到相关代码已删除
- [ ] 8.3 归档变更到 specs 目录
