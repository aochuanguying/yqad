# 手机配置 API 文档

## 概述

手机配置功能提供短信记录和未接电话记录的存储与查询接口，数据存储在 MySQL 数据库中。

**基础路径**: `/api/posts/mobile`

**认证方式**: Session 会话认证（需要先登录 Web 管理界面）

---

## 1. 手机短信 API

### 1.1 查询短信列表

获取短信记录列表。

**请求**

```http
GET /api/posts/mobile/sms
```

**查询参数**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| limit | number | 否 | 50 | 返回记录数限制 |
| offset | number | 否 | 0 | 偏移量 |
| phone_number | string | 否 | - | 按电话号码筛选 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "phoneNumber": "13800138000",
      "content": "您的验证码是 123456",
      "receivedAt": "2024-06-27T10:30:00.000Z",
      "createdAt": "2024-06-27T10:31:00.000Z"
    },
    {
      "id": 2,
      "phoneNumber": "13900139000",
      "content": "您好，这是一条测试短信",
      "receivedAt": "2024-06-27T09:15:00.000Z",
      "createdAt": "2024-06-27T09:16:00.000Z"
    }
  ]
}
```

**字段说明**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 记录 ID |
| phoneNumber | string | 发送方电话号码 |
| content | string | 短信内容 |
| receivedAt | string (ISO 8601) | 短信接收时间 |
| createdAt | string (ISO 8601) | 记录创建时间 |

**状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 401 | 未登录或会话过期 |
| 500 | 服务器内部错误 |

---

### 1.2 添加短信记录

添加一条新的短信记录。

**请求**

```http
POST /api/posts/mobile/sms
Content-Type: application/json
```

**请求体**

```json
{
  "phone_number": "13800138000",
  "content": "您的验证码是 123456",
  "received_at": "2024-06-27T10:30:00.000Z"
}
```

**字段说明**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| phone_number | string | 是 | 发送方电话号码 |
| content | string | 是 | 短信内容 |
| received_at | string (ISO 8601) | 否 | 短信接收时间，默认当前时间 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": 3
  }
}
```

**状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 缺少必填字段 |
| 401 | 未登录或会话过期 |
| 500 | 服务器内部错误 |

---

## 2. 未接电话 API

### 2.1 查询未接电话列表

获取未接电话记录列表。

**请求**

```http
GET /api/posts/mobile/calls/missed
```

**查询参数**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| limit | number | 否 | 50 | 返回记录数限制 |
| offset | number | 否 | 0 | 偏移量 |
| phone_number | string | 否 | - | 按电话号码筛选 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "phoneNumber": "13800138000",
      "receivedAt": "2024-06-27T10:30:00.000Z",
      "createdAt": "2024-06-27T10:31:00.000Z"
    },
    {
      "id": 2,
      "phoneNumber": "13900139000",
      "receivedAt": "2024-06-27T09:15:00.000Z",
      "createdAt": "2024-06-27T09:16:00.000Z"
    }
  ]
}
```

**字段说明**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 记录 ID |
| phoneNumber | string | 呼叫方电话号码 |
| receivedAt | string (ISO 8601) | 电话接收时间 |
| createdAt | string (ISO 8601) | 记录创建时间 |

**状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 401 | 未登录或会话过期 |
| 500 | 服务器内部错误 |

---

### 2.2 添加未接电话记录

添加一条新的未接电话记录。

**请求**

```http
POST /api/posts/mobile/calls/missed
Content-Type: application/json
```

**请求体**

```json
{
  "phone_number": "13800138000",
  "received_at": "2024-06-27T10:30:00.000Z"
}
```

**字段说明**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| phone_number | string | 是 | 呼叫方电话号码 |
| received_at | string (ISO 8601) | 否 | 电话接收时间，默认当前时间 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": 3
  }
}
```

**状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 缺少必填字段 |
| 401 | 未登录或会话过期 |
| 500 | 服务器内部错误 |

---

## 3. 数据库表结构

### 3.1 手机短信表 (mobile_sms)

```sql
CREATE TABLE mobile_sms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL COMMENT '电话号码',
  content TEXT NOT NULL COMMENT '短信内容',
  received_at DATETIME NOT NULL COMMENT '接收时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  INDEX idx_phone_number (phone_number),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='手机短信记录表';
```

### 3.2 未接电话表 (missed_calls)

```sql
CREATE TABLE missed_calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL COMMENT '电话号码',
  received_at DATETIME NOT NULL COMMENT '接收时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  INDEX idx_phone_number (phone_number),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='未接电话记录表';
```

---

## 4. 使用示例

### 4.1 JavaScript (浏览器)

```javascript
// 查询短信列表
async function getSmsList() {
  const response = await fetch('/api/posts/mobile/sms?limit=50');
  const result = await response.json();
  
  if (result.success) {
    console.log('短信列表:', result.data);
  } else {
    console.error('查询失败:', result.error);
  }
}

// 添加短信记录
async function addSms(phoneNumber, content, receivedAt) {
  const response = await fetch('/api/posts/mobile/sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      content: content,
      received_at: receivedAt || new Date().toISOString()
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('添加成功，ID:', result.data.id);
  } else {
    console.error('添加失败:', result.error);
  }
}
```

### 4.2 Python

```python
import requests
from datetime import datetime

# 配置
BASE_URL = 'http://localhost:3001'
SESSION_COOKIE = {'session': 'your_session_id'}  # 需要先登录获取 session

# 查询短信列表
def get_sms_list(limit=50):
    response = requests.get(
        f'{BASE_URL}/api/posts/mobile/sms',
        params={'limit': limit},
        cookies=SESSION_COOKIE
    )
    result = response.json()
    
    if result['success']:
        print(f'共 {len(result["data"])} 条短信')
        for sms in result['data']:
            print(f"{sms['phoneNumber']}: {sms['content']}")
    else:
        print(f'查询失败：{result["error"]}')

# 添加短信记录
def add_sms(phone_number, content, received_at=None):
    if received_at is None:
        received_at = datetime.now().isoformat()
    
    response = requests.post(
        f'{BASE_URL}/api/posts/mobile/sms',
        json={
            'phone_number': phone_number,
            'content': content,
            'received_at': received_at
        },
        cookies=SESSION_COOKIE
    )
    result = response.json()
    
    if result['success']:
        print(f'添加成功，ID: {result["data"]["id"]}')
    else:
        print(f'添加失败：{result["error"]}')

# 示例
get_sms_list()
add_sms('13800138000', '这是一条测试短信')
```

### 4.3 cURL

```bash
# 查询短信列表
curl -X GET "http://localhost:3001/api/posts/mobile/sms?limit=50" \
  -H "Cookie: session=your_session_id"

# 添加短信记录
curl -X POST "http://localhost:3001/api/posts/mobile/sms" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_id" \
  -d '{
    "phone_number": "13800138000",
    "content": "这是一条测试短信",
    "received_at": "2024-06-27T10:30:00.000Z"
  }'

# 查询未接电话列表
curl -X GET "http://localhost:3001/api/posts/mobile/calls/missed?limit=50" \
  -H "Cookie: session=your_session_id"

# 添加未接电话记录
curl -X POST "http://localhost:3001/api/posts/mobile/calls/missed" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_id" \
  -d '{
    "phone_number": "13800138000",
    "received_at": "2024-06-27T10:30:00.000Z"
  }'
```

---

## 5. 注意事项

1. **认证要求**: 所有 API 都需要先登录 Web 管理界面，使用 Session Cookie 进行认证
2. **时间格式**: 时间字段使用 ISO 8601 格式 (如：`2024-06-27T10:30:00.000Z`)
3. **字符编码**: 请求和响应都使用 UTF-8 编码
4. **分页查询**: 建议使用 `limit` 和 `offset` 参数进行分页查询
5. **数据清理**: 建议定期清理过期数据，避免数据库过大

---

## 6. 错误码说明

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| UNAUTHORIZED | 401 | 未登录或会话过期 |
| MISSING_FIELDS | 400 | 缺少必填字段 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 7. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2024-06-27 | 初始版本，提供短信和未接电话的增删查改功能 |
