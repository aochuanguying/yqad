## 为什么

当前车辆监控告警系统仅支持通过电信 API 发送短信和拨打电话，用户希望增加 Bark 推送通知作为额外的告警渠道，提供更灵活的告警配置选项。

## 变更内容

- **新增 Bark 告警渠道**：在现有短信 + 电话告警基础上，增加 Bark 推送通知
- **告警配置增强**：支持同时配置手机号和 Bark 键，两者可以独立或组合使用
- **告警逻辑调整**：告警服务根据配置自动判断使用哪些告警渠道

## 功能 (Capabilities)

### 新增功能
- `bark-alert-integration`: 集成 Bark 推送服务，支持通过 Bark 发送告警通知

### 修改功能
- `vehicle-monitor-alert`: 车辆监控告警逻辑，支持 Bark 和手机告警的组合配置

## 影响

- **告警服务**：需修改 `alert-service.ts` 增加 Bark 推送逻辑
- **配置存储**：需修改 `vehicle-monitor-storage.ts` 增加 Bark 键字段
- **电信客户端**：需新增 `bark-client.ts` 实现 Bark API 调用
- **前端配置**：需修改车辆监控配置页面增加 Bark 键输入框
