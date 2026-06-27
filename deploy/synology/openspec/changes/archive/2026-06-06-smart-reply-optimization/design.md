# Design Document

## Overview

对 AutoCommentService 和 Content Generator 进行优化，实现：多页帖子获取、时间优先排序、兜底模式回复、以及拟人化评论生成。变更集中在 `src/services/auto-comment.ts`、`src/ai/content-generator.ts`、`src/ai/prompts.ts` 和 `src/utils/config.ts`。

## Architecture Changes

### 1. 多页帖子获取 + 时间排序 + 兜底选择（auto-comment.ts）

```
performDailyComments()
  │
  ├── fetchPostsWithPaging()          ← 新方法：多页获取，遇到未评论帖子停止
  │     └── 逐页获取，每页间 1-3s 延迟
  │     └── 合并去重（by post ID）
  │
  ├── selectTargetPosts()             ← 重构：加入时间排序 + 兜底逻辑
  │     ├── 按 publishTime 降序排列
  │     ├── 过滤已评论帖子，取 top N
  │     └── 若无未评论帖子 → activateFallback()
  │
  ├── activateFallback()              ← 新方法：从历史中选帖
  │     ├── 检查 commentHistory 非空
  │     ├── 按 publishTime 排序（若有）
  │     └── 随机选取 dailyLimit 条（不重复）
  │
  └── 评论生成循环（传入 previousComment 用于兜底模式）
```

### 2. 拟人化评论生成（content-generator.ts + prompts.ts）

```
generateComment(post, summary, options?)
  │
  ├── options.previousComment         ← 兜底模式传入上次评论
  ├── options.batchIndex              ← 当前批次索引（用于风格轮换）
  ├── options.recentOpenings          ← 最近7天的开头句列表
  │
  ├── buildHumanToneCommentPrompt()   ← 新的 prompt 构建函数
  │     ├── 基于 styleDescription 动态调整语气
  │     ├── 随机选择评论风格模板（共鸣/提问/分享经验/吐槽/简短回应）
  │     ├── 注入帖子具体细节要求
  │     ├── 注入"避免开头"列表
  │     └── 随机决定是否加入口语化/错别字要求
  │
  └── enforceLength() 长度约束
```

### 3. 配置扩展（config.ts + default.yaml）

新增配置项：
```yaml
comment:
  maxFetchPages: 5       # 多页获取最大页数（1-10）
```

不需要新的配置项来控制拟人化——这些逻辑内建在 prompt 策略中。

## Data Flow

### CommentRecord 扩展

现有 `CommentRecord` 增加 `publishTime` 字段，用于兜底模式的时间排序：

```typescript
interface CommentRecord {
  postId: string;
  commentId: string;
  content: string;
  timestamp: string;       // 评论发布时间
  publishTime?: string;    // 帖子原始发布时间（新增）
  postTitle?: string;      // 帖子标题（新增，用于兜底模式重新生成）
  postContent?: string;    // 帖子内容摘要（新增，用于兜底模式重新生成）
  contentType?: string;    // 帖子类型（新增，用于兜底模式发布评论）
}
```

### generateComment 扩展参数

```typescript
export interface CommentGenerationOptions {
  previousComment?: string;    // 兜底模式下上次的评论内容
  batchIndex?: number;         // 当前批次中的序号（0-based）
  recentOpenings?: string[];   // 最近 avoidRepeatDays 天内的评论开头
}
```

## Key Design Decisions

1. **多页获取策略**：采用"发现未评论帖子即停止"而非"总是获取所有页"，减少 API 调用频率
2. **兜底模式选帖**：按 publishTime 排序后取 top N，而非纯随机，确保重复评论也集中在新帖上
3. **拟人化实现方式**：通过 prompt engineering 而非后处理，让 AI 直接生成自然内容
4. **风格轮换**：使用 batchIndex 在同一批次内轮换不同评论风格模板，确保不重复
5. **向后兼容**：CommentRecord 新增字段全部可选，旧数据兼容

## Files to Modify

| 文件 | 变更内容 |
|------|---------|
| `src/services/auto-comment.ts` | 多页获取、时间排序、兜底逻辑 |
| `src/ai/content-generator.ts` | generateComment 接收新参数 |
| `src/ai/prompts.ts` | 新增拟人化 prompt 构建逻辑 |
| `src/utils/config.ts` | AppConfig 类型增加 maxFetchPages |
| `config/default.yaml` | 增加 comment.maxFetchPages 默认值 |
