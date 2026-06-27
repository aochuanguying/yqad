## 新增需求

### 需求：短信记录存储

系统必须将短信记录存储到 MySQL 数据库的 `mobile_sms` 表中，包含以下字段：
- `id`: 主键，自增
- `phone_number`: 电话号码（VARCHAR）
- `content`: 短信内容（TEXT）
- `received_at`: 接收时间（DATETIME）
- `created_at`: 记录创建时间（DATETIME，默认当前时间）

#### 场景：成功存储短信记录
- **当** 接收到新的短信数据
- **那么** 系统将短信信息插入 `mobile_sms` 表

### 需求：短信记录 API - 新增

系统必须提供 `POST /api/posts/mobile/sms` 接口用于添加短信记录。

请求体必须包含：
- `phone_number`: 电话号码（必填）
- `content`: 短信内容（必填）
- `received_at`: 接收时间（可选，默认当前时间）

请求必须使用 API Token 认证。

#### 场景：成功添加短信记录
- **当** 收到有效的 POST 请求且包含必填字段
- **那么** 返回 `{ success: true, data: { id: <记录 ID> } }`

#### 场景：认证失败
- **当** 请求未提供有效的 API Token
- **那么** 返回 401 错误

#### 场景：缺少必填字段
- **当** 请求缺少 `phone_number` 或 `content`
- **那么** 返回 400 错误，提示缺少字段

### 需求：短信记录 API - 查询

系统必须提供 `GET /api/posts/mobile/sms` 接口用于查询短信记录。

查询参数：
- `limit`: 返回记录数限制（可选，默认 50）
- `offset`: 偏移量（可选，默认 0）
- `phone_number`: 按电话号码筛选（可选）

请求必须使用 API Token 认证。

#### 场景：成功查询短信记录
- **当** 收到有效的 GET 请求
- **那么** 返回 `{ success: true, data: [{ id, phone_number, content, received_at, created_at }] }`

#### 场景：按电话号码筛选
- **当** 请求包含 `phone_number` 参数
- **那么** 只返回匹配该号码的记录
