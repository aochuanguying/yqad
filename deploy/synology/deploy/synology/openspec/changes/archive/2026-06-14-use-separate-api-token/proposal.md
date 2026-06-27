## 为什么

当前远程发帖 API 使用登录 Token 进行鉴权，但该 Token 会定期刷新（有效期约 83 小时），导致手机端调用 API 时可能因 Token 失效而失败。为远程 API 调用引入独立的、稳定的 Token 机制，可以避免登录 Token 刷新带来的不稳定性，提高 API 服务的可靠性。

## 变更内容

- **新增**：独立的 API Token 配置和管理功能
- **新增**：专用的 API Token 鉴权中间件，验证独立的 Token 而非登录 Token
- **修改**：远程发帖 API 的鉴权方式从验证登录 Token 改为验证独立的 API Token
- **保留**：登录 Token 继续用于 APP 接口调用，不受影响

## 功能 (Capabilities)

### 新增功能
- `api-token-auth`: 独立的 API Token 认证机制，包括 Token 配置、验证和管理
- `api-token-config`: API Token 的配置界面和管理功能（Web UI）

### 修改功能
- `remote-post-api`: API 鉴权方式从登录 Token 改为独立的 API Token

## 影响

- **代码影响**：
  - 新增 API Token 验证中间件
  - 修改 `posts-routes.ts` 的鉴权逻辑
  - 新增 Token 配置管理路由和界面
  - 新增配置文件结构（存储 API Token）
- **API 影响**：远程发帖 API 的鉴权 Token 变更，需要更新调用方的 Token 配置
- **配置影响**：需要配置独立的 API Token（可通过 Web UI 或配置文件）
- **向后兼容**：需要更新 Postman 集合和客户端代码使用新的 Token
