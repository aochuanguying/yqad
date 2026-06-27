# AutoJS API 远程发帖使用说明

## 概述

手工发帖功能现已修改为通过 AutoJS API Service 远程执行脚本的方式实现。当用户在 Web 管理页面点击"立即发帖"按钮时，系统会调用 AutoJS API 执行 `audi_post.js` 脚本，该脚本会在手机上运行并调用发帖 API 进行发帖。

## 架构说明

```
┌──────────────────┐      AutoJS API       ┌─────────────────┐
│  Web 管理页面     │ ◄───────────────────► │  AutoJS API     │
│  (点击立即发帖)   │    Port: 8899        │  Server         │
└──────────────────┘                       └────────┬────────┘
                                                    │
                                             执行 audi_post.js
                                                    │
                                             ┌──────▼────────┐
                                             │  AutoJS6      │
                                             │  脚本引擎     │
                                             └──────┬────────┘
                                                    │
                                           调用发帖 API 并回调
                                                    │
                                             ┌──────▼────────┐
                                             │  发帖服务     │
                                             │  更新日志     │
                                             └───────────────┘
```

## 配置说明

### 1. AutoJS API 配置

在 `config/default.yaml` 中配置 AutoJS API 服务信息：

```yaml
autojsApi:
  enabled: true                          # 是否启用 AutoJS API
  baseUrl: "http://192.168.50.149:8899"  # AutoJS API 服务器地址
  apiToken: "api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2"
  postScript: "audi_post.js"             # 发帖脚本名称
```

### 2. 环境变量（可选）

也可以通过环境变量配置：

```bash
export AUTOJS_API_ENABLED=true
export AUTOJS_API_BASE_URL="http://192.168.50.149:8899"
export AUTOJS_API_TOKEN="api_token_xxx"
export AUTOJS_API_POST_SCRIPT="audi_post.js"
```

## 使用流程

### 1. 手工发帖

1. 登录 Web 管理页面
2. 进入"📝 发帖管理"标签页
3. 点击"立即发帖"按钮
4. 系统会调用 AutoJS API 执行 `audi_post.js` 脚本
5. 脚本在手机上运行，自动完成发帖流程
6. 发帖成功后，脚本会回调服务端的发帖成功 API
7. 系统更新发帖日志状态

### 2. 发帖日志

发帖日志会记录以下信息：

- **触发方式**: `manual` (手动)
- **发帖类型**: `topic` (主题发帖) 或 `free` (自由发帖)
- **状态**: `pending` (等待回调) → `success` (成功) 或 `failed` (失败)
- **发帖详情**: 标题、内容、图片等（回调后更新）

可以在 Web 管理页面的"📝 发帖日志"标签页查看。

## API 接口

### 1. 手工发帖接口

**接口**: `POST /api/posts/execute`

**鉴权**: 使用 Session 登录状态

**响应**:
```json
{
  "success": true,
  "message": "脚本执行成功，发帖任务已启动",
  "data": {
    "script": "audi_post.js",
    "sync": false
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "AutoJS API 服务未启用",
  "code": "SERVICE_NOT_ENABLED"
}
```

### 2. AutoJS 回调接口

**接口**: `POST /api/posts/autojs/callback`

**鉴权**: 使用 API Token (Bearer Token)

**请求体**:
```json
{
  "taskId": "autojs_1234567890",
  "success": true,
  "title": "我的奥迪 Q5L 使用体验",
  "content": "这是一篇详细的用车体验分享...",
  "imageUrls": ["http://example.com/image1.jpg"],
  "topicId": "topic_123",
  "topicName": "用车体验",
  "mode": "normal"
}
```

**响应**:
```json
{
  "success": true,
  "message": "回调成功"
}
```

## 故障排查

### 1. AutoJS API 服务不可用

**错误**: `AutoJS API 服务不可用：Connection refused`

**解决**:
- 检查 AutoJS API 服务是否运行：`adb shell ps | grep python`
- 检查端口是否监听：`adb shell netstat -tlnp | grep 8899`
- 重启服务：`adb shell "su -c 'pkill -f autojs-api-server.py; python3 /sdcard/autojs-api-server.py &'"`

### 2. 脚本执行失败

**错误**: `远程脚本执行失败：Script not found`

**解决**:
- 检查脚本是否存在：`adb shell ls /sdcard/脚本/audi_post.js`
- 检查脚本名称是否与配置一致
- 查看 AutoJS 日志：`adb shell logcat | grep AutoJS`

### 3. 回调失败

**现象**: 发帖成功但日志状态一直为 `pending`

**解决**:
- 检查 AutoJS 脚本是否正确调用回调 API
- 检查 API Token 是否正确
- 查看服务端日志：`cat logs/app.log | grep autojs`

## 注意事项

1. **网络连通性**: 确保 AutoJS API 服务器能被服务端访问
2. **Token 安全**: 妥善保管 API Token，不要泄露
3. **并发控制**: 发帖任务有并发控制，同一时间只能有一个发帖任务在执行
4. **日志清理**: 发帖日志会保留 30 天，最多 1000 条
5. **超时处理**: 如果 AutoJS 脚本执行异常未回调，待确认记录过期时（30 分钟）会自动将日志状态标记为 `failed`

## 相关文件

- **AutoJS API 客户端**: `src/utils/autojs-api-client.ts`
- **手工发帖路由**: `src/web/routes/posts-routes.ts` (POST /api/posts/execute)
- **回调接口路由**: `src/web/routes/posts-routes.ts` (POST /api/posts/autojs/callback)
- **配置**: `config/default.yaml`
- **AutoJS API 文档**: `docs/API 文档.md`
- **AutoJS6 使用指南**: `docs/AUTOJS6_USAGE.md`
