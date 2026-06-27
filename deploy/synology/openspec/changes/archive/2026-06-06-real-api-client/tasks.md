## 1. 接口与类型扩展

- [x] 1.1 在 `src/api/types.ts` 的 `Post` 接口中新增可选字段 `contentType?: string`
- [x] 1.2 在 `src/api/types.ts` 的 `publishComment` 方法签名中新增可选参数 `contentType?: string`
- [x] 1.3 在 `config/default.yaml` 的 `api` 节下新增 `deviceId`、`nickName`、`ipRegion` 配置项（baseUrl 改为真实域名 `https://audi2c.faw-vw.com`）

## 2. RealAudiApi 核心实现

- [x] 2.1 创建 `src/api/real-client.ts`，实现 `RealAudiApi` 类框架（实现 IAudiApi 接口）
- [x] 2.2 实现 `buildAppHeaders()` 私有方法，构建 cnapi 通道请求头（从配置读取 deviceId 等）
- [x] 2.3 实现 `getPosts()`，调用 `/cnapi/v2/feed`，将 contentType 嵌套结构映射为 Post 数组
- [x] 2.4 实现 `publishComment()`，调用 `/cnapi/v1/comment_center/comment/save`，传递 subjectContentTypeEnum + nickName + ipRegion
- [x] 2.5 实现 `checkTokenRenewal()` 私有方法，检查响应头 x-access-token 并更新存储
- [x] 2.6 实现 `getComments()` 返回空数组（记录 debug 日志说明暂无端点）
- [x] 2.7 实现 `signin()` 抛出跳过日志（"签到API暂不可用"）
- [x] 2.8 实现 `publishPost()` 抛出跳过日志（"发帖API端点未知"）
- [x] 2.9 实现 `login()` — 调用 `/mapi/user/v1/account/login`（由 Web UI 登录路由触发，传入手机号+验证码）
- [x] 2.10 实现 `sendSmsCode()` — 调用 `/mapi/user/v1/vrcode/send2`（发送短信验证码，需腾讯滑块 ticket）

## 3. API 工厂集成

- [x] 3.1 修改 `src/api/index.ts`，当 `api.mode === 'real'` 时实例化并返回 `RealAudiApi`
- [x] 3.2 导出 `RealAudiApi` 类

## 4. Token 管理与 Web UI 登录

- [x] 4.1 修改 `src/services/auth.ts`，支持从 token.json 加载已保存 Token（跳过 login）
- [x] 4.2 在 AuthService 中集成响应头续期逻辑（提供 `updateTokenFromResponse()` 方法供 RealAudiApi 回调）
- [x] 4.3 添加 Token 过期告警（存储超 70h 未续期时记录 warn 日志）
- [x] 4.4 新增 `src/web/routes/auth-routes.ts`，实现登录 API 路由（POST /api/auth/send-code、POST /api/auth/login）
- [x] 4.5 在 Web UI 前端页面中集成登录表单（腾讯滑块验证 + 短信验证码，参考 verify-api-web.html 的实现）

## 5. 上层服务适配

- [x] 5.1 修改 `src/services/auto-comment.ts`，在调用 `publishComment` 时传递帖子的 contentType
- [x] 5.2 修改 `src/services/content-analysis.ts`，在 `fetchTopComments` 中对空结果做降级处理（不中断流程）

## 6. 测试与验证

- [x] 6.1 编写 `tests/real-api-client.test.ts`，测试 Feed 响应映射逻辑（INFORMATION/DYNAMIC/ARTICLE/NOTES/ACTIVITY）
- [x] 6.2 编写 Token 续期逻辑的单元测试
- [x] 6.3 验证 Mock 模式在所有变更后仍正常工作（运行现有测试套件）
