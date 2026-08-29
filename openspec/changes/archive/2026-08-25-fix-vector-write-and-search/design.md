## Context

现状约束（动机见 proposal.md）：

- `material_records` 表 `path` 有唯一约束，MySQL 侧素材记录本身不会因 path 重复而膨胀（稳定 186 条）。膨胀只发生在 ChromaDB 向量侧。
- ChromaDB `collection.add()` 无 upsert 语义：id 相同报错/忽略，id 不同永远新增。是否累积完全取决于上层传入 id 是否稳定。
- 现存三套 id：常规写入 `material_${id}`、重建服务裸 `id`、删除 `deleteMaterialRecord` 传裸 id。互不对齐。
- `materialVectorStorage` 已提供 `clear()`（分批删除）、`findByFilePath()`、`updateVector()`、`deleteVector()`。
- `searchMaterials`/`recommendTopics` 未做初始化保护；其它 storage（sensitive/topic-diversity/comment）已有 `if(!isInitialized) initialize()` 模式可参照。

## Goals / Non-Goals

**Goals:**
- 素材向量写入幂等：同一素材只保留一条，可被正确删除。
- 统一 id 前缀 `material_${id}` 于写入/重建/删除。
- 重建"清理"真正清空集合。
- 补齐 searchMaterials/recommendTopics 初始化保护。
- 统一并丰富素材向量文本。

**Non-Goals:**
- 不改向量维度、集合结构、距离函数。
- 不改去重/评分阈值。
- 不引入新的素材质量评估逻辑。

## Decisions

### 决策 1：统一素材向量 id 为 `material_${record.id}`
- 重建 `processBatch`（`material-index-rebuild-service.ts`）写入 id 由裸 `material.id` 改为 `material_${material.id}`。
- 删除 `deleteMaterialRecord`（`material-record-storage.ts`）由 `deleteVector(id)` 改为 `deleteVector('material_' + id)`；`deleteMaterialRecordByPath` 已走 findByFilePath 命中，保留。

### 决策 2：消除 processMaterial 的重复写入
- `material-processor.ts` 第 7 步的独立 `addVector` 删除；向量写入统一由 `upsertMaterialRecord → syncToChromaDB` 负责（其内部用 findByFilePath 做 add/update 幂等判断）。

### 决策 3：重建清理改为真正清空
- `rebuildAllIndexes` 的 `cleanExisting` 分支由空实现改为调用 `materialVectorStorage.clear()`，清空后再回填。保持默认行为可控（回填脚本按需传参）。

### 决策 4：补齐初始化保护
- `searchMaterials`：调用 `materialVectorStorage.searchSimilar` 前加 `if(!materialVectorStorage.isInitialized) await initialize()`。
- `recommendTopics`：调用 `topicRecommendStorage.recommendTopics` 前加同样保护。
- 与已修复的 `checkContentDuplicate` 一致。

### 决策 5：统一并丰富素材向量文本
- 统一 `buildVectorText`/`buildMaterialDocument`：使用「文件名 + 匹配关键词（若有）」，两处产出一致，纳入更多语义信息，提升素材语义检索质量。
- 保持向后兼容：无关键词时退化为文件名。

## Risks / Trade-offs

- **存量脏数据**：本次 materials 已重建为干净 186 条，历史脏数据已清除；修复保证不再复发。
- **向量文本变更导致旧向量语义漂移**：已回填的 186 条用旧文本（文件名）生成，改文本后新旧不一致。可选后续重跑一次回填统一，但不阻塞（检索仍可用）。
- **clear() 分批删除耗时**：素材量小（百级），影响可忽略。
- **改动分散在 4 个文件**：均为小改，风险低；逐一编译验证。
