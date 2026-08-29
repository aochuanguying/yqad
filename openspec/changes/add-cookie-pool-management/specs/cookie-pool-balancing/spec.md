## ADDED Requirements

### Requirement: Cookie 池加载和刷新

系统 SHALL 从 `cookie_configs` 表加载启用的 Cookie 到内存池，并定期刷新。

#### Scenario: 池初始化
- **WHEN** CookiePool 初始化时
- **THEN** 从 `cookie_configs` 表查询 `enabled=1` 的记录，按 platform 分组加载，每 5 分钟自动刷新

#### Scenario: 平台 Cookie 统计
- **WHEN** 获取池状态（`getStatus()`）
- **THEN** 返回 `{ zhihu: 3, xiaohongshu: 2 }` 显示每平台可用 Cookie 数量

### Requirement: 加权均衡选择

系统 SHALL 根据权重和最后使用时间选择 Cookie，实现均衡使用和反爬保护。

#### Scenario: 按权重和间隔选择
- **WHEN** 调用 `get('zhihu')` 获取 Cookie
- **THEN** 对所有启用且有效的 Cookie 计算 `score = weight / (minutes_since_last_use + 1)`，返回 score 最高的 Cookie

#### Scenario: 新 Cookie 优先使用
- **WHEN** 池中存在从未使用过的 Cookie（`lastUsedAt = 0`）
- **THEN** 该 Cookie 的 `minutes_since_last_use` 按足够大（如 9999）计算，使其获得高 score 被优先选择

#### Scenario: 只有一条配置时
- **WHEN** 某平台仅有一条 Cookie 配置
- **THEN** 直接返回该 Cookie，评分逻辑不影响结果

### Requirement: 失效标记和降级

系统 SHALL 支持标记失效 Cookie 并自动尝试下一个可用 Cookie。

#### Scenario: 标记失效
- **WHEN** 调用 `markInvalid('zhihu', cookie)`
- **THEN** 从池中移除该 Cookie，记录日志，下次 `get()` 时自动使用下一个可用 Cookie

#### Scenario: 全部失效时的处理
- **WHEN** 某平台所有 Cookie 都被标记为失效
- **THEN** `get()` 返回 `null`，`hasAvailable()` 返回 `false`，搜索适配器需处理为空的情况
