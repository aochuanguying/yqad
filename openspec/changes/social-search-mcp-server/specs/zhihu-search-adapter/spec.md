## ADDED Requirements

### Requirement: 知乎内容搜索

系统 SHALL 支持通过关键词搜索知乎平台的问答和文章，返回结构化结果。

#### Scenario: 关键词搜索

- **WHEN** 调用 `zhihu_search` 工具，参数 `{ "query": "新能源车推荐", "type": "general", "maxResults": 10 }`
- **THEN** 返回最多 10 条结果，每条包含 `title`、`snippet`、`author`、`url`、`voteCount`、`type`（answer/article）、`publishedAt`

#### Scenario: 按类型过滤

- **WHEN** 调用 `zhihu_search` 工具，参数 `{ "query": "Python", "type": "article" }`
- **THEN** 仅返回知乎文章（专栏），不包含问答

#### Scenario: 无结果

- **WHEN** 搜索关键词无匹配内容
- **THEN** 返回空数组 `[]`，不报错

### Requirement: 知乎内容详情获取

系统 SHALL 支持获取指定知乎回答或文章的完整内容。

#### Scenario: 获取回答详情

- **WHEN** 调用 `zhihu_get_content` 工具，参数 `{ "url": "https://www.zhihu.com/question/xxx/answer/yyy" }`
- **THEN** 返回完整回答内容（纯文本或 Markdown），包含 `title`、`content`、`author`、`voteCount`、`commentCount`、`publishedAt`

#### Scenario: 获取文章详情

- **WHEN** 调用 `zhihu_get_content` 工具，参数 `{ "url": "https://zhuanlan.zhihu.com/p/xxx" }`
- **THEN** 返回完整文章内容，包含 `title`、`content`、`author`、`voteCount`、`publishedAt`

#### Scenario: 内容不存在或已删除

- **WHEN** 指定 URL 对应的内容已删除或不存在
- **THEN** 返回错误 `{ "error": "CONTENT_NOT_FOUND", "message": "内容不存在或已被删除" }`
