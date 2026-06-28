# 发帖模式说明

## 重要变更

**自 v2.1.0 版本起，定时发帖功能已移除，所有发帖动作由外部 autojs 脚本触发。**

## 架构说明

当前服务采用 API 触发模式：

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  AutoJS 脚本  │ ──→  │  远程 API     │ ──→  │  帖子内容    │
│  (手机端)    │      │  (服务端)    │      │  (返回)      │
└──────────────┘      └──────────────┘      └──────────────┘
```

## 服务职责

服务本身**不执行**发帖动作，只负责：
1. 接收 autojs 的调用请求
2. 执行发帖逻辑（内容生成、素材选择、合规检查等）
3. 返回帖子内容供 autojs 发布

## API 端点

### 生成帖子内容

```http
POST /api/posts/generate
Authorization: Bearer <api-token>
Content-Type: application/json

{
  "mode": "featured",      // 发帖模式：featured | normal
  "useTopic": true,        // 是否使用主题
  "topicId": "xxx"         // 指定主题 ID（可选）
}
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "taskId": "post_xxx",
    "title": "帖子标题",
    "content": "帖子内容",
    "images": [
      { "url": "...", "path": "..." }
    ],
    "mode": "featured",
    "topics": [...],
    "metadata": {
      "topicId": "xxx",
      "topicTitle": "主题名称",
      "subDirectionIndex": 0,
      "generatedAt": "2026-06-28T12:00:00.000Z"
    }
  }
}
```

## autojs 调用流程

1. **请求生成内容**: 调用 `/api/posts/generate` 获取帖子内容
2. **下载图片**: 从返回的 `images` 数组下载图片到本地
3. **发布帖子**: 使用 autojs 的 API 发布到社区
4. **回调确认**: 调用 `/api/posts/confirm` 通知服务端发布结果

## 配置说明

### 调度器配置

`scheduler_config` 表中的发帖相关字段已废弃但保留：
- `post_cron`
- `post_random_offset_min`
- `post_random_offset_max`

这些字段不再被读取和使用，未来版本将删除。

### API Token 配置

需要在数据库中配置 API Token 供 autojs 调用：
```sql
INSERT INTO api_config (`mode`, `api_token`) VALUES ('api', 'your-token-here');
```

## 迁移指南

如果你之前使用定时发帖功能：

1. **停止定时任务**: 系统不再执行定时发帖
2. **配置 autojs**: 按照 autojs 文档配置远程 API 调用
3. **测试 API**: 使用 Postman 或 curl 测试 `/api/posts/generate` 端点
4. **监控日志**: 观察服务端日志确认 API 调用正常

## 常见问题

**Q: 为什么移除定时发帖功能？**  
A: 所有发帖动作由外部 autojs 脚本触发更灵活，可以更好地控制发帖时机和频率。

**Q: 还能自动发帖吗？**  
A: 可以，但需要通过 autojs 脚本调用 API 来实现，而不是服务端定时任务。

**Q: 配置表中的发帖配置还有用吗？**  
A: 已废弃，不再使用。保留是为了兼容性，未来版本会删除。

## 相关文档

- [AUTOJS_API_USAGE.md](./AUTOJS_API_USAGE.md) - AutoJS API 使用指南
- [REMOTE_POST_API.md](./REMOTE_POST_API.md) - 远程发帖 API 文档

---

**文档更新时间**: 2026-06-28  
**版本**: v2.1.0
