# Requirements Document

## Introduction

对一汽奥迪APP自动任务系统的智能回复功能进行优化。当前系统在每日评论任务中存在以下不足：所有已获取帖子均被评论过时任务直接跳过；帖子选择无时间排序策略；评论内容虽有上下文分析但仍可能被识别为AI生成。本次优化围绕三个核心目标：回复兜底机制、时间优先选帖策略、以及更拟人化的回复生成。

## Glossary

- **Comment_Service**: 自动评论服务模块（AutoCommentService），负责每日评论任务的执行、帖子选择和评论发布
- **Post_Selector**: 帖子选择器，Comment_Service中负责从候选帖子列表中筛选评论目标的子逻辑
- **Content_Generator**: 内容生成模块，调用AI大模型生成评论文本
- **Comment_History**: 评论历史记录，存储在data/comment-history.json中的已评论帖子信息
- **Fallback_Mode**: 兜底模式，当所有候选帖子均已被评论时启用的备选策略
- **Recency_Score**: 时间新鲜度评分，基于帖子发布时间计算的优先级权重
- **Human_Tone_Prompt**: 拟人化提示词，指导AI生成更接近真人口吻回复的系统提示词策略

## Requirements

### Requirement 1: 回复兜底机制

**User Story:** 作为系统运维人员，我希望每日评论任务在所有帖子都已评论过的情况下仍能执行回复，以确保每天都有活跃互动产出。

#### Acceptance Criteria

1. WHEN Post_Selector finds that all fetched posts (across all fetched pages) have been commented on, THE Comment_Service SHALL activate Fallback_Mode to select previously-commented posts as targets
2. WHILE Fallback_Mode is active, THE Post_Selector SHALL randomly select posts from Comment_History up to the configured dailyLimit count, ensuring no duplicate post IDs are selected within the same batch
3. WHILE Fallback_Mode is active, THE Content_Generator SHALL receive the previous comment text for the target post and generate a new comment that does not repeat the same opening sentence or core message as the prior comment
4. THE Comment_Service SHALL log a message at INFO level indicating Fallback_Mode activation when all fetched posts have been previously commented on
5. IF Comment_History is empty when Fallback_Mode is triggered, THEN THE Comment_Service SHALL log a warning and return an empty result set without attempting to generate comments

### Requirement 2: 时间优先选帖策略

**User Story:** 作为系统运维人员，我希望系统优先评论最近发布的帖子，以使互动行为看起来更自然且更容易获得帖子作者的回应。

#### Acceptance Criteria

1. WHEN Post_Selector receives a list of candidate posts, THE Post_Selector SHALL sort the posts by publishTime in descending order (newest first) before applying any selection logic
2. THE Post_Selector SHALL select the top N posts (where N equals the configured dailyLimit, default 3) from the time-sorted list, excluding posts whose IDs exist in Comment_History; IF fewer than N unread posts are available, THEN THE Post_Selector SHALL select all available unread posts
3. WHILE Fallback_Mode is active, THE Post_Selector SHALL sort posts from Comment_History by publishTime in descending order and select the top N (where N equals dailyLimit) most recently published posts as re-comment targets
4. IF a candidate post has a missing or unparseable publishTime value, THEN THE Post_Selector SHALL place that post after all posts with valid publishTime in the sorted order

### Requirement 3: 拟人化回复生成

**User Story:** 作为系统运维人员，我希望AI生成的回复更像真人发出，避免被社区管理员或其他用户识别为自动回复。

#### Acceptance Criteria

1. THE Content_Generator SHALL use Human_Tone_Prompt strategies that instruct the AI to adopt conversational language patterns matching the community styleDescription from AnalysisSummary, including incomplete sentences, colloquial connectors, and varied punctuation usage
2. WHEN generating a comment, THE Content_Generator SHALL incorporate at least 1 post-specific detail from the target post, such as an author mention, a direct reference to content in the post body, or a follow-up question related to the post topic
3. WHEN generating comments across multiple posts within the same day, THE Content_Generator SHALL vary comment style such that no two comments in the same dailyLimit batch share the same opening pattern or sentence structure, by randomizing prompt parameters including opening pattern, sentence structure, and emotional tone
4. THE Content_Generator SHALL avoid formulaic patterns such that no generated comment starts with the same opening phrase as any other comment generated within the preceding 7 days (avoidRepeatDays period)
5. WHEN generating a comment, THE Content_Generator SHALL include colloquial expressions, typo-like variations, or informal punctuation in a proportion between 20% and 50% of generated comments within any rolling window of 10 comments, to simulate natural human typing patterns
6. THE Content_Generator SHALL keep generated comment length within the configured range (contentLimits.comment.min to contentLimits.comment.max characters, default 20 to 200)
7. IF the generated comment content is shorter than contentLimits.comment.min characters or exceeds contentLimits.comment.max characters after the AI response, THEN THE Content_Generator SHALL apply the enforceLength truncation logic to constrain the output to the nearest sentence boundary within the valid range, and log a warning if the content was below minimum length

### Requirement 4: 多页帖子获取

**User Story:** 作为系统运维人员，我希望系统能获取更多页的帖子列表，以增加找到未评论新帖的概率并获得更好的时间排序效果。

#### Acceptance Criteria

1. WHEN the first page of fetched posts (page 1, size 20) all exist in Comment_History, THE Comment_Service SHALL fetch the next page sequentially, continuing until it finds at least one uncommented post or reaches the configured maximum page count (comment.maxFetchPages, default: 5, range: 1 to 10)
2. WHEN the Comment_Service has found at least one uncommented post on any fetched page, THE Comment_Service SHALL stop fetching additional pages
3. IF no uncommented posts are found after fetching all configured pages, THEN THE Comment_Service SHALL activate Fallback_Mode
4. IF the feed API returns an error or empty records during multi-page fetching, THEN THE Comment_Service SHALL stop fetching further pages and proceed with whatever posts have been collected so far
5. THE Comment_Service SHALL merge posts from all fetched pages into a single deduplicated list (by post ID) before applying the time-based sorting and selection logic
6. WHILE fetching multiple pages, THE Comment_Service SHALL wait between 1 and 3 seconds between consecutive page requests
