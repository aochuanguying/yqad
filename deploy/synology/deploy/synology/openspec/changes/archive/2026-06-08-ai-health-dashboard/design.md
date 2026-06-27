## 上下文

当前 AI fallback 机制已经完整实现，包含以下核心组件：
- `FallbackChain`: 协调速率限制、熔断器、错误分类、重试和 fallback
- `MetricsCollector`: 收集请求指标（成功率、响应时间等）
- `CircuitBreaker`: 熔断器三态机（CLOSED/OPEN/HALF_OPEN）
- `RateLimiter`: 令牌桶算法速率限制
- `TimeoutController`: 超时控制和动态调整

现有 API：
- `getFallbackHealthStatus()`: 获取所有 Provider 健康状态（返回 Map）
- `getAllHealthStatus()`: 获取所有 Provider 指标（来自 MetricsCollector）

问题：这些 API 尚未暴露为 Web 接口，管理员无法实时查看 Provider 状态。

## 目标 / 非目标

**目标：**
- 在 Web 管理界面添加 AI 健康仪表盘页面
- 提供 REST API 获取 Provider 健康状态
- 实时可视化展示关键指标（成功率、响应时间、熔断状态等）
- 自动刷新（30 秒间隔）和手动刷新
- 异常状态视觉告警（颜色编码）

**非目标：**
- 不修改现有的 AI fallback 逻辑
- 不添加新的监控指标（仅展示现有数据）
- 不支持历史数据查询（仅实时状态）
- 不添加告警通知功能（如邮件、短信）

## 决策

### 1. API 设计：单端点 vs 多端点

**决策**: 提供两个端点
- `GET /api/ai/health`: 返回所有 Provider 的汇总状态
- `GET /api/ai/health/:provider`: 返回单个 Provider 的详细指标

**理由**: 
- 仪表盘首页只需要汇总数据，减少数据传输
- 详细数据按需获取，避免过度加载
- 符合 RESTful 最佳实践

**替代方案**:
- 单一端点返回所有数据：简单但数据传输量大
- GraphQL：过度复杂，不符合项目技术栈

### 2. 前端技术：React vs 原生 HTML/JS

**决策**: 使用原生 HTML + CSS + JavaScript

**理由**:
- 项目现有 Web 界面使用原生技术（如 `index.html`）
- 无需引入新的依赖
- 简单场景下原生技术更轻量
- 使用 Fetch API 和定时器实现自动刷新

**替代方案**:
- React/Vue：增加复杂度，需要构建流程
- 使用现有模板引擎：项目未使用模板引擎

### 3. 数据刷新策略

**决策**: 客户端轮询（30 秒间隔）

**理由**:
- 实现简单，兼容性好
- 服务器无状态，易于扩展
- 30 秒间隔对性能影响可忽略

**替代方案**:
- WebSocket 实时推送：复杂度高，收益有限
- Server-Sent Events：兼容性不如轮询

### 4. 视觉设计：颜色编码方案

**决策**: 三色方案
- 绿色：健康（熔断器 CLOSED 且成功率 > 90%）
- 橙色：警告（成功率 80-90% 或 熔断器 HALF_OPEN）
- 红色：异常（熔断器 OPEN 或 成功率 < 80%）

**理由**:
- 符合通用颜色语义
- 直观易懂，降低认知负担

### 5. 数据结构设计

**决策**: 扁平化结构，直接映射现有 API

```typescript
interface ProviderHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  successRate: number;  // 0-100
  avgResponseTime: number;  // ms
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimit: {
    availableTokens: number;
    isWhitelisted: boolean;
  };
}
```

**理由**:
- 直接映射 `MetricsCollector` 和 `CircuitBreaker` 数据
- 前端无需复杂转换
- 易于序列化为 JSON

## 风险 / 权衡

### 风险 1: 轮询增加服务器负载

**缓解措施**:
- 30 秒间隔足够长，对性能影响可忽略
- API 仅返回内存数据，无数据库查询
- 可配置刷新间隔

### 风险 2: 数据一致性问题

**风险**: 多个 Provider 状态可能在不同时间点采集

**缓解措施**:
- 单次请求获取所有 Provider，保证原子性
- 前端显示"最后更新时间"戳

### 风险 3: 前端状态管理复杂

**风险**: 自动刷新、手动刷新、错误处理可能导致状态混乱

**缓解措施**:
- 使用简单的状态机（idle/loading/success/error）
- 刷新时禁用按钮防止重复请求
- 错误时显示友好提示，不中断自动刷新

### 风险 4: 移动端适配

**风险**: 仪表盘在移动端显示不佳

**缓解措施**:
- 使用响应式 CSS（Flexbox/Grid）
- 卡片布局自动换行
- 最小化复杂交互

## 迁移计划

**部署步骤**:
1. 新增路由文件：`src/web/routes/ai-health-routes.ts`
2. 新增前端页面：`src/web/public/ai-health.html`
3. 注册路由：修改 `src/web/server.ts`
4. 重启 Web 服务器

**回滚策略**:
- 删除新增的两个文件
- 恢复 `server.ts` 到修改前
- 无需数据库迁移，无破坏性变更

## Open Questions

### 1. 是否需要权限控制？

**当前决策**: 不添加权限控制，与现有 Web 管理界面保持一致

**待解决**: 如果未来添加用户认证，需要考虑访问控制

### 2. 是否需要国际化？

**当前决策**: 仅支持中文（与项目整体保持一致）

**待解决**: 如果未来需要多语言支持，前端文本需要抽取到 i18n 文件

### 3. 是否需要导出功能？

**当前决策**: 不提供数据导出

**待解决**: 如果管理员需要历史数据分析，可考虑添加 CSV 导出功能
