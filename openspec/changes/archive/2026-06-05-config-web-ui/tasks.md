## 1. 项目基础设施

- [x] 1.1 安装 express 和 @types/express 依赖
- [x] 1.2 在 config/default.yaml 中添加 web 服务器配置段（端口、Basic Auth 凭据）
- [x] 1.3 创建 src/web/ 目录结构（server.ts, routes/, middleware/）

## 2. 配置服务层

- [x] 2.1 创建 src/web/services/config-service.ts，实现配置读取（按分组解析 YAML）
- [x] 2.2 实现配置写入功能（验证 → 临时文件 → 原子 rename）
- [x] 2.3 实现配置验证器（类型检查、数值范围、cron 格式校验）
- [x] 2.4 实现内存互斥写入锁，防止并发写入冲突

## 3. 配置热重载机制

- [x] 3.1 创建 src/web/services/config-events.ts，基于 EventEmitter 实现配置变更事件总线
- [x] 3.2 修改 src/scheduler/ 模块，订阅配置变更事件并实现热重载（取消旧任务、注册新任务）
- [x] 3.3 添加热重载失败回滚逻辑（catch 异常后恢复上一份有效配置）

## 4. HTTP API 层

- [x] 4.1 创建 src/web/middleware/auth.ts，实现 HTTP Basic Auth 中间件
- [x] 4.2 创建 src/web/routes/config-routes.ts，实现 GET /api/config 返回全部配置
- [x] 4.3 实现 GET /api/config/:group 返回指定分组配置
- [x] 4.4 实现 PUT /api/config/:group 更新配置（调用验证 → 持久化 → 发事件）
- [x] 4.5 实现错误处理中间件，统一格式化 400/401/500 错误响应

## 5. Web 前端页面

- [x] 5.1 创建 src/web/public/index.html，使用 Tailwind CSS CDN 构建配置管理页面骨架
- [x] 5.2 实现配置分组 Tab 切换（API设置、认证、AI模型、签到、评论、发帖、分析、调度、日志、内容长度）
- [x] 5.3 实现每个分组的表单字段渲染（根据数据类型生成 input/select/number）
- [x] 5.4 实现敏感字段脱敏展示（password/apiKey 使用 type=password）
- [x] 5.5 实现表单提交逻辑（调用 PUT API、展示成功/失败提示）

## 6. 服务器启动集成

- [x] 6.1 创建 src/web/server.ts，组装 Express app（中间件、路由、静态文件）
- [x] 6.2 修改 src/index.ts 主入口，集成 Web 服务器启动
- [x] 6.3 确保 Web 服务器与现有调度器、服务模块正确协同启动

## 7. 测试与验证

- [x] 7.1 为配置验证器编写单元测试
- [x] 7.2 为配置 API 路由编写集成测试（GET/PUT 正常流程、验证失败、未授权访问）
- [x] 7.3 验证热重载场景：修改调度配置后调度器正确重新注册任务
