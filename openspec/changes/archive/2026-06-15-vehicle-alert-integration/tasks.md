## 1. Telecom API 客户端实现

- [x] 1.1 创建 `src/services/telecom-client.ts` 文件
- [x] 1.2 实现 `sendSms(phoneNumber: string, message: string)` 函数，调用 Telecom API 发送短信
- [x] 1.3 实现 `makePhoneCall(phoneNumber: string)` 函数，调用 Telecom API 拨打电话
- [x] 1.4 实现 `testConnection(apiUrl: string, apiToken: string)` 函数，测试 API 连接
- [x] 1.5 添加超时处理（10 秒）和错误日志记录

## 2. 配置管理

- [x] 2.1 在 `config/default.yaml` 中添加 `telecomApi` 配置段（apiUrl、apiToken、alertPhone）
- [x] 2.2 实现配置验证逻辑，检查 apiUrl 和 apiToken 是否已配置
- [x] 2.3 实现配置热重载，支持修改后无需重启服务

## 3. 告警通知服务

- [x] 3.1 创建 `src/services/alert-service.ts` 文件
- [x] 3.2 实现 `triggerAlert(anomalies: string[])` 函数，执行短信 + 电话通知流程
- [x] 3.3 实现 5 秒短信电话间隔延迟
- [x] 3.4 实现 30 分钟告警冷却机制
- [x] 3.5 实现告警历史记录功能（内存存储，最多 100 条）
- [x] 3.6 修改 `vehicle-monitor-service.ts` 中的 `triggerAlert` 函数，调用新的告警服务

## 4. Web 配置界面

- [x] 4.1 在 `src/web/public/vehicle-monitor.html` 中添加 Telecom API 配置区域
- [x] 4.2 实现 API 地址输入框（支持 URL 格式验证）
- [x] 4.3 实现 Token 输入框（支持掩码显示）
- [x] 4.4 实现告警手机号输入框（支持 11 位手机号格式验证）
- [x] 4.5 实现"测试连接"按钮及功能
- [x] 4.6 实现配置保存功能（调用后端 API 更新配置文件）
- [x] 4.7 实现配置加载功能（页面加载时显示当前配置）

## 5. 后端 API 路由

- [x] 5.1 创建 `GET /api/telecom-config` 路由，返回当前 Telecom API 配置
- [x] 5.2 创建 `POST /api/telecom-config` 路由，保存 Telecom API 配置
- [x] 5.3 创建 `POST /api/telecom-test` 路由，测试 Telecom API 连接
- [x] 5.4 创建 `GET /api/alert-history` 路由，返回告警历史记录
- [x] 5.5 实现 Token 掩码处理（显示前 8 位和后 4 位）

## 6. 告警历史展示

- [x] 6.1 在车辆监控页面添加"告警历史"区域
- [x] 6.2 实现告警历史表格展示（时间、异常类型、通知方式、状态）
- [x] 6.3 实现告警状态可视化（成功 - 绿色、失败 - 红色、超时 - 黄色）
- [x] 6.4 实现告警统计卡片（今日告警次数、本周告警次数、最常见异常类型）

## 7. 测试与验证

- [x] 7.1 测试短信发送功能（使用真实 Android Telecom API）
- [x] 7.2 测试电话拨打功能（使用真实 Android Telecom API）
- [x] 7.3 测试配置保存和加载功能
- [x] 7.4 测试 API 连接测试功能
- [x] 7.5 测试告警冷却机制
- [x] 7.6 测试告警历史记录和展示功能
- [x] 7.7 验证异常检测触发告警的完整流程

## 8. 文档更新

- [x] 8.1 更新 `docs/VEHICLE_MONITOR_SETUP.md`，添加 Telecom API 配置说明
- [x] 8.2 在 README 中添加告警功能的快速开始指南
- [x] 8.3 创建 Android Telecom API 部署指南文档
