## Context

现状（动机见 proposal.md）：

- `processMaterial` 第 3-5 步已调用 Vision（`prepareImageForVision` + `generateDescription`/`generateTags`，`requireVision: true`）生成 description 与 tags。
- 断点：第 6 步 `CreateMaterialRecordInput` 只带 `matchedKeywords: tags`，未带 description；`material_records` 表无 description 列；`material-record-storage.buildVectorText` 只用「文件名 + matched_keywords」。
- `material-processor.buildVectorText`（含 description）为死代码，删第 7 步重复写后无人调用。
- `material_records.path` 有唯一约束；向量 id 已统一为 `material_${id}`（上个变更修复）。
- Vision provider：qwen（supports_vision=1），经现有 ai-client 调用。

## Goals / Non-Goals

**Goals:**
- description 持久化到 `material_records`。
- 素材向量文本优先用 description（+tags），退化为文件名+关键词。
- 写入与重建向量文本一致。
- 存量 186 条重新识别回填。

**Non-Goals:**
- 不改 Vision 调用逻辑本身（prompt、provider 选择）。
- 不改向量维度/集合结构。
- 不改素材扫描/跳过主流程（回填走独立脚本）。

## Decisions

### 决策 1：material_records 新增可空列 description
- `ALTER TABLE material_records ADD COLUMN description TEXT NULL`（生产 MySQL 执行）。可空、不影响现有行。
- `MaterialRecord` 类型加 `description?: string`；`CreateMaterialRecordInput` 加 `description?: string`。
- upsert SQL 增加 description 列与 `description = VALUES(description)`；`mapToMaterialRecord` 映射该列。

### 决策 2：素材落库带 description
- `material-processor.ts` 第 6 步 `CreateMaterialRecordInput` 增加 `description`。

### 决策 3：统一向量文本策略（优先描述）
- `material-record-storage.buildVectorText(record)`：
  - 有 description → `description + ' ' + keywords`
  - 无 description → `fileName + ' ' + keywords`（退化）
- `material-index-rebuild-service.buildMaterialDocument(material)`：同一策略（需要 record 带 description，故重建读取的记录也要含 description 字段）。
- 删除 `material-processor.ts` 中失效的 `buildVectorText`。

### 决策 4：存量回填脚本
- 新增一次性脚本：遍历 `material_records` 全部记录 → 对每条用 processed 路径重新 `prepareImageForVision` + `generateDescription`/`generateTags` → `updateDescriptionAndKeywords`（新增或复用 update 方法）→ 重新向量化（走 syncToChromaDB 或直接 updateVector）。
- 幂等、可重跑；失败单条跳过不中断。
- 产生一次性 Vision 调用（186 次），可接受。

## Risks / Trade-offs

- **Vision 调用成本/耗时**：186 次多模态调用，一次性回填，耗时可接受；脚本单条失败不影响其它。
- **description 长度**：现有 `generateDescription` 截断 200 字，作为向量文本足够，TEXT 列无长度问题。
- **DB 变更**：加可空列低风险；需确保 upsert/映射同步更新，否则新列不生效。
- **旧向量语义漂移**：回填后向量文本从"文件名"变"描述"，检索质量提升，属预期改进。
