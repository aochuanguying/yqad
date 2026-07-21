## 1. 数据库迁移

- [x] 1.1 在 vehicle_monitor_config 表添加 bark_key 字段（VARCHAR(255)，默认''）
- [x] 1.2 在 vehicle_monitor_config 表添加 bark_server 字段（VARCHAR(255)，默认''）
- [x] 1.3 更新 vehicle-monitor-storage.ts 的 VehicleMonitorConfig 接口
- [x] 1.4 更新 getConfig 和 saveConfig 方法支持新字段
- [x] 1.5 更新默认配置插入语句

## 2. Bark 客户端实现

- [x] 2.1 创建 src/services/bark-client.ts 文件
- [x] 2.2 实现 BarkClient 类，包含 sendPush 方法
- [x] 2.3 实现 Bark 配置接口（barkKey, barkServer）
- [x] 2.4 实现 sendPush 方法，调用 Bark API 发送推送
- [x] 2.5 实现 testConnection 方法用于测试连接
- [x] 2.6 实现 handleAxiosError 错误处理方法
- [x] 2.7 导出单例 barkClient

## 3. 告警服务集成

- [x] 3.1 在 alert-service.ts 中导入 barkClient
- [x] 3.2 修改 TriggerAlertResult 接口，增加 barkResult 字段
- [x] 3.3 修改 triggerAlert 方法，增加 Bark 推送逻辑
- [x] 3.4 实现 buildBarkContent 方法构造 Bark 消息
- [x] 3.5 使用 Promise.allSettled 并行执行手机告警和 Bark 告警
- [x] 3.6 修改 recordAlert 方法，增加 Bark 状态记录
- [x] 3.7 修改 AlertRecord 接口，增加 barkStatus 字段

## 4. 配置管理

- [x] 4.1 更新 mobile-service-config-storage.ts（如需要）
- [x] 4.2 确保配置热重载支持 Bark 配置

## 5. 测试验证

- [x] 5.1 测试仅配置 Bark 键时的告警
- [x] 5.2 测试仅配置手机号时的告警
- [x] 5.3 测试同时配置手机号和 Bark 键
- [x] 5.4 测试两者均为空时的跳过逻辑
- [x] 5.5 测试 Bark 推送失败不影响手机告警
- [x] 5.6 测试告警冷却机制仍然有效
