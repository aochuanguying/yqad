## 1. 数据库迁移

- [ ] 1.1 创建 `cookie_configs` 表 SQL 迁移脚本（platform, label, cookie, access_secret, enabled, priority, weight, use_count, last_used_at, last_refresh_at, next_refresh_at, refresh_logs）

## 2. Cookie 配置存储层

- [ ] 2.1 新增 `src/infra/cookie-config-storage.ts`：实现 `getAllByPlatform()`, `getById()`, `create()`, `update()`, `softDelete()`, `getStatus()`, `saveCookie()` 方法
- [ ] 2.2 实现测试连接方法：`testZhihu()`（Bearer Token 调官方 API）、`testXiaohongshu()`（Cookie 调小红书搜索 API）

## 3. Cookie 池改造

- [ ] 3.1 改造 `src/infra/cookie-pool.ts`：从 `cookie_configs` 表多记录加载替代 `network_post_config` 单记录
- [ ] 3.2 实现加权均衡选择策略：`score = weight / (minutesSinceLastUse + 1)`，返回最高分 Cookie
- [ ] 3.3 新增 `markInvalid()` 移除失效 Cookie，支持自动降级
- [ ] 3.4 改造 `zhihu-adapter.ts`：Access Secret 通过 cookie-pool 从 cookie_configs 获取，替代直接查 `network_post_config`

## 4. Cookie 刷新服务

- [ ] 4.1 新增 `src/services/cookie-refresh/refresh-service.ts`：统一管理知乎和小红书的扫码和续期任务
- [ ] 4.2 实现知乎扫码刷新：基于 Playwright，复用主项目 `ZhihuCookieScanner` 的选择器和登录流程
- [ ] 4.3 实现小红书扫码刷新：基于 Playwright，复用主项目 `CookieScanner` 的扫码和两轮机制
- [ ] 4.4 实现自动续期（smartRefresh）：定时检查 Cookie 有效性 → 有效则注入浏览器续期 → 无效则标记
- [ ] 4.5 在 `index.ts` 启动时注册自动续期定时器和启动检查

## 5. REST API 路由

- [ ] 5.1 新增 `src/rest/routes/cookie-config.ts`：实现 `GET /api/cookie-configs`, `POST /api/cookie-configs`, `PUT /:id`, `DELETE /:id`, `GET /:id/status`
- [ ] 5.2 实现测试连接端点：`POST /test-zhihu`, `POST /test-xiaohongshu`
- [ ] 5.3 实现扫码刷新端点：`POST /cookie/refresh`（异步返回 taskId）, `GET /cookie/refresh/:taskId/status`（轮询）
- [ ] 5.4 在 `src/rest/app.ts` 注册新路由

## 6. Web 管理页面

- [ ] 6.1 新增 `src/web/admin.html`：管理页面，包含知乎/小红书 tab 切换、配置列表、新增/编辑表单、测试连接按钮、扫码刷新按钮、Cookie 状态面板
- [ ] 6.2 页面功能：CRUD 操作、Cookie 状态展示、二维码弹窗、刷新进度展示
- [ ] 6.3 在 `src/rest/app.ts` 添加 `/admin` 路由映射和静态资源托管

## 7. 验证测试

- [ ] 7.1 构建项目确保 TypeScript 编译零错误
- [ ] 7.2 启动服务测试管理页面可访问
- [ ] 7.3 测试配置 CRUD API 完整流程（新增 → 列表 → 更新 → 删除）
- [ ] 7.4 测试 Cookie 池加载和均衡选择
