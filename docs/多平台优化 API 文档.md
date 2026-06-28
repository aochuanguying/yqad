# 多平台优化 API 文档

本文档详细说明了多平台发帖优化功能提供的 API 接口。

## 目录

1. [配置管理接口](#1-配置管理接口)
2. [缓存管理接口](#2-缓存管理接口)
3. [统计监控接口](#3-统计监控接口)
4. [使用示例](#4-使用示例)

---

## 1. 配置管理接口

### 1.1 获取所有平台配置

**接口**: `GET /api/network-post/config/platforms`

**描述**: 获取所有平台的配置信息，包括优先级、频率限制、成功率等。

**请求参数**: 无

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "platformName": "xiaohongshu",
      "platformDisplay": "小红书",
      "priority": 8,
      "rateLimitPerHour": 20,
      "successRate": 95.5,
      "enabled": true
    },
    {
      "platformName": "zhihu",
      "platformDisplay": "知乎",
      "priority": 7,
      "rateLimitPerHour": 100,
      "successRate": 88.2,
      "enabled": true
    },
    {
      "platformName": "autohome",
      "platformDisplay": "汽车之家",
      "priority": 8,
      "rateLimitPerHour": 50,
      "successRate": 92.1,
      "enabled": true
    }
  ]
}
```

**字段说明**:
- `platformName`: 平台标识符（xiaohongshu|zhihu|autohome）
- `platformDisplay`: 平台显示名称
- `priority`: 优先级（1-10）
- `rateLimitPerHour`: 每小时频率限制
- `successRate`: 历史成功率（%）
- `enabled`: 是否启用

---

### 1.2 更新平台优先级

**接口**: `POST /api/network-post/config/platform/priority`

**描述**: 更新指定平台的优先级配置。

**请求参数**:
```json
{
  "platform": "xiaohongshu",
  "priority": 9
}
```

**字段说明**:
- `platform`: 平台标识符（必填）
- `priority`: 新优先级（必填，范围 1-10）

**响应格式**:
```json
{
  "success": true,
  "message": "平台 xiaohongshu 优先级已更新为 9，缓存已清除",
  "data": {
    "platform": "xiaohongshu",
    "oldPriority": 8,
    "newPriority": 9
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "优先级必须在 1-10 范围内",
  "code": "INVALID_PRIORITY"
}
```

---

### 1.3 获取分平台搜索词配置

**接口**: `GET /api/network-post/config/search-keywords/:platform`

**描述**: 获取指定平台的搜索词配置。

**请求参数**:
- `platform`: 平台标识符（xiaohongshu|zhihu|autohome|all）

**响应格式**:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "searchKeywords": ["奥迪 Q5L", "奥迪 A4L", "奥迪自驾游"],
    "maxResults": 5,
    "timeout": 90000,
    "rateLimitPerHour": 20,
    "platform": "xiaohongshu",
    "watermarkRemoval": {
      "enabled": true,
      "timeout": 30000,
      "maxRetries": 2,
      "batchSize": 5
    }
  }
}
```

---

### 1.4 更新搜索词配置

**接口**: `POST /api/network-post/config/search-keywords`

**描述**: 更新指定平台的搜索词配置。

**请求参数**:
```json
{
  "platform": "xiaohongshu",
  "searchKeywords": "奥迪 Q5L，奥迪 A4L，奥迪自驾游，奥迪露营",
  "rateLimitPerHour": 25
}
```

**字段说明**:
- `platform`: 平台标识符（必填）
- `searchKeywords`: 搜索词列表，逗号分隔（可选）
- `rateLimitPerHour`: 频率限制（可选）

**响应格式**:
```json
{
  "success": true,
  "message": "搜索词配置已更新",
  "data": {
    "platform": "xiaohongshu",
    "searchKeywords": ["奥迪 Q5L", "奥迪 A4L", "奥迪自驾游", "奥迪露营"],
    "rateLimitPerHour": 25
  }
}
```

---

## 2. 缓存管理接口

### 2.1 清除所有缓存

**接口**: `POST /api/network-post/cache/clear`

**描述**: 清除所有互联网参考配置的 Redis 缓存。

**请求参数**: 无

**响应格式**:
```json
{
  "success": true,
  "message": "已清除 5 个缓存键",
  "data": {
    "clearedKeys": 5,
    "keys": [
      "internet_ref:platform_config",
      "internet_ref:platform_priority",
      "internet_ref:search_keywords:xiaohongshu",
      "internet_ref:search_keywords:zhihu",
      "internet_ref:search_keywords:autohome"
    ]
  }
}
```

---

### 2.2 清除指定平台缓存

**接口**: `POST /api/network-post/cache/clear/:platform`

**描述**: 清除指定平台的缓存。

**请求参数**:
- `platform`: 平台标识符（必填）

**响应格式**:
```json
{
  "success": true,
  "message": "平台 xiaohongshu 缓存已清除",
  "data": {
    "platform": "xiaohongshu",
    "clearedKeys": 2
  }
}
```

---

### 2.3 获取缓存统计

**接口**: `GET /api/network-post/cache/stats`

**描述**: 获取缓存使用统计信息，包括命中率、延迟等。

**请求参数**: 无

**响应格式**:
```json
{
  "success": true,
  "data": {
    "hitCount": 150,
    "missCount": 20,
    "hitRate": 88.24,
    "cacheSize": 5,
    "avgLatencyMs": 12.5
  }
}
```

**字段说明**:
- `hitCount`: 缓存命中次数
- `missCount`: 缓存未命中次数
- `hitRate`: 命中率（%）
- `cacheSize`: 缓存条目数
- `avgLatencyMs`: 平均延迟（毫秒）

---

## 3. 统计监控接口

### 3.1 获取平台使用统计

**接口**: `GET /api/network-post/stats/platforms`

**描述**: 获取各平台的使用统计信息。

**请求参数**: 无

**响应格式**:
```json
{
  "success": true,
  "data": {
    "xiaohongshu": {
      "queryCount": 50,
      "successCount": 48,
      "failCount": 2,
      "successRate": 96.0,
      "lastUsedAt": "2026-06-28T10:30:00Z",
      "avgMaterialQuality": 85.5
    },
    "zhihu": {
      "queryCount": 30,
      "successCount": 28,
      "failCount": 2,
      "successRate": 93.3,
      "lastUsedAt": "2026-06-28T09:15:00Z",
      "avgMaterialQuality": 82.3
    },
    "autohome": {
      "queryCount": 40,
      "successCount": 38,
      "failCount": 2,
      "successRate": 95.0,
      "lastUsedAt": "2026-06-28T11:00:00Z",
      "avgMaterialQuality": 88.1
    }
  }
}
```

---

### 3.2 获取缓存告警状态

**接口**: `GET /api/network-post/cache/alarm`

**描述**: 检查缓存是否触发告警（命中率低或延迟高）。

**请求参数**: 无

**响应格式**:
```json
{
  "success": true,
  "data": {
    "hitRateAlarm": false,
    "latencyAlarm": false,
    "hitRateThreshold": 50,
    "latencyThresholdMs": 100,
    "currentHitRate": 88.24,
    "currentLatencyMs": 12.5
  }
}
```

**字段说明**:
- `hitRateAlarm`: 命中率告警状态
- `latencyAlarm`: 延迟告警状态
- `hitRateThreshold`: 命中率告警阈值
- `latencyThresholdMs`: 延迟告警阈值（毫秒）
- `currentHitRate`: 当前命中率
- `currentLatencyMs`: 当前平均延迟

---

## 4. 使用示例

### 4.1 使用 curl 调用 API

```bash
# 获取所有平台配置
curl -X GET http://localhost:3000/api/network-post/config/platforms \
  -H "Authorization: Bearer YOUR_TOKEN"

# 更新平台优先级
curl -X POST http://localhost:3000/api/network-post/config/platform/priority \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platform":"xiaohongshu","priority":9}'

# 清除缓存
curl -X POST http://localhost:3000/api/network-post/cache/clear \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取缓存统计
curl -X GET http://localhost:3000/api/network-post/cache/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.2 使用 TypeScript 调用

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const TOKEN = 'YOUR_TOKEN';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
  },
});

// 获取所有平台配置
async function getAllPlatformConfigs() {
  const response = await api.get('/network-post/config/platforms');
  return response.data.data;
}

// 更新平台优先级
async function updatePlatformPriority(platform: string, priority: number) {
  const response = await api.post('/network-post/config/platform/priority', {
    platform,
    priority,
  });
  return response.data;
}

// 清除缓存
async function clearCache() {
  const response = await api.post('/network-post/cache/clear');
  return response.data;
}

// 获取缓存统计
async function getCacheStats() {
  const response = await api.get('/network-post/cache/stats');
  return response.data.data;
}

// 使用示例
(async () => {
  // 查看当前配置
  const configs = await getAllPlatformConfigs();
  console.log('当前平台配置:', configs);
  
  // 更新优先级
  await updatePlatformPriority('xiaohongshu', 9);
  console.log('优先级已更新');
  
  // 查看缓存统计
  const stats = await getCacheStats();
  console.log('缓存统计:', stats);
})();
```

### 4.3 使用 Python 调用

```python
import requests

API_BASE = 'http://localhost:3000/api'
TOKEN = 'YOUR_TOKEN'

headers = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'application/json'
}

# 获取所有平台配置
def get_all_platform_configs():
    response = requests.get(
        f'{API_BASE}/network-post/config/platforms',
        headers=headers
    )
    return response.json()['data']

# 更新平台优先级
def update_platform_priority(platform: str, priority: int):
    response = requests.post(
        f'{API_BASE}/network-post/config/platform/priority',
        headers=headers,
        json={'platform': platform, 'priority': priority}
    )
    return response.json()

# 清除缓存
def clear_cache():
    response = requests.post(
        f'{API_BASE}/network-post/cache/clear',
        headers=headers
    )
    return response.json()

# 获取缓存统计
def get_cache_stats():
    response = requests.get(
        f'{API_BASE}/network-post/cache/stats',
        headers=headers
    )
    return response.json()['data']

# 使用示例
if __name__ == '__main__':
    # 查看当前配置
    configs = get_all_platform_configs()
    print('当前平台配置:', configs)
    
    # 更新优先级
    result = update_platform_priority('xiaohongshu', 9)
    print('优先级已更新:', result)
    
    # 查看缓存统计
    stats = get_cache_stats()
    print('缓存统计:', stats)
```

---

## 错误码说明

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| INVALID_PRIORITY | 优先级超出 1-10 范围 | 检查优先级值 |
| PLATFORM_NOT_FOUND | 平台不存在 | 检查平台标识符 |
| CACHE_ERROR | 缓存操作失败 | 检查 Redis 连接 |
| DATABASE_ERROR | 数据库操作失败 | 检查数据库连接 |
| UNAUTHORIZED | 未授权访问 | 检查 Token 有效性 |

---

## 相关文档

- [多平台优化数据库迁移说明.md](./多平台优化数据库迁移说明.md)
- [三大平台特点与优化策略.md](./三大平台特点与优化策略.md)
- [API 文档.md](./API 文档.md)

---

## 更新日志

- 2026-06-28: 初始版本，包含配置管理、缓存管理、统计监控接口
