# Android Telecom API

在已 root 的 Android 设备上提供电话和短信功能的 HTTP REST API 服务。

## 功能特性

- ✅ 拨打电话
- ✅ 发送短信
- ✅ 获取短信收件箱
- ✅ 获取通话记录
- ✅ 获取设备信息
- 🔒 API Token 认证
- 📝 日志记录
- 🔄 后台服务运行

## 系统要求

- Android 设备（已 root）
- Termux 应用
- Android 15 兼容

## 快速开始

### 1. 在 Termux 中克隆或下载代码

```bash
# 进入目录
cd android-telecom-api
```

### 2. 运行安装脚本

```bash
chmod +x install.sh
./install.sh
```

安装脚本会：
- 安装 Python 和依赖包
- 生成 API Token
- 创建服务管理脚本

### 3. 启动服务

```bash
chmod +x start-service.sh
./start-service.sh start
```

### 4. 检查服务状态

```bash
./start-service.sh status
```

## API 接口

### 认证方式

所有 API 请求需要在 Header 中携带 Bearer Token：

```
Authorization: Bearer YOUR_API_TOKEN
```

API Token 存储在：`$HOME/.telecom-api/api_token`

### API 端点

#### 1. 健康检查

```http
GET /health
```

响应示例：
```json
{
  "status": "ok",
  "service": "android-telecom-api",
  "root_access": true
}
```

#### 2. 拨打电话

```http
POST /api/v1/call
Content-Type: application/json

{
  "phone_number": "1234567890"
}
```

响应示例：
```json
{
  "success": true,
  "message": "Call initiated to 1234567890",
  "phone_number": "1234567890"
}
```

#### 3. 发送短信

```http
POST /api/v1/sms/send
Content-Type: application/json

{
  "phone_number": "1234567890",
  "message": "Hello World"
}
```

响应示例：
```json
{
  "success": true,
  "message": "SMS sent to 1234567890",
  "phone_number": "1234567890",
  "message_length": 11
}
```

#### 4. 获取短信收件箱

```http
GET /api/v1/sms/inbox?limit=10
```

参数：
- `limit` (可选): 返回数量，默认 10，最大 100

响应示例：
```json
{
  "success": true,
  "messages": [
    {
      "phone_number": "1234567890",
      "body": "Hello",
      "timestamp": "1234567890",
      "type": "received"
    }
  ],
  "count": 1
}
```

#### 5. 获取通话记录

```http
GET /api/v1/call/log?limit=10
```

参数：
- `limit` (可选): 返回数量，默认 10，最大 100

响应示例：
```json
{
  "success": true,
  "calls": [
    {
      "phone_number": "1234567890",
      "duration": "120",
      "timestamp": "1234567890",
      "type": "incoming"
    }
  ],
  "count": 1
}
```

#### 6. 获取设备信息

```http
GET /api/v1/device/info
```

响应示例：
```json
{
  "success": true,
  "device_info": {
    "model": "Pixel 8",
    "manufacturer": "Google",
    "android_version": "15",
    "sdk_version": "35",
    "phone_number": "1234567890"
  }
}
```

## 使用示例

### cURL 示例

```bash
# 定义变量
API_TOKEN="your-api-token-here"
BASE_URL="http://your-device-ip:5000"

# 拨打电话
curl -X POST "$BASE_URL/api/v1/call" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "1234567890"}'

# 发送短信
curl -X POST "$BASE_URL/api/v1/sms/send" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "1234567890", "message": "Hello from API"}'

# 获取短信
curl -X GET "$BASE_URL/api/v1/sms/inbox?limit=5" \
  -H "Authorization: Bearer $API_TOKEN"

# 获取通话记录
curl -X GET "$BASE_URL/api/v1/call/log?limit=5" \
  -H "Authorization: Bearer $API_TOKEN"

# 获取设备信息
curl -X GET "$BASE_URL/api/v1/device/info" \
  -H "Authorization: Bearer $API_TOKEN"
```

### Python 示例

```python
import requests

BASE_URL = "http://your-device-ip:5000"
API_TOKEN = "your-api-token-here"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# 拨打电话
response = requests.post(
    f"{BASE_URL}/api/v1/call",
    headers=headers,
    json={"phone_number": "1234567890"}
)
print(response.json())

# 发送短信
response = requests.post(
    f"{BASE_URL}/api/v1/sms/send",
    headers=headers,
    json={"phone_number": "1234567890", "message": "Hello"}
)
print(response.json())

# 获取短信
response = requests.get(
    f"{BASE_URL}/api/v1/sms/inbox?limit=5",
    headers=headers
)
print(response.json())
```

### Node.js 示例

```javascript
const axios = require('axios');

const BASE_URL = 'http://your-device-ip:5000';
const API_TOKEN = 'your-api-token-here';

const config = {
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

// 拨打电话
axios.post(`${BASE_URL}/api/v1/call`, {
  phone_number: '1234567890'
}, config)
.then(response => console.log(response.data))
.catch(error => console.error(error));

// 发送短信
axios.post(`${BASE_URL}/api/v1/sms/send`, {
  phone_number: '1234567890',
  message: 'Hello from Node.js'
}, config)
.then(response => console.log(response.data))
.catch(error => console.error(error));
```

## 服务管理命令

```bash
# 启动服务
./start-service.sh start

# 停止服务
./start-service.sh stop

# 重启服务
./start-service.sh restart

# 查看状态
./start-service.sh status

# 查看日志
./start-service.sh logs

# 查看 API Token
./start-service.sh token
```

## 网络配置

### 监听地址

服务默认监听 `0.0.0.0:5000`，允许局域网访问。

### 获取设备 IP

在 Termux 中运行：
```bash
ip addr show
# 或
ifconfig
```

### 防火墙设置

确保 Android 防火墙允许 5000 端口访问（如有需要）。

## 安全建议

1. **修改默认 API Token**
   ```bash
   # 生成新 Token
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   
   # 保存到配置文件
   echo "your-new-token" > ~/.telecom-api/api_token
   
   # 重启服务
   ./start-service.sh restart
   ```

2. **使用 HTTPS** (生产环境推荐)
   - 使用反向代理（如 nginx）
   - 配置 SSL 证书

3. **限制访问 IP**
   - 在路由器或防火墙层面限制
   - 只允许信任的 IP 访问

4. **定期查看日志**
   ```bash
   ./start-service.sh logs
   ```

## 故障排查

### 服务无法启动

```bash
# 查看日志
./start-service.sh logs

# 手动运行查看错误
python3 server.py
```

### Root 权限问题

确保 Termux 已获得 root 权限：
```bash
su -c "echo test"
```

### 数据库访问失败

不同 Android ROM 的短信/通话数据库路径可能不同：
- 短信：`/data/data/com.android.providers.telephony/databases/mmssms.db`
- 通话：`/data/data/com.android.providers.contacts/databases/calls.db`

可能需要根据实际路径修改 `server.py` 中的 SQL 查询命令。

### 端口被占用

修改监听端口：
```bash
export FLASK_RUN_PORT=5001
python3 server.py
```

或在 `server.py` 中修改 `app.run()` 的 port 参数。

## 高级配置

### 修改监听端口

编辑 `server.py`，找到最后一行：
```python
app.run(host='0.0.0.0', port=5000, debug=False)
```

修改 port 参数。

### 环境变量

- `TELECOM_API_TOKEN`: API 认证 Token
- `FLASK_ENV`: 运行环境（development/production）
- `FLASK_DEBUG`: 调试模式（0/1）

## 文件结构

```
android-telecom-api/
├── server.py           # 主服务器代码
├── install.sh          # 安装脚本
├── start-service.sh    # 服务管理脚本
└── README.md          # 说明文档
```

## 注意事项

⚠️ **重要提示**：

1. 此服务需要 root 权限
2. 请确保在安全的网络环境中使用
3. 不要将 API Token 泄露给他人
4. 生产环境建议使用 HTTPS
5. Android 15 可能对后台服务有限制，可能需要保持 Termux 在前台运行

## 许可证

MIT License

## 支持

如有问题，请查看日志文件或提交 issue。
