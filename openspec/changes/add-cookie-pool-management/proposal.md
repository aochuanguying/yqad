## Why

social-search 服务当前只有单条 Cookie 配置，无法维护多套知乎/小红书凭证来分散反爬风险和负载。配置管理、Cookie 续期和均衡使用能力全部缺失，需要补充完整的 Cookie 池管理能力。

## What Changes

1. **新增 Cookie 配置池表**（MySQL `cookie_configs`）：支持为知乎和小红书维护多套凭证（Access Secret + Cookie），每条记录独立管理启用/禁用、优先级、权重、刷新日志
2. **新增配置管理 REST API**：提供配置的增删改查接口，包括单个保存/批量导入、测试连接、Cookie 状态查询
3. **新增配置管理 Web 页面**：提供可视化管理界面，包括配置列表、表单新增/编辑、测试连接按钮、Cookie 扫码刷新按钮、状态面板
4. **改造 CookiePool**：从单条 `network_post_config` 读取改为从 `cookie_configs` 多记录加载，支持权重轮转 + LRU 均衡策略，生效标记自动降级
5. **新增 CookieRefreshService**：基于 Playwright 实现知乎和小红书的 Cookie 扫码刷新和自动续期，借鉴主项目的 `CookieScanner` 和 `ZhihuCookieScanner`，支持手动扫码和定时自动续期
6. **改造 zhihu-adapter**：Access Secret 从 cookie_configs 池加载（替代硬编码直读 `network_post_config`）

## Capabilities

### New Capabilities

- `cookie-config-crud`: Cookie 配置的增删改查 API 和 Web 管理页面
- `cookie-refresh`: Cookie 扫码刷新和自动续期，支持知乎和小红书
- `cookie-pool-balancing`: 多 Cookie 按权重轮转 + 最后使用时间 LRU 均衡策略

### Modified Capabilities

无（本次为 social-search 子服务的新增功能，不涉及已有 spec 变更）

## Impact

- 新增 MySQL 表：`cookie_configs`（不影响 `network_post_config` 表）
- 新增文件：
  - `src/infra/cookie-config-storage.ts`（MySQL 存储层）
  - `src/services/cookie-refresh/`（Cookie 扫码和续期服务）
  - `src/rest/routes/cookie-config.ts`（REST API 路由）
  - `src/web/`（Web 管理页面，含静态 HTML + JS）
- 修改文件：
  - `src/infra/cookie-pool.ts`（改为从 cookie_configs 读）
  - `src/adapters/zhihu-adapter.ts`（Access Secret 从池获取）
  - `src/rest/app.ts`（注册新路由和静态页面）
  - `package.json`（添加 express.static 依赖，如无则已有）
- Playwright 依赖：Dockerfile 已安装，无需改动
