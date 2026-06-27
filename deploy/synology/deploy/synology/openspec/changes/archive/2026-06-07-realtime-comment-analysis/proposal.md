## 为什么

当前回帖逻辑依赖定时执行的"内容分析"服务获取社区分析摘要，这导致：
1. 回帖质量受限于定时分析的时效性
2. 内容分析服务后期会被删除，需要解耦依赖
3. 无法针对单个帖子特点生成个性化评论

本变更将使回帖逻辑改为实时分析每个帖子的内容特征，不再依赖外部的定时内容分析服务。

## 变更内容

- **移除依赖**：`AutoCommentService` 不再依赖 `ContentAnalysisService`
- **实时分析**：评论生成前即时分析当前帖子的类型、长度、关键词等特征
- **简化 Prompt**：使用帖子自身特征构建评论生成 Prompt，替代原有的社区分析摘要
- **独立服务**：新增 `CommentAnalyzer` 服务，专门负责帖子内容分析

## 功能 (Capabilities)

### 新增功能
- `comment-analyzer`: 帖子内容实时分析服务，提取类型、长度、关键词、情感等特征
- `realtime-comment-prompt`: 基于实时分析结果构建评论生成 Prompt

### 修改功能
无（内容分析服务完全解耦，不影响其他功能）

## 影响

- **代码影响**：
  - `src/services/auto-comment.ts`：移除对 `ContentAnalysisService` 的依赖
  - 新增 `src/services/comment-analyzer.ts`：实时分析服务
  - 修改 `src/ai/content-generator.ts`：调整评论生成接口
  - 修改 `src/ai/prompts.ts`：重构 Prompt 构建逻辑

- **配置影响**：
  - 不再需要 `analysis` 相关配置项
  - 调度器中的"内容分析"定时任务可移除

- **数据影响**：
  - 不再依赖 `data/analysis.json` 文件
  - 评论历史记录保持不变
