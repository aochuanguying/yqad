## 上下文

当前系统通过 `IAudiApi` 接口抽象了 API 层，仅有 `MockAudiApi` 实现。API 文档（`docs/api-reference.md`）已验证以下接口可用：

- 登录（短信验证码）— 通过 Web UI 触发腾讯滑块验证 + 短信验证码登录
- Feed 帖子列表 — `/cnapi/v2/feed`
- 发评论 — `/cnapi/v1/comment_center/comment/save`
- Token 滑动续期 — 响应头 `x-access-token`
- 会员信息 — `/mapi/member/v1/member/info`

签到依赖 `x-fawvw-sign`（native 层签名），暂不可用。发帖端点 API 文档未提供，暂保持 Mock。

系统已有 `axios` 依赖，HTTP 基础设施无需额外引入。

## 目标 / 非目标

**目标：**
- 实现 `RealAudiApi` 类，覆盖帖子列表获取和评论发布
- 适配真实 Feed 返回的嵌套 contentType 结构
- 支持 Token 预存 + 响应头滑动续期
- 评论发布传递正确的 `subjectContentTypeEnum`
- 保持 Mock 模式完整可用，通过配置切换

**非目标：**
- 签到功能实现（缺少 sign 算法）
- 发帖功能实现（缺少 API 端点文档）
- 短信验证码自动化（需要人工操作，不在本次范围）
- 图片上传（发帖暂不实现）

## 决策

### 1. Token 管理策略：Web UI 登录 + 滑动续期

**选择**：用户通过 Web 管理界面的登录页面（手机号 + 腾讯滑块验证 + 短信验证码）获取 Token，系统通过响应头自动续期。

**替代方案**：
- 抓包手动粘贴 Token → 用户体验差，非技术用户难以操作
- 全自动登录（绕过滑块）→ 腾讯滑块验证需要用户交互，无法全自动化

**理由**：
- Web UI 已实现完整的登录流程（见 `verify-api-web.html`），包含腾讯滑块 SDK 集成
- Token 有效期 83h，配合每日任务调用（至少每天 3-4 次 API 请求），滑动续期足以无限续期
- 首次登录需用户在 Web UI 中完成一次滑块验证 + 短信验证码，之后自动续期
- 登录接口已验证可用：`POST /mapi/user/v1/vrcode/send2` + `POST /mapi/user/v1/account/login`

### 2. Feed 数据适配：在 RealAudiApi 内部做映射

**选择**：在 `RealAudiApi.getPosts()` 内部将真实 API 的嵌套结构（`contentType` → `information/subject/nous`）映射为现有的 `Post` 接口。

**替代方案**：
- 修改 `Post` 接口匹配真实结构 → 破坏性大，影响所有上层服务
- 在 Service 层做适配 → 逻辑分散，不利于维护

**理由**：保持 `IAudiApi` 接口稳定，所有适配逻辑封装在 API 客户端内部，上层无感切换。

### 3. contentType 传递：扩展 Post 接口

**选择**：在 `Post` 接口新增可选字段 `contentType?: string`，用于评论时传递 `subjectContentTypeEnum`。

**替代方案**：
- 在 `publishComment` 中新增参数 → 破坏接口签名
- 新建独立映射表 → 需要额外维护

**理由**：最小改动，可选字段不影响现有代码。Mock 实现忽略该字段即可。

### 4. 请求头管理：集中配置

**选择**：将 `deviceId`、`sign`、`nickName`、`ipRegion` 等运行时参数放入配置文件 `config/default.yaml` 的 `api` 节下。

**理由**：这些值来自抓包，不频繁变化。集中管理便于 NAS 部署时通过 volume 挂载覆盖。

### 5. getComments 实现：基于 Feed 内容

**选择**：`getComments()` 暂返回空数组。当前评论生成依赖帖子内容（标题+正文），不依赖已有评论。

**理由**：API 文档未提供独立的评论列表查询端点。内容分析中的 `fetchTopComments` 将返回空结果，但不影响核心功能（评论生成基于帖子内容 + 分析摘要）。

### 6. publishPost 实现：保持抛出未实现

**选择**：`publishPost()` 抛出 `Error('发帖 API 端点未知，暂不支持')`。

**理由**：没有文档化的发帖端点。后续抓包确认后再实现。发帖调度触发时会被 catch 并记录日志。

## 风险 / 权衡

| 风险 | 缓解措施 |
|------|----------|
| Token 过期未续期（83h 内无请求） | 日志告警 + Web UI 提示需重新登录 |
| Feed 返回结构变化（App 升级） | 在映射层做防御性解析，未知 contentType 跳过并记录 |
| 评论被风控（频率/内容检测） | 保持现有随机延时机制 + contentLimits 控制长度 |
| getComments 返回空影响分析质量 | 分析模块已有降级逻辑（无评论时仅分析帖子） |
| sign 可能过期失效 | 仅影响签到，本次不涉及 |

## 架构概览

```
┌────────────────────────────────────────────────────────┐
│                    src/api/                             │
├────────────────────────────────────────────────────────┤
│                                                        │
│  IAudiApi (interface)                                  │
│       │                                                │
│       ├── MockAudiApi (现有，保持不变)                  │
│       │                                                │
│       └── RealAudiApi (新增)                           │
│              │                                         │
│              ├── buildAppHeaders()  ← cnapi 通道       │
│              ├── buildMapiHeaders() ← mapi 通道        │
│              ├── mapFeedToPost()    ← Feed 结构映射    │
│              └── checkTokenRenewal()← 滑动续期         │
│                                                        │
└────────────────────────────────────────────────────────┘
```
