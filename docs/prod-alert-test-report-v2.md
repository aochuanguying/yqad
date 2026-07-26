# 生产环境车辆异常告警模拟测试报告（更新）

## 测试时间
2026-07-26 20:35（第一次）
2026-07-26 20:45（第二次 - Bark 修复后）

## 测试环境
- **生产服务器**: http://192.168.50.10:3080
- **数据库**: MySQL (yqad_prod_db)
- **Redis**: db 1, keyPrefix: `prod:`
- **API Token**: 已配置并验证通过

## 生产环境配置

### 车辆监控配置
```json
{
  "enabled": false,              // 未启用定时监控
  "intervalMinutes": 15,
  "quickIntervalMinutes": 5,
  "safeDistanceMeters": 50,
  "moveThresholdMeters": 50,
  "minBatteryVolt": 11.5,
  "alertPhone": "18953272532",   // ✅ 告警手机号
  "barkKey": "Asbu4fr2HjGAjKbHANNbLS",  // ✅ Bark Key
  "barkServer": "",              // 使用默认服务器
  "haBaseUrl": "https://ha.hxfssc.com:8088",  // ✅ Home Assistant
  "haToken": "已配置",
  "deviceTrackerEntity": "device_tracker.iphone"
}
```

### 告警渠道配置状态（修复后）
| 渠道 | 状态 | 说明 |
|------|------|------|
| **Bark 推送** | ✅ **成功** | 已修复 URL 路径问题 |
| **电话通知** | ✅ **成功** | 电话已接听到 |
| **短信通知** | ❌ 失败 | Telecom API 返回 HTTP 500 |

## 问题排查与修复

### Bark 推送问题

#### 问题现象
- 第一次测试返回：`device key is empty`
- 配置中已设置 Bark Key: `Asbu4fr2HjGAjKbHANNbLS`

#### 根本原因
Bark API 要求将 key 包含在 URL 路径中：
```
正确：https://api.day.app/{key}/push
错误：https://api.day.app/push (缺少 key)
```

原代码 `bark-client.ts` 使用了错误的 baseURL：
```typescript
// ❌ 错误
baseURL: 'https://api.day.app'

// ✅ 正确
baseURL: `https://api.day.app/${config.barkKey}`
```

#### 修复方案
修改 `/src/services/bark-client.ts` 的 `init()` 方法：
```typescript
this.axiosInstance = axios.create({
  baseURL: `${serverUrl}/${config.barkKey}`,  // 将 key 加入 URL 路径
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

#### 验证结果
修复后测试成功：
```
📱 Bark: ✅ 成功
   消息：success
```

## 最终测试结果

### ✅ 成功项
1. **Bark 推送**: ✅ 成功
   - 推送标题：车辆告警
   - 推送内容：时间、异常列表、位置信息
   - 推送级别：timeSensitive（紧急）
   - 提示音：alarm

2. **电话告警**: ✅ 成功
   - 拨打号码：18953272532
   - 状态：用户已接听到

3. **API 接口**: ✅ 正常
   - 测试告警接口：`POST /api/vehicle-monitor/test-alert`
   - 外部调用接口：`GET /api/vehicle-monitor/status/external`
   - API Token 鉴权：正常

### ❌ 失败项
1. **短信通知**: ❌ 失败
   - 错误：`HTTP 500 - Failed to send SMS`
   - 原因：Telecom API 服务异常
   - 待解决：需要检查 Telecom API 服务状态

## 实际接收情况

### 用户反馈
- ✅ **电话**: 已接到
- ✅ **Bark 推送**: 已收到（修复后）
- ❌ **短信**: 未收到（API 故障）

## 代码变更

### 文件：`src/services/bark-client.ts`

**修改位置**: 第 56-64 行

**修改前**:
```typescript
this.axiosInstance = axios.create({
  baseURL: serverUrl,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

**修改后**:
```typescript
// Bark API 需要将 key 包含在 URL 路径中：https://api.day.app/{key}/push
this.axiosInstance = axios.create({
  baseURL: `${serverUrl}/${config.barkKey}`,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 部署信息
- 部署方式：增量部署 (`./scripts/deploy.sh`)
- 部署时间：2026-07-26 20:45
- 服务状态：✅ 已就绪

## 待解决问题

### 1. Telecom API 短信服务
- **现象**: HTTP 500 错误
- **影响**: 无法发送短信告警
- **建议**: 
  - 检查 Telecom API 服务是否运行
  - 验证 API Token 是否有效
  - 查看 Telecom 服务端日志

### 2. Bark 自定义设备
如果需要在多个设备上接收推送，可以：
1. 在 Bark App 中创建多个设备
2. 获取每个设备的 device key
3. 在配置中使用特定的 device key

## 告警配置建议

### 当前配置评估
- ✅ Bark 推送：工作正常，推荐作为主要告警方式
- ✅ 电话告警：工作正常，适合紧急情况
- ❌ 短信告警：待修复，可作为备用方案

### 推荐配置
1. **主要告警**: Bark 推送（即时、免费）
2. **紧急备份**: 电话告警（确保紧急情况下能收到）
3. **可选备用**: 短信告警（修复后启用）

## 测试脚本

### 测试告警接口
```bash
curl -X POST "http://192.168.50.10:3080/api/vehicle-monitor/test-alert" \
  -H "Authorization: Bearer api_token_..." \
  -H "Content-Type: application/json" \
  -d '{
    "anomalies": ["车门未关", "车辆未设防"],
    "lat": 36.1077,
    "lng": 120.4126,
    "address": "测试位置"
  }'
```

### 本地测试脚本
- `test-trigger-prod-alert.ts`: 调用生产服务器测试告警
- `test-bark-api.ts`: 直接测试 Bark API

---

**测试完成时间**: 2026-07-26 20:45
**测试结果**: ✅ **成功**（Bark 推送已修复，电话告警正常）
**下一步**: 修复 Telecom API 短信服务（可选）
