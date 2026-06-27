## 上下文

当前系统是一个 Node.js/TypeScript 项目，使用 `config/default.yaml` 作为唯一配置源。系统包含调度器、AI 内容生成、自动签到/评论/发帖等模块，全部通过配置文件驱动。现需要添加 Web UI 来可视化管理配置，同时保持现有架构的简洁性。

现有技术栈：TypeScript、axios、node-cron、openai、winston、yaml。

## 目标 / 非目标

**目标：**
- 提供轻量级 Web 服务器，托管配置管理 API 和前端页面
- 支持所有配置项的在线查看和编辑
- 实现配置变更后的热重载，无需手动重启
- 提供基本的访问控制保护配置安全

**非目标：**
- 不构建完整的用户管理系统（仅 Basic Auth）
- 不实现配置版本历史或审计日志
- 不支持多环境配置切换（仅管理当前环境）
- 不将前端独立为 SPA 框架项目（使用内联 HTML）

## 决策

### 1. Web 框架选择：Express.js

**选择**：Express.js
**替代方案**：Fastify、Koa、Hono
**理由**：Express 是 Node.js 生态最成熟的框架，社区支持广泛，项目已使用 Node.js，引入成本最低。项目规模小，无需 Fastify 的性能优势或 Hono 的边缘运行时支持。

### 2. 前端方案：内联 HTML + 原生 JS

**选择**：单个 HTML 文件，使用原生 JavaScript 和简单 CSS
**替代方案**：React/Vue SPA、EJS 模板引擎
**理由**：配置页面功能简单（表单展示和提交），无需复杂的前端框架。内联 HTML 通过 Express 静态文件服务即可，零构建步骤，维护成本最低。使用 Tailwind CSS CDN 快速美化。

### 3. 配置热重载机制：EventEmitter 事件总线

**选择**：Node.js 内置 EventEmitter 作为配置变更通知机制
**替代方案**：文件监听（fs.watch）、轮询、Redis pub/sub
**理由**：系统为单进程架构，EventEmitter 是最轻量的进程内通信方案。配置变更由 API 触发（非外部文件修改），无需文件监听。避免引入 Redis 等外部依赖。

### 4. 配置验证：JSON Schema + 自定义验证器

**选择**：基于配置结构的自定义验证函数
**替代方案**：ajv（JSON Schema）、zod、joi
**理由**：配置项数量有限且结构固定，自定义验证函数足够。避免为简单验证引入额外依赖。验证规则包括：类型检查、数值范围、cron 表达式格式、必填项检查。

### 5. 安全方案：HTTP Basic Auth

**选择**：HTTP Basic Auth，凭据配置在 config/default.yaml 中
**替代方案**：JWT、Session、OAuth
**理由**：这是一个内部工具，使用者有限。Basic Auth 实现简单，配合 HTTPS 即可满足需求。无需维护 token 刷新逻辑或 session 存储。

## 风险 / 权衡

- **[并发写入冲突]** → 使用简单的文件写入锁（内存互斥），同一时间仅允许一个写操作。对于单用户场景足够。
- **[配置文件格式损坏]** → 写入前先将新配置序列化并验证，写入使用临时文件 + rename 的原子操作模式。
- **[热重载失败导致服务异常]** → 各模块的重载逻辑使用 try-catch 包装，失败时回滚到上一个有效配置并记录错误日志。
- **[Basic Auth 明文传输]** → 文档说明建议生产环境配合反向代理的 HTTPS 使用。对于本地/内网使用场景风险可接受。
- **[新依赖 Express 增加包体积]** → Express 是成熟稳定的依赖，维护风险低。对 Docker 镜像大小影响可忽略。
