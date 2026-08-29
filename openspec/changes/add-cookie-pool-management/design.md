## Context

social-search 服务是独立部署的子服务，通过 MCP + REST 协议对外提供搜索能力。目前：
- Cookie 从主项目 MySQL `network_post_config` 表的单条记录拉取（每 5 分钟一次）
- 每个平台仅一条 Cookie，无池化、无均衡策略
- 知乎 Access Secret 硬编码从 `network_post_config.zhihu_access_secret` 读取
- 无独立配置管理界面，Cookie 刷新依赖主项目的定时任务和 Web 页面

本次设计将为 social-search 服务自建 Cookie 池管理能力，包括独立数据表、REST API、Web 管理页面和 Playwright 扫码续期。

## Goals / Non-Goals

**Goals:**
- 新增 `cookie_configs` 表，支持知乎和小红书各维护多套凭证（Access Secret + Cookie）
- 提供完整的 CRUD API 和 Web 管理页面（含测试连接、扫码刷新）
- CookiePool 支持权重轮转 + 最少最近使用（LRU）均衡策略
- 基于 Playwright 实现知乎和小红书的扫码登录和自动续期
- zhihu-adapter 的 Access Secret 从 cookie_configs 池加载

**Non-Goals:**
- 不修改主项目的 `network_post_config` 表或相关逻辑
- 不提供定时任务调度器（scheduler），自动续期通过内置的 `setInterval` + cron 表达式实现
- 不做汽车之家的 Cookie 管理（汽车之家无需 Cookie）

## Decisions

### 1. 数据模型：独立表 `cookie_configs` vs 继续用 `network_post_config`

**选择**：新建 `cookie_configs` 表。

**理由**：
- `network_post_config` 是单条记录设计（`id=1`），不适合多套配置
- 独立表更干净，字段语义明确，不影响主项目的迁移脚本
- 可独立管理索引和查询性能

### 2. CookiePool 均衡策略：权重轮转 + LRU

**选择**：`weight` 字段设定权重（0-100），默认 10。获取时：先按 `weight / (last_used_ago + 1)` 计算分值，选分值最高的 Cookie。

**理由**：
- 纯轮询（Round-Robin）不考虑 Cookie 质量差异和反爬需求
- 加权评分同时兼顾"更重要的账号"（高权重）和"避免单账号过频"（间隔因子）
- 失效标记后自动降级到下一个可用 Cookie

**替代方案**：
- 纯随机：简单但不稳定，可能出现连续撞上失效 Cookie
- 最小使用次数：不考虑时间维度，冷热不均

### 3. Cookie 自动续期：内置定时器 vs 依赖主项目 scheduler

**选择**：在 social-search 的 `index.ts` 启动时注册 `setInterval`，每 6 小时执行一次（即 2:00、8:00、14:00、20:00），每天 4 次，避免夜间单点刷新导致 Cookie 集中失效。

**理由**：
- social-search 是独立服务，不应依赖主项目的 scheduler
- 简单可靠，无需引入额外的调度框架
- 可接受分钟级精度偏差

### 4. Web 管理页面：内嵌单页 vs 独立部署

**选择**：单 HTML 文件内嵌在 `src/web/`，通过 express 静态托管 + `/admin` 路由访问。

**理由**：
- 管理页面简单，无需 React/Vue 等框架
- 和主项目的 `network-post` 页面结构一致，风格统一
- express.static 已可用，零额外依赖

### 5. 扫码续期实现：复用主项目 Playwright 逻辑

**选择**：将主项目的 `CookieScanner` 和 `ZhihuCookieScanner` 核心逻辑提取为独立 `CookieRefreshService`，放入 `src/services/cookie-refresh/`。

**理由**：
- 主项目实现已经充分验证，直接借鉴可避免重复踩坑
- 简化：只保留手动扫码（refreshCookie）和自动续期（smartRefreshCookie）两种模式
- 使用同款反检测脚本和选择器

### 6. 知乎 Access Secret 的归属

**选择**：一起存入 `cookie_configs` 表的 `access_secret` 字段（知乎专用）。

**理由**：
- Access Secret 和 Cookie 是同一套知乎账号凭证，应放一起管理
- 不同账号的 Access Secret 不同（免费额度 1000 次/天/应用），多账号池化需要分别管理

## Risks / Trade-offs

- [风险] Playwright 扫码登录可能被知乎/小红书反爬检测 → 已注入反检测脚本，且持久化浏览器目录可减少登录频率
- [风险] `cookie_configs` 表迁移需在数据库执行 DDL → 提供 SQL 迁移脚本，不影响已有数据
- [权衡] 自动续期的 `setInterval` 不如 job scheduler 可靠（进程重启会丢失定时状态）→ 启动时立即检查一次所有 Cookie 是否需要续期，作为补偿
- [权衡] 管理页面前端代码单文件较长 → 保持和主项目一致风格（`index.html` 也是单文件），复杂度可控
