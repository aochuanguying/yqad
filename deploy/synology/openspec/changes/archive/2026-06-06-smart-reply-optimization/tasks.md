# Implementation Plan: Smart Reply Optimization

## Overview

对 AutoCommentService 进行全面优化，实现多页帖子获取、时间优先排序、兜底模式回复和拟人化评论生成。变更涉及配置扩展、数据结构扩展、核心逻辑重构和 prompt 策略更新，覆盖 6 个文件。

## Tasks

- [x] 1. Set up config and data structure extensions
  - [x] 1.1 Extend AppConfig and default.yaml with maxFetchPages
    - Add `maxFetchPages: number` field to `AppConfig.comment` interface in `src/utils/config.ts`
    - Add `maxFetchPages: 5` to `comment` section in `config/default.yaml`
    - _Requirements: 4.1_

  - [x] 1.2 Extend CommentRecord interface with post metadata fields
    - Add optional fields to `CommentRecord` in `src/services/auto-comment.ts`: `publishTime?: string`, `postTitle?: string`, `postContent?: string`, `contentType?: string`
    - Update `recordComment` method to accept and store these new fields
    - _Requirements: 1.1, 2.3_

- [x] 2. Implement multi-page fetching and post selection logic
  - [x] 2.1 Implement fetchPostsWithPaging() method
    - Create private `fetchPostsWithPaging()` method in `AutoCommentService`
    - Fetch pages sequentially (page 1, size 20), check each page for uncommented posts
    - Stop fetching when an uncommented post is found, or max pages reached, or API returns error/empty
    - Merge all pages and deduplicate by post ID
    - Add 1-3 second random delay between page requests
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Implement selectTargetPosts() with time-priority sorting
    - Refactor `selectTargetPosts` to sort candidates by `publishTime` descending
    - Place posts with missing/unparseable `publishTime` after valid ones
    - Filter out already-commented posts, take top N (N = dailyLimit)
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 2.3 Implement selectFallbackPosts() for fallback mode
    - Create private `selectFallbackPosts()` method in `AutoCommentService`
    - Log INFO when fallback mode is activated
    - If `commentHistory` is empty, log WARNING and return empty result
    - Sort history by `publishTime` descending, select top dailyLimit posts (no duplicate IDs)
    - Pass previous comment text to content generator for differentiation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3_

- [x] 3. Checkpoint - Verify core logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement human-tone comment generation
  - [x] 4.1 Create buildHumanToneCommentPrompt() function
    - Add `buildHumanToneCommentPrompt(post, summary, options)` to `src/ai/prompts.ts`
    - Implement 5 style templates rotation: empathy, question, experience-sharing, light-complaint, brief-response
    - Each template requires referencing at least 1 specific post detail (author, content keyword, or follow-up question)
    - Add "avoid openings" list mechanism using `recentOpenings` parameter
    - Randomly (~30% probability) inject colloquial/typo/informal punctuation requirements
    - Dynamically adjust tone based on `summary.styleDescription`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Update generateComment with CommentGenerationOptions
    - Define `CommentGenerationOptions` interface in `src/ai/content-generator.ts`
    - Modify `generateComment` signature to accept optional `options?: CommentGenerationOptions`
    - Route to `buildHumanToneCommentPrompt` when options are provided
    - In fallback mode, pass `previousComment` to prompt for differentiation
    - Apply `enforceLength` logic for content length constraints
    - _Requirements: 3.1, 3.6, 3.7, 1.3_

- [x] 5. Integrate main flow and wire everything together
  - [x] 5.1 Refactor performDailyComments() to use new methods
    - Replace single-page fetch with `fetchPostsWithPaging()`
    - Use refactored `selectTargetPosts()` for time-sorted selection
    - Call `selectFallbackPosts()` when no unread posts available
    - Pass `batchIndex` and `recentOpenings` (last 7 days comment openings from history) in generation loop
    - Pass `previousComment` in fallback mode to `generateComment`
    - Pass new metadata fields to `recordComment`
    - _Requirements: 1.1, 1.3, 2.1, 3.3, 3.4, 4.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All implementation is in TypeScript, matching the existing codebase
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design does not include a Correctness Properties section, so no property-based tests are included
- Changes are backward-compatible: all new CommentRecord fields are optional

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1"] }
  ]
}
```
