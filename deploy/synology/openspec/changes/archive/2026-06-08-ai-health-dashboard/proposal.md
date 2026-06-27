## 为什么

当前 AI fallback 机制已完整实现，但缺乏可视化的健康状态监控。管理员无法直观了解各 AI Provider 的实时运行状态、成功率、响应时间等关键指标，导致故障排查和性能优化困难。

## 变更内容

在 Web 管理界面新增"AI Provider 健康状态"面板，实现以下功能：

- **新增 AI 健康仪表盘页面**：在 Web 管理界面添加 `/ai-health` 路由
- **实时状态展示**：显示各 Provider 的熔断器状态、速率限制状态、健康度
- **指标可视化**：展示成功率、平均响应时间、请求总数等关键指标
- **自动刷新**：每 30 秒自动刷新数据，支持手动刷新
- **状态告警**：对异常状态（熔断、低成功率）进行视觉告警

## 功能 (Capabilities)

### 新增功能
- `ai-health-dashboard`: AI Provider 健康状态仪表盘，包括状态展示、指标可视化、自动刷新

### 修改功能
- （无）

## 影响

- **受影响代码**：
  - 新增 Web 路由：`src/web/routes/ai-health-routes.ts`
  - 新增前端页面：`src/web/public/ai-health.html`
  - 修改 Web 服务器：`src/web/server.ts`（注册新路由）
  
- **API 变更**：
  - 新增 GET `/api/ai/health` 接口（返回所有 Provider 健康状态）
  - 新增 GET `/api/ai/health/:provider` 接口（返回单个 Provider 详细指标）

- **依赖**：无新增依赖，使用现有的 `getFallbackHealthStatus()` 和 `getAllHealthStatus()` API

- **系统**：仅影响 Web 管理界面，不影响核心业务逻辑
