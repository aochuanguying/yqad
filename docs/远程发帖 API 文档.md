# 远程发帖 API 文档

## 概述

远程发帖 API 允许手机端通过 HTTP 接口获取发帖内容（标题、正文、图片下载地址），然后由手机端模拟人工发布到社区。这种模式可以触发社区的奖励任务系统。

**重要更新**：现已支持发帖成功回调机制，确保主题使用次数准确扣减。

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: Bearer Token
- **频率限制**: 每小时 10 次请求
- **回调机制**: 生成内容后不扣减次数，需客户端发布成功后回调确认

## 认证

所有 API 请求需要在 Header 中携带独立的 API Token（与登录 Token 分离）：

```http
Authorization: Bearer <api-token>
```

### 获取 API Token

1. 登录 Web 管理界面（`http://localhost:3000`）
2. 点击 "🔑 API Token" Tab
3. 点击 "✨ 生成 Token" 按钮
4. 复制生成的 Token 并妥善保管（Token 仅显示一次）

### Token 特点

- **长期有效**：不受登录 Token 刷新影响
- **独立管理**：可随时重置，旧 Token 立即失效
- **安全存储**：Token 存储在 `data/api-token.json`，文件权限 600

### 注意事项

⚠️ **重要**：不要将 API Token 与登录 Token 混淆。登录 Token（JWT 格式）无法用于远程发帖 API。

## API 端点

### 1. 生成单篇发帖内容

**端点**: `POST /posts/generate`

**请求参数**:
```typescript
interface GeneratePostRequest {
  useTopic?: boolean;        // 是否使用预配置主题（默认 true）
  mode?: 'featured' | 'normal'; // 发帖模式（可选）
  topicId?: string;          // 指定主题 ID（可选）
}
```

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/posts/generate \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "useTopic": true,
    "mode": "featured"
  }'
```

**响应示例** (成功):
```json
{
  "success": true,
  "data": {
    "title": "奥迪 Q5L 保养全攻略，这些坑千万别踩！",
    "content": "作为一名奥迪 Q5L 车主，今天给大家分享一下保养经验...",
    "images": [
      {
        "url": "http://localhost:3000/images/topic1/image1.jpg",
        "relativePath": "topic1/image1.jpg",
        "filename": "image1.jpg",
        "size": 245678
      },
      {
        "url": "http://localhost:3000/images/topic1/image2.jpg",
        "relativePath": "topic1/image2.jpg",
        "filename": "image2.jpg",
        "size": 198765
      }
    ],
    "mode": "featured",
    "topics": [
      {"id": "123", "name": "#奥迪 Q5L#"},
      {"id": "456", "name": "#保养攻略#"}
    ],
    "metadata": {
      "topicId": "abc123",
      "topicTitle": "奥迪 Q5L 用车分享",
      "subDirectionIndex": 0,
      "generatedAt": "2026-06-11T10:30:00.000Z"
    }
  }
}
```

**响应示例** (失败):
```json
{
  "success": false,
  "error": "标题去重失败",
  "code": "GENERATION_FAILED"
}
```

### 2. 批量生成发帖内容

**端点**: `POST /posts/batch`

**请求参数**:
```typescript
interface BatchPostRequest {
  count: number;             // 生成数量（1-5）
  useTopic?: boolean;        // 是否使用主题
  mode?: 'featured' | 'normal'; // 发帖模式
}
```

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/posts/batch \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 3,
    "mode": "featured"
  }'
```

**响应示例**:
```json
{
  "success": true,
  "taskId": "task_1718078400000_abc123",
  "status": "pending",
  "progress": {
    "total": 3,
    "completed": 0
  }
}
```

### 3. 发帖成功回调

**端点**: `POST /api/posts/confirm`

**说明**: 客户端发布成功后调用此端点，服务端会扣减对应主题的使用次数。如果发布失败，也应调用此端点（success: false），服务端不会扣减次数。

**请求参数**:
```typescript
interface ConfirmPostRequest {
  taskId: string;            // 生成内容时返回的 taskId（必填）
  postId?: string;           // 实际发布的帖子 ID（可选）
  success: boolean;          // 发布是否成功（必填）
}
```

**响应示例** (成功回调):
```json
{
  "success": true,
  "topicId": "abc123",
  "remainingUses": 2
}
```

**响应示例** (发布失败):
```json
{
  "success": true,
  "message": "已记录失败，未扣减次数"
}
```

**错误示例**:
```json
{
  "success": false,
  "error": "任务不存在或已过期",
  "code": "TASK_NOT_FOUND"
}
```

**注意事项**:
- taskId 有效期为 30 分钟，过期自动清理
- 重复调用同一 taskId 会返回 404 错误
- 自由模式发帖（无主题）不会扣减次数

### 4. 查询异步任务状态

**端点**: `GET /posts/tasks/:id`

**路径参数**:
- `id`: 任务 ID（从批量生成响应中获取）

**请求示例**:
```bash
curl -X GET http://localhost:3000/api/posts/tasks/task_1718078400000_abc123 \
  -H "Authorization: Bearer your-token"
```

**响应示例** (进行中):
```json
{
  "success": true,
  "taskId": "task_1718078400000_abc123",
  "status": "processing",
  "progress": {
    "total": 3,
    "completed": 1
  },
  "createdAt": "2026-06-11T10:30:00.000Z"
}
```

**响应示例** (已完成):
```json
{
  "success": true,
  "taskId": "task_1718078400000_abc123",
  "status": "completed",
  "progress": {
    "total": 3,
    "completed": 3
  },
  "results": [
    {
      "title": "帖子 1 标题",
      "content": "帖子 1 内容",
      "images": [...],
      "mode": "featured",
      "metadata": {...}
    },
    {
      "title": "帖子 2 标题",
      "content": "帖子 2 内容",
      "images": [...],
      "mode": "normal",
      "metadata": {...}
    }
  ],
  "createdAt": "2026-06-11T10:30:00.000Z",
  "completedAt": "2026-06-11T10:32:00.000Z"
}
```

## 错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 缺少或无效的 Token |
| `INVALID_TOKEN` | 401 | Token 格式错误 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INVALID_COUNT` | 400 | 批量生成数量参数无效 |
| `MISSING_TASK_ID` | 400 | 缺少 taskId 参数 |
| `INVALID_SUCCESS` | 400 | success 参数格式错误 |
| `TASK_NOT_FOUND` | 404 | 任务 ID 不存在或已过期 |
| `TOPIC_NOT_FOUND` | 400 | 主题不存在 |
| `GENERATION_FAILED` | 400 | 内容生成失败 |
| `DUPLICATE_CONTENT` | 400 | 内容与待确认记录重复 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

## 图片下载

所有返回的图片 URL 都是可公开访问的（需要 Token 认证），手机端可以直接下载：

```bash
curl -O "http://localhost:3000/images/topic1/image1.jpg" \
  -H "Authorization: Bearer your-token"
```

## 配置说明

在 `config/default.yaml` 中配置发帖模式：

```yaml
post:
  enabled: true
  mode: 'api'  # 'scheduled' 或 'api'
  dailyLimit: 1
  avoidRepeatDays: 7

web:
  enabled: true
  port: 3000
  baseUrl: "http://localhost:3000"  # 用于生成图片下载链接
```

## 使用流程

1. **配置模式**: 设置 `post.mode = 'api'`
2. **获取内容**: 调用 `POST /api/posts/generate` 获取发帖内容（返回 taskId）
3. **下载图片**: 从响应中提取图片 URL 并下载
4. **模拟发布**: 使用手机自动化发布到社区
5. **回调确认**: 发布成功后调用 `POST /api/posts/confirm` 扣减主题次数
6. **关联话题**: 可选地关联响应中推荐的话题

**重要**：生成内容后不会立即扣减主题使用次数，必须调用回调端点确认发布成功才会扣减。

## 注意事项

1. **Token 安全**: Token 需要妥善保管，避免泄露
2. **图片访问**: 确保服务端和手机端网络可达
3. **频率限制**: 每小时最多 10 次请求，避免触发限制
4. **任务过期**: 异步任务 30 分钟后自动清理
5. **精华模式**: 建议优先使用 `mode: 'featured'` 生成高质量内容

## 示例代码

### Node.js 示例

```javascript
const axios = require('axios');

async function generateAndPost() {
  // 1. 生成发帖内容
  const genResponse = await axios.post(
    'http://localhost:3000/api/posts/generate',
    {
      useTopic: true,
      mode: 'featured'
    },
    {
      headers: {
        'Authorization': 'Bearer your-token'
      }
    }
  );

  if (!genResponse.data.success) {
    throw new Error('内容生成失败：' + genResponse.data.error);
  }

  const { taskId, title, content, images } = genResponse.data.data;
  console.log('taskId:', taskId);
  console.log('标题:', title);
  console.log('内容:', content);
  console.log('图片数量:', images.length);
  
  // 2. 下载图片
  for (const image of images) {
    const imgResponse = await axios.get(image.url, {
      headers: { 'Authorization': 'Bearer your-token' },
      responseType: 'arraybuffer'
    });
    // 保存图片到本地...
  }
  
  // 3. 模拟发布到社区（这里使用你的自动化代码）
  const postId = await publishToCommunity(title, content, images);
  
  // 4. 回调确认发布成功
  const confirmResponse = await axios.post(
    'http://localhost:3000/api/posts/confirm',
    {
      taskId: taskId,
      postId: postId,
      success: true
    },
    {
      headers: {
        'Authorization': 'Bearer your-token'
      }
    }
  );
  
  if (confirmResponse.data.success) {
    console.log('✓ 回调成功，主题剩余次数:', confirmResponse.data.remainingUses);
  } else {
    console.error('回调失败:', confirmResponse.data.error);
  }
}

// 模拟发布函数
async function publishToCommunity(title, content, images) {
  // 这里实现你的自动化发布逻辑
  // 返回发布的帖子 ID
  return 'post_123456';
}

generateAndPost().catch(console.error);
```

### Python 示例

```python
import requests

def generate_post():
    headers = {
        'Authorization': 'Bearer your-token',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'useTopic': True,
        'mode': 'featured'
    }
    
    response = requests.post(
        'http://localhost:3000/api/posts/generate',
        headers=headers,
        json=payload
    )
    
    if response.json()['success']:
        data = response.json()['data']
        print(f"标题：{data['title']}")
        print(f"图片数：{len(data['images'])}")
        
        # 下载图片
        for image in data['images']:
            img_resp = requests.get(image['url'], headers=headers)
            with open(image['filename'], 'wb') as f:
                f.write(img_resp.content)

generate_post()
```

## 迁移指南

### 从登录 Token 迁移到 API Token

如果您之前使用登录 Token（JWT 格式）调用远程发帖 API，需要迁移到独立的 API Token：

#### 1. 生成新的 API Token

1. 登录 Web 管理界面
2. 进入 "API Token" Tab
3. 点击 "生成 Token" 按钮
4. 复制并保存生成的 Token

#### 2. 更新客户端配置

**Postman:**
- 打开 Postman 集合
- 在 Authorization 标签页中，将 Token 更新为新生成的 API Token
- 或者更新环境变量 `api_token`

**代码示例:**

```javascript
// ❌ 旧方式（使用登录 Token）
const loginToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
headers: { 'Authorization': `Bearer ${loginToken}` }

// ✅ 新方式（使用 API Token）
const apiToken = 'api_token_abc123...';
headers: { 'Authorization': `Bearer ${apiToken}` }
```

#### 3. 验证迁移

使用新 Token 测试 API 调用：

```bash
curl -X GET http://localhost:3000/api/config/api-token \
  -H "Authorization: Bearer api_token_your_new_token"
```

如果返回 Token 状态信息，说明迁移成功。

#### 4. 清理旧 Token

确认新 Token 工作正常后，建议：
- 删除代码中硬编码的旧登录 Token
- 更新所有使用该 API 的客户端配置
- 在 Web UI 中查看 Token 使用情况

### 常见问题

**Q: API Token 会过期吗？**
A: 不会，API Token 长期有效，除非手动重置。

**Q: 如果 API Token 泄露了怎么办？**
A: 立即在 Web UI 中重置 Token，旧 Token 会立即失效。

**Q: 可以同时使用登录 Token 和 API Token 吗？**
A: 不可以，远程发帖 API 仅接受独立的 API Token。登录 Token 仅用于 APP 接口调用。

**Q: 如何查看 API Token 的使用情况？**
A: 在 Web UI 的 "API Token" Tab 中可以查看最后使用时间。
