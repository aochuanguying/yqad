## ADDED Requirements

### Requirement: 配置 CRUD 操作

系统 SHALL 提供 Cookie 配置的增删改查 REST API。

#### Scenario: 列出所有配置
- **WHEN** GET `/api/cookie-configs` 且传入 `platform=zhihu` 查询参数
- **THEN** 返回 `{ success: true, data: [...] }`，其中 data 包含该平台所有配置（排除 cookie 明文，仅返回长度和摘要）

#### Scenario: 创建新配置
- **WHEN** POST `/api/cookie-configs` 且 body 包含 `{ platform: "zhihu", label: "账号A", cookie: "...", accessSecret: "..." }`
- **THEN** 新记录插入 `cookie_configs` 表，自动设置 `enabled=1`，返回创建后的记录（不含 cookie 明文）

#### Scenario: 更新配置
- **WHEN** PUT `/api/cookie-configs/:id` 且 body 包含 `{ cookie: "new_value", label: "新名称" }`
- **THEN** 更新该记录的对应字段，返回 `{ success: true }`

#### Scenario: 删除配置
- **WHEN** DELETE `/api/cookie-configs/:id`
- **THEN** 软删除该记录（设置 `enabled=0`），返回 `{ success: true }`

#### Scenario: 测试知乎连接
- **WHEN** POST `/api/cookie-configs/test-zhihu` 且 body 包含 `{ accessSecret }`
- **THEN** 使用 Bearer Token 调用 `developer.zhihu.com/api/v1/content/zhihu_search`，返回 `{ success: true, resultCount: N }` 或错误信息

#### Scenario: 测试小红书连接
- **WHEN** POST `/api/cookie-configs/test-xiaohongshu` 且 body 包含 `{ cookie }`
- **THEN** 使用 Cookie 调用小红书搜索 API，返回 `{ success: true, resultCount: N }` 或错误信息

### Requirement: 配置状态查询

系统 SHALL 提供各配置的 Cookie 状态查询。

#### Scenario: 查询配置状态
- **WHEN** GET `/api/cookie-configs/:id/status`
- **THEN** 返回 `{ hasCookie, version, lastRefreshTime, nextRefreshTime, recentLogs }`

### Requirement: Web 管理页面

系统 SHALL 提供可视化的 Cookie 配置管理页面。

#### Scenario: 访问管理页面
- **WHEN** 浏览器访问 `/admin` 路径
- **THEN** 返回管理页面 HTML，包含配置列表（知乎/小红书分 tab）、新增/编辑表单、测试连接按钮、扫码刷新按钮、Cookie 状态面板

#### Scenario: 新增配置表单
- **WHEN** 用户点击"新增配置"按钮
- **THEN** 显示表单（平台选择、标签、Cookie 文本框、Access Secret 输入框（知乎时显示）），提交后调用 POST API

#### Scenario: 扫码刷新 Cookie
- **WHEN** 用户点击某条配置的"刷新 Cookie"按钮
- **THEN** 调用 POST `/api/cookie-configs/cookie/refresh`（异步），然后轮询 `GET /api/cookie-configs/cookie/refresh/:taskId/status`，获取二维码 base64 后展示，扫码成功后自动更新配置
