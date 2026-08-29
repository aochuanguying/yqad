## Why

素材整理时已调用多模态大模型（Vision）为每张图片生成自然语言描述（`description`）和标签（`tags`），但存在断点导致高质量描述被浪费：

- `material_records` 表**没有 description 字段**，Vision 生成的 `description` 落库时被直接丢弃，只存了 `tags`。
- 素材向量化实际只用「文件名 + 关键词」构建向量文本，文件名多为 `IMG_xxxx`（无语义），导致素材语义检索质量差。
- `material-processor` 中一个包含 description 的 `buildVectorText` 已成死代码，不再被调用。

结果：Vision 识别的成果没有进入向量，素材语义匹配效果远低于预期。应打通"Vision 描述 → 向量化"。

## What Changes

- `material_records` 表新增 `description` 字段（可空文本），存储 Vision 生成的图片描述。
- 素材落库时写入 `description`（贯通 `CreateMaterialRecordInput`、upsert SQL、行映射、MaterialRecord 类型）。
- 素材向量文本改用 `description + tags`（无描述时退化为文件名 + 关键词），写入与重建两处保持一致。
- 清理 `material-processor` 中失效的 `buildVectorText` 死代码。
- 提供一次性回填脚本：对存量 186 条素材重新调 Vision 生成描述、更新库、重新向量化。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities
- `vector-sync`: 素材向量文本必须基于大模型生成的图片描述（而非文件名），描述需随素材记录持久化并用于向量化。

## Impact

- 数据库：`material_records` 新增可空列 `description`（ALTER TABLE，低风险，不影响现有数据）。
- 代码：`src/storage/mysql/material-record-storage.ts`（类型/SQL/映射/向量文本）、`src/services/material-processor.ts`（落库带 description、删死代码）、`src/services/material-index-rebuild-service.ts`（向量文本用 description）。
- 数据回填：对存量 186 条素材重新识别（产生一次性大模型 Vision 调用）并重建向量。
- 无破坏性变更（不改维度/集合结构）。日常增量部署 + 一次 DB 变更 + 一次回填。
