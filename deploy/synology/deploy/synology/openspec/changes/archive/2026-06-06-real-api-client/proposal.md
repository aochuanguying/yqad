## 为什么

当前项目仅有 Mock API 实现，无法执行真实的帖子获取、评论发布和发帖操作。根据已验证的 API 文档（`docs/api-reference.md`），帖子列表（Feed）、发评论、Token 管理等接口已具备调用条件。签到接口因依赖 `x-fawvw-sign`（App native 层签名，无法逆向）暂时不可用，因此本次变更不涉及签到。现在需要将系统从开发阶段推进到可实际运行的阶段。

## 变更内容

- **新增** `RealAudiApi` 类，实现 `IAudiApi` 接口中除签到外的所有方法：
  - `login` — 通过短信验证码登录获取 Token（需手动提供验证码，或预存 Token）
  - `refreshToken` — 通过响应头 `x-access-token` 实现滑动续期
  - `getPosts` — 调用 `/cnapi/v2/feed` 获取帖子列表，处理 contentType 解析
  - `getComments` — 不实现（当前评论接口未提供独立查询端点，评论生成依赖帖子内容即可）
  - `publishComment` — 调用 `/cnapi/v1/comment_center/comment/save`
  - `publishPost` — 待定（API 文档中未提供发帖端点，保持 Mock 或后续补充）
  - `signin` — 保持抛出"暂不支持"或直接 skip

- **修改** `IAudiApi` 接口及 `types.ts`，适配真实 API 的响应结构（如 Feed 中的嵌套 contentType）

- **修改** API 工厂 `src/api/index.ts`，当 `api.mode === 'real'` 时返回 `RealAudiApi` 实例

- **修改** Token 管理机制，支持：
  - Web UI 登录获取 Token（腾讯滑块验证 + 短信验证码）
  - 响应头滑动续期
  - Token 过期检测（83h 有效期）

- **修改** 配置结构，新增真实 API 所需的字段（如 deviceId、nickName、ipRegion 等）
- **新增** Web UI 登录页面路由，集成腾讯滑块验证 + 短信验证码登录

## 功能 (Capabilities)

### 新增功能
- `real-api-client`: 真实 HTTP API 客户端实现，封装一汽奥迪 cnapi/mapi 通道调用逻辑

### 修改功能
- `auto-comment`: 适配真实 API 返回的帖子结构（contentType 嵌套解析），评论参数增加 subjectContentTypeEnum
- `content-analysis`: 适配真实 Feed API 的返回格式（records 中按 contentType 提取帖子信息）

## 影响

- `src/api/` — 新增 `real-client.ts`，修改 `index.ts`、`types.ts`
- `src/services/auth.ts` — Token 管理逻辑适配（预存 Token + 滑动续期）
- `src/services/content-analysis.ts` — Post 结构适配
- `src/services/auto-comment.ts` — 评论参数适配
- `config/default.yaml` — 新增 `api.deviceId`、`api.nickName`、`api.ipRegion` 等字段
- `src/web/` — 新增登录路由（腾讯滑块 + 短信验证码获取 Token）
- 依赖项 — 已有 `axios`，无需新增
