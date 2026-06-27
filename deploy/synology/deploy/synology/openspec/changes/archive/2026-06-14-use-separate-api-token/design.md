## 上下文

当前远程发帖 API (`/api/posts/generate` 等端点) 使用登录 Token 进行鉴权。登录 Token 的有效期约 83 小时，会通过响应头自动续期。这种机制对于 APP 接口调用是合适的，但对于远程 API 调用存在以下问题：

1. **不稳定性**：登录 Token 可能随时刷新，导致手机端 API 调用失败
2. **安全性**：登录 Token 权限较高，暴露给远程调用存在安全风险
3. **管理困难**：无法独立控制 API 访问权限，无法单独撤销

## 目标 / 非目标

**目标：**
- 实现独立的 API Token 机制，与登录 Token 分离
- 提供稳定的 API 鉴权方式，不受登录 Token 刷新影响
- 支持通过 Web UI 配置和管理 API Token
- 保持向后兼容，不影响现有登录 Token 的使用

**非目标：**
- 不修改登录 Token 的刷新和管理机制
- 不改变 APP 接口调用的鉴权方式
- 不实现复杂的 Token 权限分级（如只读、写入等）

## 决策

### 1. Token 存储方案

**决策：** 使用配置文件存储 API Token（`data/api-token.json`）

**理由：**
- 与现有登录 Token 存储方式保持一致（`data/token.json`）
- 实现简单，无需引入额外的数据库依赖
- 便于备份和迁移

**替代方案：**
- 环境变量：不适合动态更新场景
- 数据库存储：过度设计，增加复杂度

### 2. Token 生成策略

**决策：** 使用加密安全的随机字符串生成 Token（32 字节，hex 编码）

**理由：**
- 安全性高，难以猜测
- 实现简单，Node.js 内置 `crypto.randomBytes()` 支持
- 与 JWT 等复杂方案相比，更易于管理和理解

**Token 格式：** `api_token_<64 字符随机 hex>`

### 3. 鉴权中间件设计

**决策：** 创建独立的 `apiTokenMiddleware` 函数，验证 API Token

**理由：**
- 与现有的 `authMiddleware` 分离，职责清晰
- 可以独立测试和维护
- 不影响现有登录 Token 的验证逻辑

**实现要点：**
- 从 `Authorization: Bearer <token>` 头中提取 Token
- 读取配置文件验证 Token 是否匹配
- 验证失败返回 401 错误

### 4. Web UI 管理界面

**决策：** 在 Web 管理界面新增"API Token"配置页面

**功能：**
- 显示当前 API Token 状态（已配置/未配置）
- 生成新 Token（一键生成）
- 撤销/重置 Token
- 复制 Token 到剪贴板

**位置：** 在现有 Web UI 中新增 Tab ���在设置页面中

### 5. 配置结构

**决策：** 新增 `apiToken` 配置项

**配置文件：** `data/api-token.json`
```json
{
  "token": "api_token_abc123...",
  "createdAt": "2026-06-11T10:00:00.000Z",
  "lastUsedAt": "2026-06-11T12:00:00.000Z"
}
```

## 风险 / 权衡

**风险 1：Token 泄露**
→ **缓解措施：**
- Web UI 中仅显示一次完整 Token，之后仅显示状态
- 支持一键重置 Token
- 配置文件设置合适的文件权限（600）

**风险 2：向后兼容性问题**
→ **缓解措施：**
- 提供迁移文档，指导用户更新 Postman 配置
- 在 API 响应中提供清晰的错误提示
- 保留旧的鉴权方式一段时间作为过渡（可选）

**风险 3：Token 管理复杂度增加**
→ **缓解措施：**
- 提供简洁的 Web UI 管理界面
- 文档清晰说明使用场景
- Token 长期有效，无需频繁更新

## 迁移计划

### 阶段 1：实现功能
1. 创建 API Token 配置管理模块
2. 实现 `apiTokenMiddleware`
3. 修改 `posts-routes.ts` 使用新的中间件
4. 创建 Web UI 管理界面

### 阶段 2：测试验证
1. 单元测试：Token 生成、验证、重置
2. 集成���试：API 端点鉴权
3. UI 测试：Token 管理功能

### 阶段 3：部署上线
1. 更新文档（REMOTE_POST_API.md）
2. 更新 Postman 集合
3. 通知用户更新 Token 配置

### 回滚策略
- 保留旧的 `authMiddleware` 代码
- 如发现问题，可快速切回使用登录 Token 鉴权
