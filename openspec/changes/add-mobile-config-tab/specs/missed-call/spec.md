## 新增需求

### 需求：未接电话记录存储

系统必须将未接电话记录存储到 MySQL 数据库的 `missed_calls` 表中，包含以下字段：
- `id`: 主键，自增
- `phone_number`: 电话号码（VARCHAR）
- `received_at`: 接收时间（DATETIME）
- `created_at`: 记录创建时间（DATETIME，默认当前时间）

#### 场景：成功存储未接电话记录
- **当** 接收到新的未接电话数据
- **那么** 系统将未接电话信息插入 `missed_calls` 表

### 需求：未接电话记录 API - 新增

系统必须提供 `POST /api/posts/mobile/calls/missed` 接口用于添加未接电话记录。

请求体必须包含：
- `phone_number`: 电话号码（必填）
- `received_at`: 接收时间（可选，默认当前时间）

请求必须使用 API Token 认证。

#### 场景：成功添加未接电话记录
- **当** 收到有效的 POST 请求且包含必填字段
- **那么** 返回 `{ success: true, data: { id: <记录 ID> } }`

#### 场景：认证失败
- **当** 请求未提供有效的 API Token
- **那么** 返回 401 错误

#### 场景：缺少必填字段
- **当** 请求缺少 `phone_number`
- **那么** 返回 400 错误，提示缺少字段

### 需求：未接电话记录 API - 查询

系统必须提供 `GET /api/posts/mobile/calls/missed` 接口用于查询未接电话记录。

查询参数：
- `limit`: 返回记录数限制（可选，默认 50）
- `offset`: 偏移量（可选，默认 0）
- `phone_number`: 按电话号码筛选（可选）

请求必须使用 API Token 认证。

#### 场景：成功查询未接电话记录
- **当** 收到有效的 GET 请求
- **那么** 返回 `{ success: true, data: [{ id, phone_number, received_at, created_at }] }`

#### 场景：按电话号码筛选
- **当** 请求包含 `phone_number` 参数
- **那么** 只返回匹配该号码的记录
