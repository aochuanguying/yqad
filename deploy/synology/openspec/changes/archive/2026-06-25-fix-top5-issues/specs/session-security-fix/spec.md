## 新增需求

### 需求:生产环境必须强制配置 Session Secret

生产环境（`NODE_ENV=production`）下，如果 `sessionSecret` 未配置或为空，系统必须拒绝启动并抛出明确错误，禁止使用硬编码默认值。

#### 场景:生产环境未配置 sessionSecret 时拒绝启动
- **当** `NODE_ENV` 为 `production` 且 `sessionSecret` 为空或未配置
- **那么** 系统抛出错误并终止启动，错误消息明确提示需要配置 `sessionSecret`

#### 场景:开发环境未配置 sessionSecret 时使用开发默认值
- **当** `NODE_ENV` 不为 `production` 且 `sessionSecret` 为空
- **那么** 系统使用开发环境默认值并打印警告日志

#### 场景:已配置 sessionSecret 时正常启动
- **当** `sessionSecret` 已配置有效值
- **那么** 系统正常使用该值创建 Session 中间件
