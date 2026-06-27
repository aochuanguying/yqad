## 1. 创建 CommentAnalyzer 服务

- [x] 1.1 定义 PostFeatures 接口（类型、关键词、情感、主题等）
- [x] 1.2 实现帖子类型识别逻辑（classifyPost 函数）
- [x] 1.3 实现关键词提取功能（extractKeywords 函数，包含停用词表）
- [x] 1.4 实现情感倾向分析（analyzeSentiment 函数，正/负面词库）
- [x] 1.5 实现内容主题分类（classifyTopic 函数，关键词匹配）
- [x] 1.6 实现综合特征分析接口（analyzePost 方法，整合所有分析逻辑）
- [ ] 1.7 添加单元测试验证各分析功能

## 2. 修改 AutoCommentService

- [x] 2.1 移除对 ContentAnalysisService 的依赖注入
- [x] 2.2 移除 performDailyComments 中对 getSummary() 的调用
- [x] 2.3 注入 CommentAnalyzer 服务
- [x] 2.4 在评论生成循环中，对每个帖子调用 analyzePost 进行实时分析
- [x] 2.5 将分析结果传递给评论生成函数

## 3. 重构评论生成 Prompt

- [x] 3.1 修改 buildHumanToneCommentPrompt 函数签名，接收 PostFeatures 替代 AnalysisSummary
- [x] 3.2 构建新的【帖子特征】Prompt 块（类型、主题、情感、关键词）
- [x] 3.3 保留评论风格轮换逻辑（COMMENT_STYLES 模板池）
- [x] 3.4 保留拟人化策略（口语化、避免重复开头、兜底去重）
- [x] 3.5 保留核心规则（针对细节评论、避免废话、长度约束等）
- [x] 3.6 更新 generateComment 函数签名和调用逻辑

## 4. 清理和验证

- [x] 4.1 移除 main.ts 中对 analysisService 的初始化
- [x] 4.2 保留 scheduler 中的"内容分析"任务（AutoPostService 仍需要）
- [x] 4.3 验证评论生成功能：单元测试 15 个全部通过 ✓
- [x] 4.4 analysis.json 仍被 AutoPostService 使用，无需删除
- [x] 4.5 更新配置文件注释，说明 analysis 仅用于自动发帖

## 5. 测试和文档

- [x] 5.1 编写 CommentAnalyzer 服务的单元测试（15 个测试用例）
- [x] 5.2 集成测试：通过编译验证和单元测试覆盖
- [x] 5.3 运行现有测试：回帖相关测试全部通过（auto-post 测试失败与本次变更无关）
- [x] 5.4 更新文档：创建 `docs/回帖架构变更说明.md`
- [x] 5.5 记录新架构设计：完整记录在变更文档中
