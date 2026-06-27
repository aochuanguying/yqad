## 为什么

汽车监控的 Token 从其他设备复制，经常发生变化。目前需要手动修改配置文件或本地文件来更新 Token，操作繁琐且无法远程自动化。需要提供一个 API 供外部系统调用，实现 Token 的远程更新和热加载。

## 变更内容

新增一个 API 端点，允许通过 API 请求更新车辆监控 Token。该 API 将：
- 接收新的 Token 参数
- 验证 Token 格式
- 保存到本地文件
- 热加载到内存中，无需重启服务
- 经过 API_Token 校验，确保安全性

## 功能 (Capabilities)

### 新增功能
- `vehicle-token-update`: 提供更新车辆监控 Token 的 API 端点，支持热加载和 API Token 鉴权

### 修改功能

## 影响

- 新增 API 路由：`POST /api/vehicle-monitor/token`
- 修改车辆监控服务：添加热加载 Token 的能力
- 需要 API Token 鉴权，参考现有发帖 API 的鉴权配置
- 不影响现有监控逻辑，仅增加 Token 更新能力
