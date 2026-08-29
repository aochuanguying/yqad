## Why

接入真实向量化后，复盘暴露出向量写入与检索的多处历史缺陷，此前因零向量而被掩盖：

- **materials 向量集合无限累积**：曾累积到 71008 条，而 MySQL 素材实际仅 186 条。根因是素材向量的 id 生成不统一（`material_${id}` 前缀 vs 裸 id）、同一素材被双写、删除路径 id 不匹配导致删不掉、重建"清理"是空实现。只增不减。
- **部分向量检索缺初始化保护**：`searchMaterials`、`recommendTopics` 调用对应 ChromaDB storage 前未确保 `initialize()`，会像去重 bug 一样抛"未初始化"被 catch 静默返回空结果，导致素材语义检索、主题推荐长期失效。
- **素材向量文本语义信息不足且不一致**：常规写入只用文件名生成向量，重建路径用另一套文本，两处不一致且都未纳入描述/标签，导致素材语义检索质量低。

现在有了真实 embedding 模型，这些缺陷从"无所谓"变成"影响功能正确性"，需一并修复。

## What Changes

- 统一 materials 向量 id 为 `material_${record.id}`（写入、重建、删除三处一致），修复删除路径 id 前缀错位。
- 去掉 `processMaterial` 中对同一素材的重复 `addVector`（第 7 步），写入统一由 `syncToChromaDB` 负责（带 findByFilePath 去重）。
- 重建服务的"清理现有索引"改为真正清空集合（复用 storage 的 clear），避免重建净增；重建写入统一带 `material_` 前缀。
- 为 `searchMaterials`、`recommendTopics` 补齐懒初始化保护（与其它 storage 一致）。
- 统一素材向量文本构建：写入与重建使用同一套、包含更多语义信息（文件名 + 关键词/标签）的文本。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities
- `vector-sync`: 素材向量的写入、重建、删除需保证 id 一致且幂等（同一素材不重复累积、可被正确删除），重建时先真正清空再回填。

## Impact

- 代码：`src/services/material-processor.ts`（去重复写）、`src/storage/mysql/material-record-storage.ts`（删除 id 前缀、向量文本）、`src/services/material-index-rebuild-service.ts`（清理实现、id 前缀、向量文本）、`src/services/chroma-search-service.ts`（searchMaterials/recommendTopics 初始化保护）。
- 数据：修复后 materials 集合不再无限累积；已重建的 186 条不受影响。
- 无破坏性变更（不改维度、不改集合结构）。日常增量部署即可。
