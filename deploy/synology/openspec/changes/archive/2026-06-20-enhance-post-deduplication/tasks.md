## 1. 数据结构和存储准备

- [ ] 1.1 创建敏感词库文件 `data/sensitive-words.json`，包含初始敏感词列表（分级：禁止/替换/警告）
- [ ] 1.2 创建合规性检查报告存储目录 `data/compliance-reports/`
- [ ] 1.3 更新主题数据结构，在 `data/topics.json` 中为每个主题增加 `lastPostDate` 字段
- [ ] 1.4 创建历史发帖内容存储结构 `data/post-history-content.json`，用于相似度比对
- [ ] 1.5 添加配置项到 `config/default.yaml`：`contentDeduplication`、`sensitiveWordFilter`、`contentQualityScoring`、`postingIntervalControl`、`complianceCheckReport`

## 2. 内容去重服务实现

- [ ] 2.1 创建 `src/services/content-deduplication-service.ts` 文件
- [ ] 2.2 实现 TF-IDF 向量化函数，支持标题和正文的加权处理
- [ ] 2.3 实现余弦相似度计算函数
- [ ] 2.4 实现 `checkSimilarity(content, title)` 函数，返回最高相似度和匹配的历史发帖 ID
- [ ] 2.5 实现向量索引缓存机制，优化性能
- [ ] 2.6 实现历史发帖内容的定期清理任务（保留最近 30 天）
- [ ] 2.7 编写内容去重服务的单元测试

## 3. 敏感词过滤服务实现

- [ ] 3.1 创建 `src/services/sensitive-word-filter-service.ts` 文件
- [ ] 3.2 实现 Trie 树数据结构和 AC 自动机算法
- [ ] 3.3 实现敏感词库加载和热更新函数
- [ ] 3.4 实现 `detectSensitiveWords(content)` 函数，返回敏感词列表和位置
- [ ] 3.5 实现敏感词替换函数，支持同义词替换和 `*` 号屏蔽
- [ ] 3.6 实现敏感词分级处理逻辑（禁止/替换/警告）
- [ ] 3.7 编写敏感词过滤服务的单元测试

## 4. 内容质量评分服务实现

- [ ] 4.1 创建 `src/services/content-quality-scoring-service.ts` 文件
- [ ] 4.2 实现完整性评分函数（标题长度、正文长度、图片数量）
- [ ] 4.3 实现原创性评分函数（基于相似度检测）
- [ ] 4.4 实现多样性评分函数（词汇丰富度、句式变化、表情符号）
- [ ] 4.5 实现吸引力评分函数（热点关键词、情感积极性、互动引导词）
- [ ] 4.6 实现综合质量评分计算函数（加权求和）
- [ ] 4.7 实现评分详情和优化建议生成函数
- [ ] 4.8 编写内容质量评分服务的单元测试

## 5. 发帖间隔控制服务实现

- [ ] 5.1 创建 `src/services/posting-interval-control-service.ts` 文件
- [ ] 5.2 实现 `checkPostingInterval(topicId)` 函数，检查主题发帖间隔
- [ ] 5.3 实现主题最后发帖时间更新函数
- [ ] 5.4 实现发帖间隔白名单检查逻辑
- [ ] 5.5 实现紧急发帖豁免逻辑（需要权限验证）
- [ ] 5.6 编写发帖间隔控制服务的单元测试

## 6. 合规性检查报告服务实现

- [ ] 6.1 创建 `src/services/compliance-check-report-service.ts` 文件
- [ ] 6.2 实现 `generateComplianceReport(postData, checkResults)` 函数，生成合规性检查报告
- [ ] 6.3 实现报告存储函数（JSON 文件）
- [ ] 6.4 实现报告查询函数（按帖子 ID、按时间范围、按状态）
- [ ] 6.5 实现报告统计函数（通过率、平均评分、拒绝原因分布）
- [ ] 6.6 实现过期报告定期清理任务
- [ ] 6.7 编写合规性检查报告服务的单元测试

## 7. 合规性检查 API 实现

- [ ] 7.1 创建 `src/api/compliance-routes.ts` 文件
- [ ] 7.2 实现 `POST /api/compliance/check-similarity` 端点（相似度检测）
- [ ] 7.3 实现 `POST /api/compliance/check-similarity/batch` 端点（批量相似度检测）
- [ ] 7.4 实现 `GET /api/compliance/sensitive-words` 端点（查询敏感词列表）
- [ ] 7.5 实现 `POST /api/compliance/sensitive-words` 端点（添加敏感词）
- [ ] 7.6 实现 `DELETE /api/compliance/sensitive-words/:id` 端点（删除敏感词）
- [ ] 7.7 实现 `POST /api/compliance/sensitive-words/batch-import` 端点（批量导入）
- [ ] 7.8 实现 `POST /api/compliance/quality-score` 端点（质量评分）
- [ ] 7.9 实现 `POST /api/compliance/quality-score/batch` 端点（批量质量评分）
- [ ] 7.10 实现 `GET /api/compliance/posting-interval/:topicId` 端点（查询主题间隔状态）
- [ ] 7.11 实现 `GET /api/compliance/posting-interval` 端点（查询所有主题间隔状态）
- [ ] 7.12 实现 `GET /api/compliance/reports/:postId` 端点（查询单个报告）
- [ ] 7.13 实现 `GET /api/compliance/reports` 端点（查询报告列表）
- [ ] 7.14 实现 `GET /api/compliance/reports/stats` 端点（查询统计信息）
- [ ] 7.15 为所有 API 端点添加鉴权中间件（使用 API Token）

## 8. 发帖流程集成

- [ ] 8.1 创建 `src/services/compliance-check-orchestrator.ts` 文件（合规性检查协调器）
- [ ] 8.2 实现 `performComplianceCheck(postData)` 函数，执行所有合规性检查项
- [ ] 8.3 修改 `src/services/auto-post.ts`，在发帖前调用合规性检查
- [ ] 8.4 修改发帖日志结构，增加 `complianceReportId`、`sensitiveWordsReplaced` 等字段
- [ ] 8.5 修改远程发帖 API（`/api/posts/generate`），增加合规性检查前置流程
- [ ] 8.6 修改远程发帖 API（`/api/posts/execute`），增加合规性检查前置流程
- [ ] 8.7 修改远程发帖 API（`/api/posts/batch`），为每篇内容执行合规性检查
- [ ] 8.8 实现合规性检查超时处理逻辑（可配置跳过或拒绝）
- [ ] 8.9 实现发帖失败重试逻辑（最多尝试 3 次不同主题）

## 9. 配置和文档

- [ ] 9.1 更新 `config/default.yaml`，添加所有合规性检查相关的配置项和默认值
- [ ] 9.2 更新 `README.md`，增加合规性检查功能的说明
- [ ] 9.3 创建 `docs/compliance-check.md` 文档，详细说明合规性检查机制和配置指南
- [ ] 9.4 创建敏感词库示例文件，包含常见敏感词和分级说明
- [ ] 9.5 编写 API 文档，说明所有新增的合规性检查 API 端点

## 10. 测试和验证

- [ ] 10.1 编写内容去重服务的集成测试
- [ ] 10.2 编写敏感词过滤服务的集成测试
- [ ] 10.3 编写内容质量评分服务的集成测试
- [ ] 10.4 编写发帖间隔控制服务的集成测试
- [ ] 10.5 编写合规性检查 API 的端到端测试
- [ ] 10.6 编写发帖流程集成的端到端测试
- [ ] 10.7 执行性能测试，确保单次合规性检查耗时 < 500ms
- [ ] 10.8 执行压力测试，验证并发场景下的稳定性
- [ ] 10.9 人工验证：使用测试账号执行真实发帖，验证合规性检查效果

## 11. 监控和日志

- [ ] 11.1 添加合规性检查指标监控（检查次数、通过率、平均耗时）
- [ ] 11.2 添加敏感词检测统计（检测到的敏感词数量、级别分布）
- [ ] 11.3 添加质量评分统计（平均分、合格率、各维度得分分布）
- [ ] 11.4 添加发帖间隔控制统计（间隔不足拒绝次数、白名单豁免次数）
- [ ] 11.5 添加合规性检查错误日志（超时、异常、拒绝原因）
- [ ] 11.6 配置监控告警（通过率异常、耗时异常、错误率异常）
