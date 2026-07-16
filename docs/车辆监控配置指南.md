# 车辆监控系统配置指南

## 📋 概述

车辆监控系统已集成到 `audi-app-auto-tasks` 项目中，通过定时任务实现 24 小时不间断监控。

**重要变更**：为避免同设备踢出机制，系统改为直接使用 Token，不再进行密码登录。

---

## 🔑 Token 获取方式

### 方法 1：从 iOS Scriptable 获取（推荐）

1. **在 iOS 设备上运行 Scriptable**
   - 打开 Scriptable App
   - 运行 `奥捷智行.scriptable` 脚本
   - 确保已成功登录并显示车辆信息

2. **查看 Keychain 中的 Token**
   - 在 Scriptable 中运行以下代码：
   ```javascript
   const token = Keychain.get("aujie_token");
   console.log("Token:", token);
   // 复制输出的 Token 值
   ```

3. **或者查看日志**
   - 在 Scriptable 的日志中查找包含 `token` 的记录

### 方法 2：通过 API 远程更新 Token

系统提供了 Token 更新 API，可以远程更新 Token 并立即热加载，无需重启服务。

**API 端点：** `POST /api/vehicle-token/update`

**请求示例：**
```bash
curl -X POST http://localhost:3000/api/vehicle-token/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{"token": "YOUR_VEHICLE_TOKEN"}'
```

**参数说明：**
- `Authorization: Bearer <API_TOKEN>` - 使用项目的 API Token 进行鉴权
- `token` - 要更新的车辆监控 Token

**响应示例：**
```json
{
  "code": "SUCCESS",
  "message": "Token 已更新"
}
```

**错误响应：**
- **401 未授权**：缺少或无效的 API Token
  ```json
  {"error": "缺少 Authorization 头", "code": "UNAUTHORIZED"}
  ```
- **400 参数错误**：缺少或无效的 token 参数
  ```json
  {"code": "INVALID_PARAM", "message": "缺少 token 字段"}
  ```
- **500 服务器错误**：Token 更新失败
  ```json
  {"code": "UPDATE_FAILED", "message": "Token 更新失败，请稍后重试"}
  ```

**获取 API Token：**
1. 访问 Web 管理界面的 "API Token" 页面
2. 生成或复制现有的 API Token
3. 在请求中使用 `Authorization: Bearer <API_TOKEN>` 格式

**特性：**
- ✅ **热加载**：Token 更新后立即生效，无需重启服务
- ✅ **持久化**：Token 保存到 `data/vehicle-token.json` 文件
- ✅ **安全性**：使用 API Token 鉴权，防止未授权访问
- ✅ **验证**：自动验证 Token 格式，防止无效 Token

**使用场景：**
- 从 iOS Scriptable 复制新 Token 后，通过 API 远程更新
- 集成到自动化脚本中，定期更新 Token
- 多个设备共享 Token 时，集中管理 Token 更新

### 方法 2：从其他设备获取

如果你有其他正在运行的奥捷智行客户端，可以从其配置中提取 Token。

---

## ⚙️ 配置步骤

### 1. 编辑配置文件

打开 `config/default.yaml`，找到 `vehicleMonitor` 部分：

```yaml
vehicleMonitor:
  enabled: true  # 启用监控
  intervalMinutes: 15  # 监控间隔（分钟）
  safeDistanceMeters: 100  # 安全距离（米）
  alertPhone: ""  # 报警电话（可选）
  
  # Home Assistant 配置
  haBaseUrl: "https://ha.hxfssc.com:8088"
  haToken: "YOUR_HA_TOKEN"
  deviceTrackerEntity: "device_tracker.iphone"
  
  # 奥捷智行 Token 配置（重要！）
  token: "YOUR_VEHICLE_TOKEN"  # 从 iOS Scriptable 获取的 Token
  mobileNum: "314B7D8BD81D6C969711D9B1120A474D"  # 可选，用于日志
```

### 2. 填写必要信息

**必填项：**
- ✅ `token` - 奥捷智行 Token（从 iOS Scriptable 获取）
- ✅ `haToken` - Home Assistant Token
- ✅ `deviceTrackerEntity` - 手机设备实体 ID

**可选项：**
- `alertPhone` - 报警电话号码（实现电话报警功能时需要）
- `mobileNum` - 设备号（用于日志记录）

### 3. 保存并重启服务

```bash
# 重启服务
npm run dev

# 或生产环境
npm start
```

---

## 🧪 测试验证

### 1. 检查日志输出

启动服务后，观察日志：

```
info [vehicle-monitor] 开始车辆监控...
info [vehicle-monitor] Token 有效
info [vehicle-monitor] 车辆状态正常
```

### 2. 查看 Token 文件

检查 `data/vehicle-token.json` 是否已保存：

```bash
cat data/vehicle-token.json
```

### 3. 验证监控间隔

服务会按照配置的间隔（默认 15 分钟）自动执行监控：

```
info [scheduler] 车辆监控使用间隔模式：每隔 15 分钟执行一次
info [vehicle-monitor] 车辆监控：间隔执行（每隔 15 分钟）
```

---

## 🔧 故障排查

### Token 无效

**错误信息：**
```
error [vehicle-monitor] Token 无效，无法继续监控
```

**解决方案：**
1. 确认 Token 是否正确复制（无多余空格）
2. 在 iOS Scriptable 中重新获取 Token
3. 检查 Token 是否过期（可能需要重新登录）

### 无法获取车辆数据

**可能原因：**
- Token 已过期
- 车辆 API 服务不可用
- 网络连接问题

**解决方案：**
1. 检查网络连通性：`curl https://ck.shjza.cn`
2. 在 iOS Scriptable 中验证 API 可用性
3. 重新获取 Token

### Home Assistant 设备位置获取失败

**错误信息：**
```
error [vehicle-monitor] 获取 Home Assistant 设备位置失败
```

**解决方案：**
1. 检查 `haBaseUrl` 是否正确
2. 验证 `haToken` 是否有效
3. 确认 `deviceTrackerEntity` 实体存在

---

## 📊 监控指标

### 正常状态

```
info [vehicle-monitor] 车辆状态正常
```

### 异常状态

系统会检测以下异常：

1. **车辆离线**
2. **车门未关**
3. **车窗未关**
4. **车辆未设防**
5. **电池电压过低**
6. **车辆移动超过阈值**

检测到异常时：

```
warn [vehicle-monitor] 检测到异常：车门未关，车辆未设防
warn [ALERT] 触发报警：车辆异常：车门未关，车辆未设防
warn [ALERT] 准备拨打 13800138000, 原因：车辆异常：车门未关，车辆未设防
```

---

## 🛡️ 安全注意事项

1. **Token 保护**
   - 不要将 Token 提交到版本控制系统
   - 定期轮换 Token
   - 建议使用专用账号

2. **文件权限**
   ```bash
   chmod 600 data/vehicle-token.json
   chmod 600 config/default.yaml
   ```

3. **日志脱敏**
   - 系统已自动脱敏敏感信息
   - 定期清理日志文件

---

## 📝 更新日志

**v1.1.0 (2026-06-14)**
- ✅ 改为直接使用 Token，避免同设备踢出
- ✅ 移除密码登录逻辑
- ✅ 简化配置项
- ✅ 增加 Token 验证机制

**v1.0.0 (2026-06-14)**
- ✅ 初始版本发布

---

## 📞 支持

如有问题，请查看：
- [奥捷智行 API 文档](./HOME_ASSISTANT_DEVICE_API.md)
- [设计文档](../openspec/changes/vehicle-monitor-system/design.md)
- [任务列表](../openspec/changes/vehicle-monitor-system/tasks.md)
