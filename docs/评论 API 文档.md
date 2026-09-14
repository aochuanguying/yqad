# 评论 API 文档

## 概述

评论 API 提供评论任务的触发、日志查询等能力。其中面向外部调用的接口（如查询今日评论状态）使用独立的 API Token 鉴权，与登录 Token 分离，鉴权方式与「远程发帖 API」完全一致。

## 基础信息

- **Base URL**: `http://localhost:3000/api`（生产环境为 `http://192.168.50.10:3080/api`）
- **认证方式**: Bearer Token（部分接口需要，见各端点说明）
- **响应格式**: 统一 JSON 包装格式 `{ success, data, ... }`

## 认证

需要鉴权的接口，请求 Header 中携带独立的 API Token（与登录 Token 分离，和远程发帖 API 使用同一个 Token）：

```http
Authorization: Bearer <api-token>
```

- 支持特殊值 `configured`：表示使用配置文件中已配置的 Token。
- 登录 Token（JWT 格式）无法用于本类接口，请勿混用。

获取 API Token 的方式详见《远程发帖 API 文档》的「获取 API Token」章节（Web 管理界面 → 🔑 API Token → 生成 Token）。

## API 端点

### 1. 查询今日是否有成功评论

判断当天是否至少有一条评论发布成功。常用于外部系统巡检当天评论任务是否已完成。

**端点**: `GET /comment/today-success`

**鉴权**: 需要（API Token）

**请求头**:
```http
Authorization: Bearer <api-token>
```

**请求参数**: 无

**成功响应** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "hasSuccess": true
  }
}
```

**响应字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 请求是否成功处理 |
| `data.hasSuccess` | boolean | `true`=今天至少有一条评论成功；`false`=今天没有成功评论（含今天尚未评论的情况） |

**"今天"的判定**：以数据库服务器日期为准（时区 `Asia/Shanghai`），按自然日 0 点起算（SQL 使用 `DATE(created_at) = CURDATE() AND success = 1`）。

**错误响应**:

| HTTP | 场景 | 响应体 |
|------|------|--------|
| 401 | 缺少 Authorization 头 | `{"error":"缺少 Authorization 头","code":"UNAUTHORIZED"}` |
| 401 | Token 格式无效 | `{"error":"Token 格式无效","code":"INVALID_TOKEN"}` |
| 401 | Token 无效 | `{"error":"Token 无效","code":"INVALID_TOKEN"}` |
| 500 | 服务器/数据库异常 | `{"success":false,"error":"...","code":"INTERNAL_ERROR"}` |

**调用示例**:
```bash
curl http://192.168.50.10:3080/api/comment/today-success \
  -H "Authorization: Bearer <你的API_TOKEN>"
```

---

### 2. 手动触发评论任务

同步执行一次评论任务，只评论 1 条，不启动调度。

**端点**: `POST /comment/execute`

**鉴权**: 无（基于 Session 登录状态 / 系统内部访问）

**请求参数**: 无

**成功响应** (HTTP 200):
```json
{
  "success": true,
  "message": "评论任务执行完成",
  "data": {
    "total": 1,
    "success": 1,
    "failed": 0,
    "results": [
      {
        "postId": "2072265710857150465",
        "postTitle": "7月车主福利来啦！",
        "success": true,
        "commentId": "real-1789125694188",
        "error": null
      }
    ]
  }
}
```

**错误响应**:

| HTTP | 场景 | 响应体 |
|------|------|--------|
| 409 | 已有评论任务在运行 | `{"error":"评论任务正在运行中，请稍后再试","code":"TASK_ALREADY_RUNNING"}` |
| 500 | 执行异常 | `{"success":false,"error":"...","code":"INTERNAL_ERROR"}` |

---

### 3. 查询评论日志列表

分页查询评论日志（从 MySQL 读取）。

**端点**: `GET /comment/logs`

**鉴权**: 无

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 20 | 每页数量 |

**成功响应** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "total": 128,
    "page": 1,
    "pageSize": 20,
    "logs": [ /* CommentLog 数组，按 created_at 倒序 */ ]
  }
}
```

## 附录：评论日志字段（CommentLog）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 日志 ID |
| `post_id` | string | 帖子 ID |
| `post_title` | string | 帖子标题 |
| `comment_content` | string | 评论内容 |
| `comment_id` | string | 评论 ID（成功时返回） |
| `success` | boolean | 是否成功 |
| `error` | string | 失败原因（失败时） |
| `mode` | `normal` \| `fallback` | 评论模式 |
| `source` | `auto` \| `manual` | 来源（自动/手动） |
| `publish_time` | Date | 发布时间 |
| `created_at` | Date | 记录创建时间 |
