## ADDED Requirements

### Requirement: 小红书笔记搜索

系统 SHALL 支持通过关键词搜索小红书笔记，返回结构化结果。

#### Scenario: 关键词搜索

- **WHEN** 调用 `xiaohongshu_search` 工具，参数 `{ "query": "露营好物推荐", "maxResults": 10 }`
- **THEN** 返回最多 10 条笔记，每条包含 `noteId`、`title`、`snippet`、`author`、`authorAvatar`、`coverImage`、`likeCount`、`collectCount`、`commentCount`、`publishedAt`

#### Scenario: 按排序方式

- **WHEN** 调用 `xiaohongshu_search` 工具，参数 `{ "query": "防晒", "sortBy": "latest" }`
- **THEN** 结果按发布时间倒序排列

#### Scenario: 无结果

- **WHEN** 搜索关键词无匹配笔记
- **THEN** 返回空数组 `[]`，不报错

### Requirement: 小红书笔记详情获取

系统 SHALL 支持获取指定小红书笔记的完整内容。

#### Scenario: 获取笔记详情

- **WHEN** 调用 `xiaohongshu_get_note` 工具，参数 `{ "noteId": "xxx" }`
- **THEN** 返回完整笔记内容，包含 `title`、`content`、`author`、`images[]`（图片 URL 列表）、`tags[]`、`likeCount`、`collectCount`、`commentCount`、`publishedAt`

#### Scenario: 笔记不存在

- **WHEN** 指定 noteId 对应的笔记已删除或不存在
- **THEN** 返回错误 `{ "error": "NOTE_NOT_FOUND", "message": "笔记不存在或已被删除" }`

### Requirement: 搜索结果摘要控制

系统 SHALL 支持通过参数控制返回内容的详细程度，适配智能体平台的 token 限制。

#### Scenario: 摘要模式

- **WHEN** 调用搜索工具时传入 `{ "summaryMode": true }`
- **THEN** 每条结果的 `snippet` 限制在 100 字以内，不返回完整内容

#### Scenario: 完整模式（默认）

- **WHEN** 调用搜索工具时未指定 `summaryMode` 或设为 `false`
- **THEN** 返回完整摘要内容（最多 500 字）
