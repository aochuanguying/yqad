# 生产环境车辆异常告警模拟测试报告

## 测试时间
2026-07-26 20:30

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

### 告警渠道配置状态
1. **Bark 推送**: ✅ 已配置 Key，❌ 未配置 device key
2. **短信通知**: ✅ 已配置手机号，❌ API 调用失败 (HTTP 500)
3. **电话通知**: ✅ 已配置手机号，✅ **测试成功**

## 测试过程

### 1. 车辆实时状态查询
```bash
curl -X GET "http://192.168.50.10:3080/api/vehicle-monitor/status/external" \
  -H "Authorization: Bearer api_token_..."
```

**返回结果**:
```json
{
  "isOnline": true,
  "isAnomaly": false,
  "anomalies": [],
  "location": {
    "lat": 36.10772373923576,
    "lng": 120.41258170164984
  },
  "obd": {
    "oilLiters": 43,
    "oilPercent": 59,
    "batteryVolt": 12.7,
    "isDefence": true,
    "engineOn": false,
    "anyDoorOpen": false,
    "anyWindowOpen": false
  }
}
```

**车辆状态**: ✅ 正常
- 车辆在线
- 已设防
- 车门已关
- 电池电压正常 (12.7V)

### 2. 手动触发测试告警
```bash
curl -X POST "http://192.168.50.10:3080/api/vehicle-monitor/test-alert" \
  -H "Authorization: Bearer api_token_..." \
  -H "Content-Type: application/json" \
  -d '{
    "anomalies": ["车门未关", "车辆未设防", "车辆移动 (150 米)", "电池电压过低 (11.2V)"],
    "lat": 36.10772373923576,
    "lng": 120.41258170164984,
    "address": "山东省青岛市即墨区奥捷智行汽车"
  }'
```

**测试结果**:
```json
{
  "code": "SUCCESS",
  "message": "测试告警已触发",
  "data": {
    "success": true,
    "skipped": false,
    "barkResult": {
      "success": false,
      "error": "发送 Bark 推送失败：HTTP 400 - device key is empty"
    },
    "smsResult": {
      "success": false,
      "error": "发送短信失败：HTTP 500 - Failed to send SMS"
    },
    "callResult": {
      "success": true,
      "message": "Call initiated to 18953272532"
    }
  }
}
```

## 测试结果总结

### ✅ 成功项
1. **电话告警**: 成功发起，拨打到 18953272532
2. **API 接口**: 新增的测试告警接口工作正常
3. **鉴权机制**: API Token 鉴权正常
4. **外部调用接口**: 不受 `enabled` 参数限制，始���执行监控

### ❌ 失败项
1. **Bark 推送**: 失败
   - 原因：`device key is empty`
   - 解决：需要在 Bark App 中获取 device key 并配置

2. **短信通知**: 失败
   - 原因：`HTTP 500 - Failed to send SMS`
   - 解决：需要检查 Telecom API 配置和服务状态

### ⚠️ 注意事项
1. 告警冷却时间为 30 分钟，重复测试需要等待冷却
2. Bark 推送需要配置 device key 才能发送到具体设备
3. Telecom API 返回 500 错误，需要检查 API 服务状态

## 实际车辆状态（生产环境）
- **车牌**: 鲁 B9982B
- **在线状态**: ✅ 在线
- **当前位置**: 36.1077, 120.4126 (山东省青岛市即墨区)
- **油量**: 43 升 (59%)
- **电池**: 12.7V (正常)
- **设防**: ✅ 已设防
- **车门**: ✅ 已关
- **发动机**: ✅ 熄火

## 下一步建议

### 1. 修复 Bark 推送
在 Bark App 中获取 device key，然后在车辆监控配置页面填写完整的 Bark Key

### 2. 检查 Telecom API
- 确认 Telecom API 服务是否正常运行
- 检查 API Token 是否有效
- 查看 Telecom 服务端日志

### 3. 启用定时监控
当前 `enabled: false`，如需自动监控需要启用：
```json
{
  "enabled": true
}
```

### 4. 验证电话告警
请确认手机 18953272532 是否实际接到了测试电话

## 测试文件
- 测试脚本：`test-trigger-prod-alert.ts`
- 路由实现：`src/web/routes/vehicle-monitor-routes.ts` (新增 `/test-alert` 接口)

---

**测试完成时间**: 2026-07-26 20:35
**测试结果**: ✅ 部分成功（电话告警成功，Bark 和短信待修复）
