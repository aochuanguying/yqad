## 上下文

当前发帖系统采用服务端直接调用奥迪 API 的方式发布帖子，但这种模式无法触发社区的奖励任务系统。我们已通过手机自动化实现了模拟人工发帖，现在需要将服务端角色从"执行者"转变为"内容提供者"。

**当前架构：**
```
Scheduler → AutoPostService → 生成内容 → 上传图片 → 调用 API 发布
```

**目标架构：**
```
手机端触发 → 服务端 API → 生成内容 → 返回（标题、正文、图片下载地址）→ 手机端下载并发布
```

**约束条件：**
- 保留所有核心发帖逻辑（主题选择、内容生成、图片匹配、精华策略）
- 图片需要提供 HTTP 可访问的下载链接
- API 需要鉴权机制，确保只有授权设备可调用
- 支持同步和异步两种发帖模式

## 目标 / 非目标

**目标：**
- 提供 RESTful API 供手机端远程调用生成发帖内容
- 图片通过 HTTP 服务提供下载，不上传至奥迪服务器
- 取消定时发帖任务，改为 API 触发
- 保留主题管理、内容生成、图片匹配等核心逻辑
- 支持精华帖和普通帖两种模式
- 提供 API 鉴权机制

**非目标：**
- 不改变现有的主题管理逻辑
- 不改变 AI 内容生成算法
- 不改变图片选择和匹配策略
- 不改变精华帖评估标准
- 不涉及手机端自动化实现细节

## 决策

### 1. API 设计模式

**决策：** 采用 RESTful 风格，提供同步和异步两种发帖接口

**理由：**
- 同步模式：快速返回，适合单次发帖（`POST /api/posts/generate`）
- 异步模式：支持批量生成，通过任务 ID 查询结果（`POST /api/posts/batch` + `GET /api/posts/tasks/:id`）

**考虑过的替代方案：**
- WebSocket：实时性好但实现复杂，手机端连接管理成本高
- GraphQL：灵活但过度设计，RESTful 已满足需求

### 2. 图片下载服务

**决策：** 在现有 Web Server 中增加静态文件服务，通过 `/images/:path` 提供下载

**理由：**
- 复用现有 Web Server（端口 3000）
- 无需额外部署图片服务器
- 可直接访问本地素材库文件

**实现方案：**
```typescript
// 新增路由
app.use('/images', express.static(config.materials.processedPath));

// 返回格式
{
  imageUrl: "http://server:3000/images/relative/path.jpg"
}
```

**考虑过的替代方案：**
- CDN 分发：成本高���当前不需要
- 临时签名 URL：安全性好但实现复杂，后续可增强
- Base64 编码：传输效率低，不适合多图片场景

### 3. API 鉴权机制

**决策：** 使用 Token 鉴权，与现有会员系统共用 token 表

**理由：**
- 复用现有的 `data/token.json` 存储
- 手机端可通过验证接口获取 token
- 简单有效，满足当前安全需求

**实现方案：**
```typescript
// 请求头
Authorization: Bearer <device-token>

// 中间件验证
function verifyDeviceToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  // 验证 token 有效性
}
```

### 4. 发帖模式切换

**决策：** 通过配置项 `post.mode` 控制发帖触发方式（`'scheduled'` | `'api'`）

**理由：**
- 向后兼容，可平滑切换
- 支持混合模式（部分定时 + 部分 API）
- 配置简单，无需代码修改

**配置方案：**
```yaml
post:
  enabled: true
  mode: 'api'  # 'scheduled' 或 'api'
  dailyLimit: 1
```

### 5. 数据结构设计

**决策：** 发帖内容返回包含完整元数据，支持手机端直接使用

**响应结构：**
```typescript
interface GeneratePostResponse {
  success: boolean;
  data?: {
    postId?: string;           // 异步任务 ID
    title: string;             // 帖子标题
    content: string;           // 帖子正文
    images: ImageInfo[];       // 图片信息
    mode: 'featured' | 'normal'; // 发帖模式
    topics?: MatchedTopic[];   // 推荐话题
    metadata: {
      topicId?: string;        // 使用的主题 ID
      topicTitle?: string;     // 主题标题
      subDirectionIndex?: number; // 子方向索引
      generatedAt: string;     // 生成时间
    };
  };
  error?: string;
}

interface ImageInfo {
  url: string;               // 下载 URL
  relativePath: string;      // 相对路径
  filename: string;          // 文件名
  size?: number;             // 文件大小
}
```

## 风险 / 权衡

### 风险 1：图片下载安全性

**风险：** 公开的图片下载接口可能被恶意爬取或滥用

**缓解措施：**
- 初期：通过 Token 鉴权限制访问
- 中期：实现临时签名 URL（有效期 5 分钟）
- 长期：考虑 CDN + Referer 白名单

### 风险 2：网络延迟影响体验

**风险：** 手机端需要下载多张图片，网络慢时延迟高

**缓解措施：**
- 图片压缩：提供压缩后的版本（质量 80%）
- 并行下载：手机端可同时下载多张
- 缓存策略：相同图片缓存复用

### 风险 3：异步任务状态管理

**风险：** 任务队列积累导致内存占用过高

**缓解措施：**
- 任务过期：30 分钟后自动清理
- 并发限制：最多同时处理 5 个任务
- 持久化：重要任务写入文件

### 风险 4：API 被未授权调用

**风险：** 发帖接口被恶意调用导致资源浪费

**缓解措施：**
- Token 鉴权：必须提供有效 token
- 频率限制：每设备每小时最多 10 次
- IP 白名单：可选配置

## 迁移计划

### 阶段 1：新增 API 接口（向后兼容）
- 新增 `POST /api/posts/generate`
- 新增图片下载路由
- 保留定时发帖任务

### 阶段 2：切换发帖模式
- 修改配置文件：`post.mode = 'api'`
- 禁用定时任务
- 测试 API 调用流程

### 阶段 3：清理废弃代码
- 移除定时发帖相关代码
- 移除图片上传到奥迪服务器的逻辑
- 文档更新

## Open Questions

1. **图片压缩策略**：是否需要提供原图和压缩图两个版本？
   - 建议：初期只提供原图，根据实际使用情况决定

2. **批量发帖支持**：是否需要一次生成多篇帖子？
   - 建议：初期支持单次生成，后续通过异步任务支持批量

3. **话题关联**：手机端是否需要话题 ID 来关联话题？
   - 建议：返回推荐话题列表，手机端可选关联

4. **日志记录**：API 调用日志是否需要单独存储？
   - 建议：复用现有日志系统，增加 `api-call` 标签
