## ADDED Requirements

### Requirement: 知乎 Cookie 扫码刷新

系统 SHALL 支持通过 Playwright 打开知乎登录页面、截取二维码、等待用户扫码登录并提取 Cookie。

#### Scenario: 手动刷新知乎 Cookie
- **WHEN** POST `/api/cookie-configs/cookie/refresh` 且 body 包含 `{ platform: "zhihu", configId: 1 }`
- **THEN** 返回 `{ taskId }`，后台启动 Playwright 流程：打开登录页 → 截取二维码 → 等待扫码 → 提取 Cookie（_xsrf, _zap, z_c0）→ 保存到对应配置

#### Scenario: 轮询刷新状态
- **WHEN** GET `/api/cookie-configs/cookie/refresh/:taskId/status`
- **THEN** 返回 `{ status: "waiting_scan", qrCodeBase64: "..." }` 或 `{ status: "success", cookie: "..." }` 或 `{ status: "failed", message: "..." }`

#### Scenario: 知乎 Cookie 自动续期
- **WHEN** 定时任务触发知乎 Cookie 检查
- **THEN** 用 `https.get('https://www.zhihu.com/api/v4/me')` 测试有效性，有效则 Playwright 注入 Cookie 刷新页面续期，无效则标记为需要手动刷新

### Requirement: 小红书 Cookie 扫码刷新

系统 SHALL 支持通过 Playwright 打开小红书登录页面、截取二维码、等待用户扫码登录并提取 Cookie。

#### Scenario: 手动刷新小红书 Cookie
- **WHEN** POST `/api/cookie-configs/cookie/refresh` 且 body 包含 `{ platform: "xiaohongshu", configId: 2 }`
- **THEN** 返回 `{ taskId }`，后台启动 Playwright 流程：打开登录页 → 截取二维码 → 最多两轮扫码（3min + 2min） → 提取 Cookie（a1, web_session 等）→ 保存到对应配置

#### Scenario: 小红书 Cookie 自动续期
- **WHEN** 定时任务触发小红书 Cookie 检查
- **THEN** 用 `XiaohongshuSearch.testConnection()` 测试有效性，有效则 Playwright 注入 Cookie 刷新页面续期，无效则标记为需要手动刷新

#### Scenario: 扫码超时处理
- **WHEN** 扫码等待超过 5 分钟（知乎）或两轮累计超时（小红书）
- **THEN** 任务状态标记为 `failed`，返回超时错误信息
