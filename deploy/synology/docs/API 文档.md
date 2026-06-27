# AutoJS API Service 文档

## 服务简介

AutoJS API Service 是一个基于 Python HTTP 服务器的远程脚本执行服务，允许通过 RESTful API 远程调用 AutoJS6 脚本。

## 部署架构

```
┌──────────────┐      HTTP API       ┌─────────────┐
│   客户端      │ ◄─────────────────► │  Python     │
│  (curl/SDK)  │   Port: 8899        │  HTTP Server│
└──────────────┘                     └──────┬──────┘
                                            │
                                     调用 AutoJS6
                                            │
                                     ┌──────▼──────┐
                                     │  AutoJS6    │
                                     │  脚本引擎   │
                                     └─────────────┘
```

## 配置信息

| 配置项 | 值 |
|--------|-----|
| **服务端口** | 8899 |
| **脚本目录** | `/sdcard/脚本` |
| **AutoJS 包名** | `org.autojs.autojs6` |
| **认证 Token** | `api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2` |

## API 接口

### 1. 健康检查

**接口**: `GET /api/health`

**响应**:
```json
{
  "success": true,
  "message": "Service is running"
}
```

### 2. 获取脚本列表

**接口**: `GET /api/scripts`

**响应**:
```json
{
  "success": true,
  "data": {
    "scripts": [
      "audi_signin.js",
      "common_utils.js"
    ]
  }
}
```

### 3. 执行脚本

**接口**: `POST /api/execute`

**请求头**:
```
Authorization: Bearer api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2
Content-Type: application/json
```

**请求体**:
```json
{
  "script": "audi_signin.js",
  "sync": false
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `script` | string | ✓ | 脚本文件名（相对于 `/sdcard/脚本` 目录） |
| `sync` | boolean | ✗ | 是否同步等待执行完成（默认：false） |

**成功响应**:
```json
{
  "success": true,
  "message": "脚本执行成功",
  "data": {
    "script": "audi_signin.js",
    "sync": false
  }
}
```

**失败响应**:
```json
{
  "success": false,
  "message": "错误信息"
}
```

## 使用示例

### cURL

```bash
# 健康检查
curl http://192.168.50.149:8899/api/health

# 获取脚本列表
curl http://192.168.50.149:8899/api/scripts

# 执行脚本（异步）
curl -X POST \
  -H "Authorization: Bearer api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2" \
  -H "Content-Type: application/json" \
  -d '{"script":"audi_signin.js","sync":false}' \
  http://192.168.50.149:8899/api/execute

# 执行脚本（同步等待完成）
curl -X POST \
  -H "Authorization: Bearer api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2" \
  -H "Content-Type: application/json" \
  -d '{"script":"audi_signin.js","sync":true}' \
  http://192.168.50.149:8899/api/execute
```

### Python

```python
import requests

BASE_URL = "http://192.168.50.149:8899"
API_TOKEN = "api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# 健康检查
response = requests.get(f"{BASE_URL}/api/health")
print(response.json())

# 执行脚本
response = requests.post(
    f"{BASE_URL}/api/execute",
    headers=headers,
    json={"script": "audi_signin.js", "sync": False}
)
print(response.json())
```

### Shell 脚本

```bash
#!/bin/bash

API_TOKEN="api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2"
API_SERVER="http://192.168.50.149:8899"

execute_script() {
    local script=$1
    curl -X POST \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"script\":\"$script\",\"sync\":false}" \
        "$API_SERVER/api/execute"
}

# 执行签到
execute_script "audi_signin.js"
```

## 安全认证

所有 API 请求（除健康检查外）都需要在请求头中携带 Bearer Token：

```
Authorization: Bearer api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2
```

## 服务管理

```bash
# 查看服务状态
adb shell ps | grep python

# 查看日志
adb shell cat /sdcard/autojs-api.log

# 重启服务
adb shell "su -c 'pkill -f autojs-api-server.py; python3 /sdcard/autojs-api-server.py &'"
```

## 开机自启动

服务已配置开机自启动，通过 Magisk 服务脚本实现：
- 脚本位置：`/data/adb/service.d/autojs-api-service.sh`
- 看门狗监控：每 30 秒检查服务状态，异常时自动重启

## 故障排查

### 1. 服务无法访问
```bash
# 检查端口监听
adb shell "su -c 'netstat -tlnp | grep 8899'"

# 检查防火墙
adb shell "su -c 'iptables -L'"
```

### 2. 脚本执行失败
```bash
# 查看 AutoJS 日志
adb shell logcat | grep AutoJS

# 查看 API 日志
adb shell cat /sdcard/autojs-api.log
```

### 3. 解锁失败
如果脚本执行时卡在锁屏界面，检查 `common_utils.js` 中的 `prepareDevice` 方法是否适配当前设备。
