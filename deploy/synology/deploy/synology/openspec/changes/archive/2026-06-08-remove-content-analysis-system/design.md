## 上下文

当前系统包含完整的内容分析体系（ContentAnalysisService），用于定期分析社区帖子和评论，提取热点话题、风格特征等。该体系最初设计用于支持发帖和回帖的社区风格学习。

根据最新需求：
- 发帖不再需要学习社区风格
- 回帖不再需要学习社区风格
- 回帖需要实时分析帖子内容并回复

## 目标 / 非目标

**目标：**
- 完全移除 ContentAnalysisService 及其相关代码
- 移除 AutoPostService 和 AutoCommentService 对 ContentAnalysisService 的依赖
- 保留 CommentAnalyzer 用于回帖实时分析
- 清理所有相关配置、测试和文档

**非目标：**
- 修改 CommentAnalyzer 的核心分析逻辑（保留帖子类型识别、情感分析、主题分类、关键词提取）
- 修改 PostParser 的帖子解析功能
- 添加新的功能或替代方案

## 决策

### 1. 删除策略

**决策**：直接删除 ContentAnalysisService 整个文件，而非逐步重构。

**理由**：
- ContentAnalysisService 已无其他依赖
- 定时任务已移除（scheduler 中已清理）
- 直接删除比渐进式重构更清晰

**替代方案考虑**：
- 方案 A：先标记为废弃，后续删除 → 增加复杂度，无实际价值
- 方案 B：保留但禁用 → 遗留死代码，增加维护负担

### 2. AutoPostService 重构

**决策**：移除 ContentAnalysisService 依赖，简化发帖逻辑。

**实现方式**：
- 移除构造函数中的 `analysisService` 参数
- 删除 `ensureAnalysisData()` 方法调用
- 简化 `postFreeStyleCommunity()` 方法，移除对分析摘要的依赖
- 修改 `generatePost()` 调用，不再传递 `AnalysisSummary` 参数

### 3. AutoCommentService 重构

**决策**：移除 ContentAnalysisService 依赖，保留 CommentAnalyzer 进行实时分析。

**实现方式**：
- 移除构造函数中的 `analysisService` 参数
- 删除 `performDailyComments()` 中对 `analysisService.getSummary()` 的调用
- 保留 `CommentAnalyzer.analyzePost()` 用于实时分析帖子特征
- 修改 `generateComment()` 调用，仅传递 `PostFeatures` 参数

### 4. 配置清理

**决策**：完全移除 `config/default.yaml` 中的 `analysis` 配置块。

**配置项**：
```yaml
analysis:
  postCount: 60
  maxCacheCount: 200
  storagePath: "./data/analysis.json"
```

**理由**：配置已无任何用途，保留会导致混淆。

### 5. Web 界面清理

**决策**：移除 Web 管理界面中的"内容分析"配置 Tab。

**实现方式**：
- 在 `src/web/public/index.html` 中删除对应的 Tab 导航
- 删除 Tab 内容区域的 HTML 代码
- 删除相关的 JavaScript 事件处理代码

### 6. 配置验证器清理

**决策**：移除 `src/web/services/config-validator.ts` 中的 analysis 验证逻辑。

**实现方式**：
- 删除 analysis 配置组的验证规则
- 保留其他配置组的验证逻辑

### 7. 数据文件处理

**决策**：删除 `data/analysis.json` 文件。

**理由**：
- 文件仅由 ContentAnalysisService 使用
- 删除后无其他功能受影响
- 如未来需要，可重新生成

### 8. 测试文件处理

**决策**：删除 `tests/content-analysis-dedup.test.ts` 测试文件。

**理由**：
- 测试对象已删除
- 测试内容不再相关

## 风险 / 权衡

### 风险 1：发帖功能可能受影响

**风险**：移除 ContentAnalysisService 后，发帖功能可能无法正常工作。

**缓解措施**：
- 仔细审查 AutoPostService 的所有调用点
- 确保 `generatePost()` 方法在不传入 `AnalysisSummary` 时仍能正常工作
- 进行充分的集成测试

### 风险 2：回帖质量可能下降

**风险**：移除社区风格学习后，回帖可能不再符合社区风格。

**权衡**：
- 这是业务决策的结果
- 实时帖子分析仍能提供上下文相关的回复
- 质量变化在可接受范围内

### 风险 3：配置验证失败

**风险**：移除 analysis 配置后，配置验证器可能报错。

**缓解措施**：
- 同步更新 config-validator.ts
- 确保验证逻辑与配置保持一致

### 风险 4：遗留引用

**风险**：代码中可能存在对 ContentAnalysisService 的隐性引用。

**缓解措施**：
- 使用全局搜索确认所有引用点
- 编译检查确保无 TypeScript 错误
- 运行时测试验证功能正常

## 迁移计划

### 阶段 1：删除核心服务
1. 删除 `src/services/content-analysis.ts`
2. 删除 `data/analysis.json`

### 阶段 2：重构依赖服务
1. 重构 AutoPostService
2. 重构 AutoCommentService

### 阶段 3：清理入口和配置
1. 更新 `src/index.ts`
2. 更新 `config/default.yaml`
3. 更新 Web 界面
4. 更新配置验证器

### 阶段 4：清理测试和文档
1. 删除测试文件
2. 归档或删除规范文档

### 回滚策略

如需回滚：
1. 从 Git 历史恢复删除的文件
2. 恢复配置项
3. 重新注入依赖

**注意**：本次变更涉及大量代码删除，回滚成本较高。建议在合并前充分测试。
