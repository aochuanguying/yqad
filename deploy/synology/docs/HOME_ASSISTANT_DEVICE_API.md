# Home Assistant 设备信息 API 文档

## 📋 概述

本文档说明如何通过 Home Assistant REST API 获取固定设备（如 iPhone、安卓手机等）的状态信息。

---

## 🔐 认证方式

### 长期访问令牌（Long-Lived Access Token）

**获取步骤：**
1. 访问 Home Assistant：`https://ha.hxfssc.com:8088`
2. 点击左下角用户头像（个人档案）
3. 滚动到 **"长期访问令牌"** 区域
4. 点击 **"创建令牌"**
5. 输入令牌名称（如：`API Client`）
6. 复制生成的令牌（⚠️ **只显示一次，请妥善保存！**）

**使用方式：**
```http
Authorization: Bearer <YOUR_TOKEN>
```

---

## 📡 API 端点

### 1. 获取单个设备状态 ⭐ 最常用

**请求：**
```http
GET /api/states/<entity_id>
Host: ha.hxfssc.com:8088
Authorization: Bearer <YOUR_TOKEN>
```

**参数说明：**
- `<entity_id>` - 设备实体 ID，格式：`<domain>.<object_id>`
  - 设备追踪器：`device_tracker.<device_name>`
  - 示例：`device_tracker.iphone`

**curl 示例：**
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  "https://ha.hxfssc.com:8088/api/states/device_tracker.iphone"
```

**成功响应（200 OK）：**
```json
{
  "entity_id": "device_tracker.iphone",
  "state": "not_home",
  "attributes": {
    "source_type": "gps",
    "battery_level": 45,
    "latitude": 36.10742892720049,
    "longitude": 120.40772809786006,
    "gps_accuracy": 8,
    "altitude": 45.89509192858985,
    "vertical_accuracy": 14,
    "friendly_name": "iPhone"
  },
  "last_changed": "2026-06-14T09:59:32.684938+00:00",
  "last_reported": "2026-06-14T09:59:32.684938+00:00",
  "last_updated": "2026-06-14T09:59:32.684938+00:00",
  "context": {
    "id": "01KV2S4ZJCKQX71H854W56A39E",
    "parent_id": null,
    "user_id": null
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `entity_id` | string | 设备实体 ID |
| `state` | string | 设备状态：<br>- `home`：在家<br>- `not_home`：不在家<br>- 其他自定义状态 |
| `attributes.source_type` | string | 位置来源：`gps`、`router`、`bluetooth` 等 |
| `attributes.battery_level` | number | 电池电量百分比（0-100） |
| `attributes.latitude` | number | 纬度 |
| `attributes.longitude` | number | 经度 |
| `attributes.gps_accuracy` | number | GPS 精度（米） |
| `attributes.altitude` | number | 海拔高度（米） |
| `attributes.vertical_accuracy` | number | 垂直精度（米） |
| `attributes.friendly_name` | string | 设备友好名称 |
| `last_changed` | datetime | 状态最后改变时间 |
| `last_reported` | datetime | 最后上报时间 |
| `last_updated` | datetime | 最后更新时间 |

---

### 2. 获取所有设备状态

**请求：**
```http
GET /api/states
Host: ha.hxfssc.com:8088
Authorization: Bearer <YOUR_TOKEN>
```

**curl 示例：**
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://ha.hxfssc.com:8088/api/states"
```

**响应：** 返回所有实体状态的数组

**过滤特定类型设备（客户端处理）：**
```javascript
// 获取所有 device_tracker
const allStates = await fetch('/api/states', {
  headers: { 'Authorization': `Bearer ${TOKEN}` }
}).then(r => r.json());

const deviceTrackers = allStates.filter(e => 
  e.entity_id.startsWith('device_tracker.')
);
```

---

### 3. 获取设备历史轨迹（可选）

**请求：**
```http
GET /api/history/period/<timestamp>?entity_id=<entity_id>
Host: ha.hxfssc.com:8088
Authorization: Bearer <YOUR_TOKEN>
```

**参数说明：**
- `<timestamp>` - ISO 8601 格式的时间戳，如：`2026-06-14T10:00:00Z`
- `entity_id` - 可选，过滤特定设备

**curl 示例：**
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://ha.hxfssc.com:8088/api/history/period/2026-06-14T10:00:00Z?entity_id=device_tracker.iphone"
```

---

## 🛠️ 编程示例

### Node.js / JavaScript

```javascript
const axios = require('axios');

const HA_TOKEN = 'YOUR_LONG_LIVED_TOKEN';
const HA_BASE_URL = 'https://ha.hxfssc.com:8088';

/**
 * 获取设备状态
 * @param {string} entityId - 设备实体 ID，如 'device_tracker.iphone'
 * @returns {Promise<Object>} 设备状态信息
 */
async function getDeviceState(entityId) {
  try {
    const response = await axios.get(
      `${HA_BASE_URL}/api/states/${entityId}`,
      {
        headers: {
          'Authorization': `Bearer ${HA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('获取设备状态失败:', error.message);
    throw error;
  }
}

// 使用示例
(async () => {
  const device = await getDeviceState('device_tracker.iphone');
  console.log('设备状态:', device.state);
  console.log('位置:', device.attributes.latitude, device.attributes.longitude);
  console.log('电量:', device.attributes.battery_level + '%');
  console.log('最后更新:', device.last_reported);
})();
```

### Python

```python
import requests
from datetime import datetime

HA_TOKEN = 'YOUR_LONG_LIVED_TOKEN'
HA_BASE_URL = 'https://ha.hxfssc.com:8088'

HEADERS = {
    'Authorization': f'Bearer {HA_TOKEN}',
    'Content-Type': 'application/json'
}

def get_device_state(entity_id):
    """
    获取设备状态
    
    Args:
        entity_id (str): 设备实体 ID，如 'device_tracker.iphone'
    
    Returns:
        dict: 设备状态信息
    """
    try:
        response = requests.get(
            f'{HA_BASE_URL}/api/states/{entity_id}',
            headers=HEADERS
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f'HTTP {response.status_code}: {response.text}')
    except Exception as e:
        print(f'获取设备状态失败：{e}')
        raise

# 使用示例
if __name__ == '__main__':
    device = get_device_state('device_tracker.iphone')
    
    print(f"设备：{device['entity_id']}")
    print(f"状态：{device['state']}")
    print(f"位置：{device['attributes']['latitude']}, {device['attributes']['longitude']}")
    print(f"电量：{device['attributes'].get('battery_level', 'N/A')}%")
    print(f"GPS 精度：{device['attributes'].get('gps_accuracy', 'N/A')}米")
    print(f"最后更新：{device['last_reported']}")
```

### Shell / curl

```bash
#!/bin/bash

HA_TOKEN="YOUR_LONG_LIVED_TOKEN"
HA_BASE_URL="https://ha.hxfssc.com:8088"
ENTITY_ID="device_tracker.iphone"

# 获取设备状态
response=$(curl -s -X GET \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  "$HA_BASE_URL/api/states/$ENTITY_ID")

# 解析 JSON（需要 jq）
state=$(echo "$response" | jq -r '.state')
latitude=$(echo "$response" | jq -r '.attributes.latitude')
longitude=$(echo "$response" | jq -r '.attributes.longitude')
battery=$(echo "$response" | jq -r '.attributes.battery_level')
accuracy=$(echo "$response" | jq -r '.attributes.gps_accuracy')
last_updated=$(echo "$response" | jq -r '.last_reported')

echo "设备状态：$state"
echo "位置：$latitude, $longitude"
echo "电量：$battery%"
echo "GPS 精度：$accuracy 米"
echo "最后更新：$last_updated"
```

---

## 📱 常见设备实体 ID

| 设备类型 | 实体 ID 格式 | 示例 |
|---------|------------|------|
| iPhone | `device_tracker.iphone[_xxx]` | `device_tracker.iphone` |
| 安卓手机 | `device_tracker.<device_name>` | `device_tracker.pixel_7` |
| 路由器设备 | `device_tracker.<mac_address>` | `device_tracker.aa_bb_cc_dd_ee_ff` |
| 蓝牙设备 | `device_tracker.<bt_device>` | `device_tracker.airpods` |

**查看所有 device_tracker：**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$HA_BASE_URL/api/states" | \
  jq '.[] | select(.entity_id | startswith("device_tracker."))'
```

---

## ⚠️ 错误处理

### 常见错误码

| 状态码 | 说明 | 解决方案 |
|--------|------|---------|
| `200 OK` | 成功 | - |
| `401 Unauthorized` | 认证失败 | 检查 Token 是否正确或过期 |
| `403 Forbidden` | 权限不足 | 检查用户权限或 Token 权限 |
| `404 Not Found` | 设备不存在 | 检查 entity_id 是否正确 |
| `500 Internal Server Error` | 服务器错误 | 检查 HA 服务状态 |

**错误响应示例：**
```json
{
  "message": "Invalid authentication",
  "code": "invalid_auth"
}
```

---

## 🔒 安全建议

1. **保护 Token**
   - ⚠️ 不要将 Token 提交到版本控制系统
   - ✅ 使用环境变量存储 Token
   - ✅ 定期轮换 Token

2. **限制访问**
   - 为 API 客户端创建专用用户
   - 仅授予必要的权限
   - 使用 HTTPS（已配置）

3. **监控日志**
   - 定期检查 HA 日志
   - 监控异常 API 调用

---

## 📚 相关文档

- [Home Assistant REST API 官方文档](https://developers.home-assistant.io/docs/api/rest/)
- [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)
- [Home Assistant 认证文档](https://developers.home-assistant.io/docs/auth_api/)

---

## 💡 实用技巧

### 1. 检查设备是否在线

```javascript
function isDeviceOnline(deviceState) {
  const lastReported = new Date(deviceState.last_reported);
  const now = new Date();
  const diffMinutes = (now - lastReported) / (1000 * 60);
  
  // 30 分钟内有更新视为在线
  return diffMinutes < 30;
}
```

### 2. 计算距离（Haversine 公式）

```python
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    计算两点之间的距离（米）
    """
    R = 6371000  # 地球半径（米）
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda/2)**2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# 使用示例
distance = calculate_distance(36.1074, 120.4077, 36.1080, 120.4080)
print(f"距离：{distance:.2f} 米")
```

### 3. 判断是否在家

```javascript
const HOME_LAT = 36.1074;  // 家的纬度
const HOME_LON = 120.4077;  // 家的经度
const HOME_RADIUS = 100;    // 家的半径（米）

function isHome(deviceState) {
  if (deviceState.state === 'home') {
    return true;
  }
  
  const deviceLat = deviceState.attributes.latitude;
  const deviceLon = deviceState.attributes.longitude;
  
  if (!deviceLat || !deviceLon) {
    return false;
  }
  
  const distance = calculateDistance(HOME_LAT, HOME_LON, deviceLat, deviceLon);
  return distance <= HOME_RADIUS;
}
```

---

**文档版本：** 1.0  
**最后更新：** 2026-06-14  
**维护者：** Auto
