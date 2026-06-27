# 发帖回调使用指南

## 完整流程

### 1. 生成发帖内容

**请求：**
```bash
POST http://localhost:3000/api/posts/generate
Authorization: Bearer <your-api-token>
Content-Type: application/json

{
  "useTopic": true,
  "mode": "featured"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "taskId": "post_1718362800000_abc123",  // ← 重要：保存此 taskId
    "title": "奥迪 A4L 驾驶体验分享",
    "content": "今天想和大家分享一下我的奥迪 A4L 驾驶体验...",
    "images": [
      {
        "url": "http://localhost:3000/images/topic1/img1.jpg",
        "relativePath": "topic1/img1.jpg",
        "filename": "img1.jpg"
      }
    ],
    "mode": "featured",
    "topics": [
      {
        "id": "hot_topic_123",
        "name": "用车心得"
      }
    ],
    "metadata": {
      "topicId": "topic_abc123",
      "topicTitle": "奥迪用车分享",
      "subDirectionIndex": 0,
      "generatedAt": "2026-06-14T10:00:00.000Z"
    }
  }
}
```

### 2. 下载图片

```bash
# 下载所有图片
curl -O "http://localhost:3000/images/topic1/img1.jpg" \
  -H "Authorization: Bearer <your-api-token>"
```

### 3. 发布到社区

使用你的自动化脚本或手动发布到社区：

```javascript
// 示例：使用自动化脚本发布
async function publishToCommunity(title, content, images) {
  // 这里实现你的发布逻辑
  // 例如：使用 Puppeteer 控制浏览器发布
  // 或者调用其他自动化接口
  
  // 发布成功后返回帖子 ID
  const postId = await doPublish(title, content, images);
  return postId;
}
```

### 4. 回调确认发布成功

**发布成功时：**
```bash
POST http://localhost:3000/api/posts/confirm
Authorization: Bearer <your-api-token>
Content-Type: application/json

{
  "taskId": "post_1718362800000_abc123",  // 使用步骤 1 返回的 taskId
  "postId": "community_post_456",          // 实际发布的帖子 ID（可选）
  "success": true
}
```

**响应：**
```json
{
  "success": true,
  "topicId": "topic_abc123",
  "remainingUses": 2
}
```

**发布失败时：**
```bash
POST http://localhost:3000/api/posts/confirm
Authorization: Bearer <your-api-token>
Content-Type: application/json

{
  "taskId": "post_1718362800000_abc123",
  "success": false  // 发布失败，不扣减主题次数
}
```

**响应：**
```json
{
  "success": true,
  "message": "已记录失败，未扣减次数"
}
```

## 关键要点

### 1. taskId 的重要性
- `taskId` 是待确认记录的唯一标识
- 必须在生成内容后保存 `taskId`
- 回调时必须传递正确的 `taskId`
- `taskId` 有效期为 **30 分钟**

### 2. 回调时机
- **发布成功后立即回调**：确保主题次数准确扣减
- **发布失败也要回调**：虽然不扣减次数，但服务端会清理待确认记录
- **不要重复回调**：同一 `taskId` 只能回调一次

### 3. 错误处理

**常见错误：**

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| `TASK_NOT_FOUND` | taskId 不存在或已过期 | 检查 taskId 是否正确，是否超过 30 分钟 |
| `MISSING_TASK_ID` | 缺少 taskId 参数 | 确保请求体包含 taskId 字段 |
| `INVALID_SUCCESS` | success 参数格式错误 | 确保 success 是布尔值（true/false） |
| `TOPIC_NOT_FOUND` | 主题不存在 | 检查主题 ID 是否正确 |

### 4. 完整示例代码

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const API_TOKEN = 'your-api-token';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json'
};

async function generateAndPost() {
  try {
    // 1. 生成发帖内容
    console.log('步骤 1: 生成发帖内容...');
    const genResponse = await axios.post(
      `${API_BASE}/posts/generate`,
      {
        useTopic: true,
        mode: 'featured'
      },
      { headers }
    );

    if (!genResponse.data.success) {
      throw new Error('内容生成失败：' + genResponse.data.error);
    }

    const { taskId, title, content, images, metadata } = genResponse.data.data;
    console.log(`✓ 生成成功，taskId: ${taskId}`);
    console.log(`  标题：${title}`);
    console.log(`  图片：${images.length} 张`);

    // 2. 下载图片
    console.log('步骤 2: 下载图片...');
    const imagePaths = [];
    for (const image of images) {
      const imgResponse = await axios.get(image.url, {
        headers,
        responseType: 'arraybuffer'
      });
      const imagePath = `/tmp/${image.filename}`;
      require('fs').writeFileSync(imagePath, imgResponse.data);
      imagePaths.push(imagePath);
      console.log(`  ✓ 下载：${image.filename}`);
    }

    // 3. 发布到社区
    console.log('步骤 3: 发布到社区...');
    const postId = await publishToCommunity(title, content, imagePaths);
    console.log(`✓ 发布成功，社区帖子 ID: ${postId}`);

    // 4. 回调确认
    console.log('步骤 4: 回调确认...');
    const confirmResponse = await axios.post(
      `${API_BASE}/posts/confirm`,
      {
        taskId: taskId,
        postId: postId,
        success: true
      },
      { headers }
    );

    if (confirmResponse.data.success) {
      console.log('✓ 回调成功');
      if (confirmResponse.data.topicId) {
        console.log(`  主题：${confirmResponse.data.topicId}`);
        console.log(`  剩余次数：${confirmResponse.data.remainingUses}`);
      }
    } else {
      console.error('✗ 回调失败:', confirmResponse.data.error);
    }

  } catch (error) {
    console.error('发生错误:', error.message);
    // 如果发布失败，也要回调告知服务端
    if (error.taskId) {
      await axios.post(
        `${API_BASE}/posts/confirm`,
        {
          taskId: error.taskId,
          success: false
        },
        { headers }
      );
    }
    throw error;
  }
}

// 模拟发布函数（替换为你的实际发布逻辑）
async function publishToCommunity(title, content, images) {
  // 这里实现你的自动化发布逻辑
  // 例如：使用 Puppeteer、Appium 等
  console.log('  模拟发布:', title);
  return 'community_post_' + Date.now();
}

// 执行
generateAndPost().catch(console.error);
```

## 批量发帖流程

批量发帖（`POST /api/posts/batch`）的流程类似，但需要：
1. 为每篇生成的内容分别回调
2. 每篇内容有独立的 `taskId`
3. 可以并发回调，也可以顺序回调

```javascript
// 批量发帖示例
async function batchGenerateAndPost(count = 3) {
  // 1. 批量生成
  const batchResponse = await axios.post(
    `${API_BASE}/posts/batch`,
    { count, useTopic: true, mode: 'featured' },
    { headers }
  );
  
  const taskId = batchResponse.data.taskId;
  
  // 2. 等待任务完成
  let task;
  do {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusResponse = await axios.get(
      `${API_BASE}/posts/tasks/${taskId}`,
      { headers }
    );
    task = statusResponse.data;
  } while (task.status === 'pending' || task.status === 'processing');
  
  // 3. 对每篇内容分别发布和回调
  for (const post of task.results) {
    const { taskId: postTaskId, title, content, images } = post;
    
    // 发布...
    const postId = await publishToCommunity(title, content, images);
    
    // 回调...
    await axios.post(
      `${API_BASE}/posts/confirm`,
      { taskId: postTaskId, postId, success: true },
      { headers }
    );
  }
}
```

## 注意事项

1. **taskId 有效期**：生成内容后 30 分钟内必须回调，过期自动清理
2. **重复回调**：同一 taskId 不能回调两次，会返回 404 错误
3. **发布失败处理**：发布失败也要回调（success: false），避免待确认记录堆积
4. **网络异常**：回调接口调用失败时，应重试直到成功
5. **主题剩余额度**：回调响应中会返回 `remainingUses`，可用于监控主题使用情况
