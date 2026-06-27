## 1. 项目初始化

- [x] 1.1 创建服务文件 `src/services/vehicle-monitor-service.ts`
- [x] 1.2 在 `config/default.yaml` 中添加 `vehicleMonitor` 配置块
- [x] 1.3 创建 Token 存储文件 `data/vehicle-token.json`
- [ ] 1.4 创建配置文件 `data/vehicle-config.json`（可选）

## 2. 车辆 Token 管理模块

- [x] 2.1 创建 MD5 工具函数（备用，实际不使用）
- [x] 2.2 实现 Token 存储和读取（`data/vehicle-token.json`）
- [x] 2.3 实现 Token 验证函数（validateToken）
- [x] 2.4 实现 Token 有效性检测
- [x] 2.5 支持配置 Token（避免同设备踢出）

## 3. 车辆数据获取模块

- [x] 3.1 实现 getNowCar 函数（获取车辆信息）
- [x] 3.2 实现 getCarOBD 函数（获取车况信息）
- [x] 3.3 实现 getLocation 函数（获取车辆位置）
- [x] 3.4 实现字段解码函数（decodeOBD, decodeCarInfo）
- [ ] 3.5 添加数据缓存机制（避免频繁请求）

## 4. Home Assistant 集成模块

- [x] 4.1 实现 Home Assistant API 客户端
- [x] 4.2 实现设备位置获取函数
- [ ] 4.3 实现设备在线状态检测
- [x] 4.4 添加 HA API 错误处理和重试机制

## 5. 异常判定模块

- [x] 5.1 实现位置变化检测（Haversine 距离计算）
- [x] 5.2 实现门窗未关判定（复用 anyDoorOpen/anyWindowOpen）
- [x] 5.3 实现设防状态异常判定
- [x] 5.4 实现电压异常判定
- [x] 5.5 实现离线状态判定
- [x] 5.6 实现综合异常判定函数

## 6. 安全距离监控模块

- [x] 6.1 实现 Haversine 距离计算函数
- [x] 6.2 实现安全距离判定逻辑
- [x] 6.3 实现报警触发条件判断
- [x] 6.4 添加报警冷却机制（避免重复报警）

## 7. 报警通知模块

- [x] 7.1 实现电话报警接口（抽象层）
- [x] 7.2 实现日志报警（基础功能）
- [x] 7.3 预留短信/邮件通知接口
- [x] 7.4 实现报警消息格式化

## 8. 集成到调度器

- [x] 8.1 在 `src/scheduler/index.ts` 中添加车辆监控任务注册
- [x] 8.2 在 `config/default.yaml` 中配置监控间隔（`intervalMinutes`）
- [x] 8.3 实现异常状态快速监控间隔配置
- [ ] 8.4 支持配置热重载（复用现有 `handleSchedulerConfigChange`）

## 9. 日志和监控

- [x] 9.1 集成现有 Winston 日志（复用 `src/utils/logger.ts`）
- [x] 9.2 复用现有日志轮转配置
- [x] 9.3 实现敏感信息脱敏（手机号、Token）
- [ ] 9.4 添加监控指标记录（请求次数、失败率等）

## 10. 错误处理和恢复

- [x] 10.1 复用现有重试工具（`src/utils/retry.ts`）
- [x] 10.2 实现错误分类和处理（网络错误、业务错误）
- [x] 10.3 复用现有服务崩溃恢复机制
- [ ] 10.4 添加错误告警通知

## 11. 配置管理

- [x] 11.1 复用现有配置加载系统（`src/utils/config.ts`）
- [x] 11.2 支持配置热重载（复用现有 `configEvents`）
- [x] 11.3 在 `config/default.yaml` 中添加配置项默认值
- [ ] 11.4 实现配置验证和错误提示

## 12. 测试和验证

- [ ] 12.1 编写单元测试（认证、数据获取、异常判定）
- [ ] 12.2 编写集成测试（完整监控流程）
- [ ] 12.3 进行本地环境测试
- [ ] 12.4 进行生产环境部署测试

## 13. 文档和部署

- [ ] 13.1 更新项目 README.md，添加车辆监控说明
- [x] 13.2 编写配置说明文档（在 `config/default.yaml` 中添加注释）
- [ ] 13.3 编写故障排查指南
- [x] 13.4 复用现有 Dockerfile（已存在）
- [ ] 13.6 编写 systemd 服务配置（如需要，复用现有配置）
