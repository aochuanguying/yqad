## 1. 车辆监控服务改造

- [x] 1.1 在 vehicle-monitor-service.ts 中导出 `updateToken(newToken: string)` 函数
- [x] 1.2 `updateToken` 函数实现 Token 验证、文件保存和内存更新
- [x] 1.3 确保 `updateToken` 函数支持热加载（更新 `_tokenInMemory`）

## 2. API 路由实现

- [x] 2.1 在 vehicle-token-routes.ts 中添加 `POST /update` 路由
- [x] 2.2 实现请求体验证（token 字段必须是非空字符串）
- [x] 2.3 调用服务的 `updateToken` 函数实现 Token 更新
- [x] 2.4 返回适当的响应（成功/错误）

## 3. API Token 鉴权配置

- [x] 3.1 在 server.ts 中将 `/api/vehicle-token` 添加到 API Token 鉴权路由
- [x] 3.2 路由使用 API Token 中间件进行鉴权

## 4. 测试验证

- [x] 4.1 测试 API Token 鉴权失败场景（401）
- [x] 4.2 测试请求体验证失败场景（400）
- [x] 4.3 测试成功更新 Token 场景（200）
- [x] 4.4 验证热加载效果（无需重启即可使用新 Token）
