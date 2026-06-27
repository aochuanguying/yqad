## 1. 删除核心服务

- [x] 1.1 删除 `src/services/content-analysis.ts` 文件
- [x] 1.2 删除 `data/analysis.json` 文件

## 2. 重构 AutoPostService

- [x] 2.1 移除 AutoPostService 构造函数中的 `analysisService` 参数和类型导入
- [x] 2.2 删除 `ensureAnalysisData()` 方法
- [x] 2.3 重构 `performDailyPosts()` 方法，移除对 analysisService 的调用
- [x] 2.4 重构 `postFreeStyleCommunity()` 方法，移除对分析摘要的依赖
- [x] 2.5 修改 `generatePost()` 调用，不再传递 `AnalysisSummary` 参数

## 3. 重构 AutoCommentService

- [x] 3.1 移除 AutoCommentService 构造函数中的 `analysisService` 参数和类型导入
- [x] 3.2 重构 `performDailyComments()` 方法，移除对 `analysisService.getSummary()` 的调用
- [x] 3.3 保留 `CommentAnalyzer.analyzePost()` 用于实时帖子分析
- [x] 3.4 修改 `generateComment()` 调用，仅传递 `PostFeatures` 参数

## 4. 更新入口和配置

- [x] 4.1 更新 `src/index.ts`，移除 ContentAnalysisService 的导入和初始化
- [x] 4.2 更新 `src/index.ts`，移除 AutoPostService 和 AutoCommentService 构造函数中的 analysisService 参数
- [x] 4.3 更新 `config/default.yaml`，移除 `analysis` 配置块
- [x] 4.4 更新 `src/scheduler/index.ts`，确认无残留引用（应该已清理）

## 5. 清理 Web 界面

- [x] 5.1 更新 `src/web/public/index.html`，删除"内容分析"Tab 导航
- [x] 5.2 删除"内容分析"Tab 内容区域的 HTML 代码
- [x] 5.3 删除相关的 JavaScript 事件处理代码
- [x] 5.4 更新 `src/web/services/config-validator.ts`，移除 analysis 验证逻辑

## 6. 清理测试和文档

- [x] 6.1 删除 `tests/content-analysis-dedup.test.ts` 测试文件
- [x] 6.2 归档或删除 `openspec/specs/content-analysis/spec.md` 规范文档
- [x] 6.3 归档或删除 `openspec/specs/analysis-dedup/spec.md` 规范文档

## 7. 验证和测试

- [x] 7.1 运行 TypeScript 编译检查，确保无类型错误
- [x] 7.2 运行单元测试，确保无失败测试
- [x] 7.3 手动测试发帖功能，确保正常工作
- [x] 7.4 手动测试回帖功能，确保实时分析正常工作
- [x] 7.5 全局搜索确认无 ContentAnalysisService 残留引用
