## 为什么

当前系统的内容分析体系（ContentAnalysisService）已不再需要。发帖和回帖功能不再依赖社区风格学习，而是基于实时帖子内容分析。这简化了系统架构，减少了不必要的复杂性和数据依赖。

## 变更内容

**移除的功能：**
- **ContentAnalysisService** - 整个内容分析服务（定时分析社区帖子和评论）
- **data/analysis.json** - 分析结果持久化文件
- **配置项** - `config/default.yaml` 中的 `analysis` 配置块
- **Web 界面** - "内容分析"配置 Tab
- **配置验证器** - analysis 相关验证逻辑
- **测试文件** - `tests/content-analysis-dedup.test.ts`
- **AutoPostService 和 AutoCommentService 中对 ContentAnalysisService 的依赖注入**

**保留的功能：**
- **CommentAnalyzer** - 评论分析器（保留实时分析帖子内容的功能）
- **PostParser** - 帖子解析器（帖子内容解析功能）

**BREAKING**: 移除 ContentAnalysisService 后，系统不再支持基于社区风格的学习和分析功能。

## 功能 (Capabilities)

### 新增功能
无新增功能，本次变更仅涉及代码移除和重构。

### 修改功能
- `auto-post`: 发帖功能不再依赖 ContentAnalysisService，移除社区分析模式
- `auto-comment`: 回帖功能保留 CommentAnalyzer 进行实时帖子分析，但移除对 ContentAnalysisService 的依赖

## 影响

**受影响的代码：**
- `src/services/content-analysis.ts` - 删除整个文件
- `src/services/auto-post.ts` - 移除 ContentAnalysisService 依赖
- `src/services/auto-comment.ts` - 移除 ContentAnalysisService 依赖
- `src/index.ts` - 移除 ContentAnalysisService 初始化和注入
- `src/scheduler/index.ts` - 确认无残留引用（已移除）
- `config/default.yaml` - 移除 `analysis` 配置块
- `src/web/public/index.html` - 移除"内容分析"配置 Tab
- `src/web/services/config-validator.ts` - 移除 analysis 验证逻辑
- `tests/content-analysis-dedup.test.ts` - 删除测试文件

**受影响的文件：**
- `data/analysis.json` - 删除数据文件
- `openspec/specs/content-analysis/spec.md` - 归档或删除规范文档

**系统影响：**
- 发帖功能不再学习社区风格
- 回帖功能仍保留实时帖子分析能力
- 系统架构简化，减少了一层抽象
