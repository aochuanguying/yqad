## 为什么

目前车辆监控系统的报警功能仅停留在日志记录层面，当检测到车辆异常（如车窗未关、车辆移动、安全距离超标等）时，无法及时通知用户。需要集成 Android Telecom API，实现短信 + 电话的双重报警机制，确保用户能够第一时间获知车辆异常情况。

## 变更内容

**新增功能：**

1. **Android Telecom API 集成** - 实现与 Android Telecom API 的对接，支持发送短信和拨打电话
2. **告警通知配置界面** - 在 Web 管理界面中添加 API 地址和 Token 的配置功能
3. **短信 + 电话双重报警** - 异常发生时先发送短信，再拨打电话，确保通知到位
4. **告警历史记录** - 记录每次告警的时间、类型、通知方式和状态

## 功能 (Capabilities)

### 新增功能

- `telecom-integration`: Android Telecom API 的客户端实现，包括短信发送和电话拨打接口
- `alert-config`: Web 配置界面，支持 API 地址、Token 和告警接收人手机号的管理
- `alert-notification`: 告警通知策略实现，包括短信优先、电话跟进的双重通知机制
- `alert-history`: 告警历史记录功能，记录通知状态和结果

### 修改功能

- `vehicle-monitor`: 车辆监控服务的报警触发逻辑，从日志记录改为调用 Telecom API 进行实际通知

## 影响

**受影响的代码：**
- `src/services/vehicle-monitor-service.ts` - 修改报警触发逻辑
- `src/web/routes/` - 新增配置 API 路由
- `src/web/public/vehicle-monitor.html` - 新增配置界面

**新增文件：**
- `src/services/telecom-client.ts` - Telecom API 客户端
- `config/` - 告警配置存储

**依赖项：**
- 需要在 Android 设备上部署 Telecom API 服务
- 需要配置 API 访问地址和认证 Token

**系统影响：**
- 告警通知依赖外部 API 服务的可用性
- 需要网络连通性以确保短信和电话能够正常发送
