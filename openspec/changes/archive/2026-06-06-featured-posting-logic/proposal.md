## 为什么

当前自动发帖逻辑以“能发出去”为主要目标：正文长度只满足基础范围、图片可能为 0 张且缺少结构化排版、也不会针对“精华帖”评选规则做约束与自检。这导致帖子质量和稳定性波动较大，且很难命中官方精华帖奖励机制（每月最多 5 次）。

本变更的目标是把“精华帖规则”显式化，并将其融入自动发帖的生成、素材选择、校验与降级流程中：优先产出满足精华条件的帖子，达不到时再降级为普通帖，确保系统稳定发帖的同时最大化精华命中率。

## 变更内容

- 新增“精华帖规则”与“精华准备度（readiness）”判定：依据官方规则对候选帖子做内容与素材校验，并输出原因。
- 调整自动发帖流程：优先尝试生成“精华候选帖”（更长正文、更清晰结构、更多图片）；若无法满足关键门槛则自动降级为普通帖发布。
- 优化发帖生成提示词与结构：强化“原创真实、逻辑清晰、排版分层”的写作要求，避免模板化与营销腔。
- 优化图片选择与数量保障：尽量保证精华帖候选至少 4 张图片；图片不足时优先从本地素材库补齐或选择更适配的主题素材；若仍不足则降级。
- 引入可配置的“精华目标阈值”：允许通过配置调整精华帖的关键门槛（如最少字数、最少图片数、最大生成重试次数等）。

## 功能 (Capabilities)

### 新增功能

- `featured-posting`: 定义精华帖规则、readiness 判定、与自动发帖降级策略相关的规范与配置项。

### 修改功能

- `auto-post`: 自动发帖行为变更为“优先精华候选，达不到再发普通帖”，并将精华判定结果纳入日志/结果输出。

## 影响

- 发帖链路：AutoPostService 生成策略、图片选择/上传策略、话题匹配策略将发生调整（主要影响 [src/services/auto-post.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/services/auto-post.ts)）。
- AI 生成：帖子 Prompt 与长度约束会增强（主要影响 [src/ai/content-generator.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/ai/content-generator.ts)、[src/ai/prompts.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/ai/prompts.ts)）。
- 配置：新增/扩展配置项（影响 [config/default.yaml](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/config/default.yaml)、[src/utils/config.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/utils/config.ts)）。
- Web 管理：如需可视化配置精华阈值或展示 readiness 原因，可能新增/调整部分 Web API 与页面字段（影响 [src/web/server.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/web/server.ts) 及 routes/services）。
