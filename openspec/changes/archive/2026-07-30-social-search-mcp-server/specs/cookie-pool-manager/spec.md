## ADDED Requirements

### Requirement: 多账号 Cookie 池管理

系统 SHALL 维护多个平台账号的 Cookie 池，请求时自动轮转选择可用 Cookie。

#### Scenario: 轮转选择 Cookie

- **WHEN** 发起搜索请求需要 Cookie
- **THEN** 从可用 Cookie 池中选择使用次数最少或最近最久未使用的 Cookie

#### Scenario: Cookie 池为空

- **WHEN** 指定平台所有 Cookie 均已失效或池为空
- **THEN** 返回错误 `{ "error": "NO_VALID_COOKIE", "message": "无可用Cookie，请刷新" }`，不发起搜索请求

### Requirement: Cookie 有效性检测

系统 SHALL 在使用 Cookie 前检测其有效性，自动剔除失效的 Cookie。

#### Scenario: Cookie 有效

- **WHEN** 使用某 Cookie 发起请求，服务端正常返回数据
- **THEN** 标记该 Cookie 为有效，更新最近使用时间

#### Scenario: Cookie 失效

- **WHEN** 使用某 Cookie 发起请求，服务端返回需要登录或 403
- **THEN** 标记该 Cookie 为失效，从可用池中移除，选择下一个 Cookie 重试

### Requirement: 复用 yqad Cookie 刷新机制

系统 SHALL 从 yqad 使用的同一 MySQL 数据库读取 Cookie 数据，复用已有的 Cookie 自动刷新服务。

#### Scenario: 读取已有 Cookie

- **WHEN** 服务启动或 Cookie 池刷新时
- **THEN** 从 MySQL `cookies` 表读取指定平台的有效 Cookie 记录，加载到内存池

#### Scenario: Cookie 被外部刷新

- **WHEN** yqad 的 Cookie 刷新服务更新了数据库中的 Cookie
- **THEN** 下次池刷新时自动获取最新 Cookie，无需人工干预
