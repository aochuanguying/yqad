## ADDED Requirements

### 需求:系统必须提供真实API客户端实现
系统必须实现 `RealAudiApi` 类，通过 HTTP 调用一汽奥迪真实 API，覆盖帖子列表获取和评论发布功能。

#### 场景:配置为real模式时使用真实客户端
- **当** 配置 `api.mode` 为 `real`
- **那么** API 工厂必须返回 `RealAudiApi` 实例

#### 场景:配置为mock模式时保持现有行为
- **当** 配置 `api.mode` 为 `mock`
- **那么** API 工厂必须返回 `MockAudiApi` 实例

### 需求:真实客户端必须正确获取帖子列表
系统必须调用 `/cnapi/v2/feed` 端点获取帖子列表，并将嵌套的 contentType 结构映射为统一的 Post 接口。

#### 场景:获取Feed并映射INFORMATION类型帖子
- **当** Feed 返回 contentType 为 INFORMATION 的记录
- **那么** 系统必须从 `record.information` 提取 id、title、commentCount 等字段

#### 场景:获取Feed并映射DYNAMIC类型帖子
- **当** Feed 返回 contentType 为 DYNAMIC 的记录
- **那么** 系统必须从 `record.subject` 提取 id、content、commentCount 等字段

#### 场景:获取Feed并映射ARTICLE类型帖子
- **当** Feed 返回 contentType 为 ARTICLE 的记录
- **那么** 系统必须从 `record.subject` 提取 id、title、content 等字段

#### 场景:获取Feed并映射NOTES类型帖子
- **当** Feed 返回 contentType 为 NOTES 的记录
- **那么** 系统必须从 `record.nous` 提取 id、content 等字段

#### 场景:跳过ACTIVITY类型和未知类型
- **当** Feed 返回 contentType 为 ACTIVITY 或未知类型的记录
- **那么** 系统必须跳过该记录并记录 debug 日志

#### 场景:请求携带正确的App通道Headers
- **当** 调用 cnapi 端点
- **那么** 请求必须携带 x-access-token、x-audi-did、x-channel(iOS)、x-audi-entry(app)、user-agent 等伪装头

### 需求:真实客户端必须正确发布评论
系统必须调用 `/cnapi/v1/comment_center/comment/save` 端点发布评论，传递正确的帖子类型参数。

#### 场景:发布评论时传递正确的subjectContentTypeEnum
- **当** 对某帖子发布评论
- **那么** 请求体必须包含 `subjectContentTypeEnum` 与该帖子的 contentType 一致

#### 场景:发布评论时携带用户信息
- **当** 发布评论
- **那么** 请求体必须包含配置中的 nickName 和 ipRegion

#### 场景:评论发布成功
- **当** API 返回 code=0
- **那么** publishComment 必须返回 success=true

#### 场景:评论发布失败
- **当** API 返回非零 code
- **那么** publishComment 必须返回 success=false 并记录错误日志

### 需求:真实客户端必须支持Token管理
系统必须支持通过 Web UI 登录获取 Token，并通过响应头滑动续期机制维持 Token 有效性。

#### 场景:通过Web UI登录获取Token
- **当** 用户在 Web 管理界面中发起登录（手机号 + 腾讯滑块验证 + 短信验证码）
- **那么** 系统必须调用 `/mapi/user/v1/vrcode/send2` 发送验证码，再调用 `/mapi/user/v1/account/login` 获取 Token 并保存

#### 场景:使用已保存的Token
- **当** 系统启动且 Token 存储文件中存在有效 Token
- **那么** 系统必须直接使用该 Token 进行 API 调用，禁止重新登录

#### 场景:响应头Token续期
- **当** API 响应头中包含新的 x-access-token 值
- **那么** 系统必须保存新 Token 并用于后续请求

#### 场景:Token过期检测
- **当** Token 存储时间超过 70 小时且未被续期
- **那么** 系统必须记录告警日志提示需要通过 Web UI 重新登录

### 需求:签到和发帖必须明确标记为不可用
系统在真实模式下必须对未实现的功能给出明确反馈。

#### 场景:调用签到接口
- **当** 真实模式下触发签到
- **那么** 系统必须跳过执行并记录日志"签到API暂不可用（缺少sign）"

#### 场景:调用发帖接口
- **当** 真实模式下触发发帖
- **那么** 系统必须跳过执行并记录日志"发帖API端点未知，暂不支持"
