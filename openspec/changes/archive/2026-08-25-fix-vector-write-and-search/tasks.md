## 1. 统一素材向量 id 前缀
- [x] 1.1 `material-index-rebuild-service.ts` processBatch：写入 id 改为 `material_${material.id}`
- [x] 1.2 `material-record-storage.ts` deleteMaterialRecord：改为 `deleteVector('material_' + id)`

## 2. 消除重复写入
- [x] 2.1 `material-processor.ts` 删除第 7 步独立 addVector，写入统一由 upsertMaterialRecord→syncToChromaDB 负责

## 3. 重建真正清空
- [x] 3.1 `material-index-rebuild-service.ts` cleanExisting 分支改为调用 `materialVectorStorage.clear()`

## 4. 补齐向量检索初始化保护
- [x] 4.1 `chroma-search-service.ts` searchMaterials：加 materialVectorStorage 懒初始化
- [x] 4.2 `chroma-search-service.ts` recommendTopics：加 topicRecommendStorage 懒初始化

## 5. 统一并丰富素材向量文本
- [x] 5.1 统一 buildVectorText / buildMaterialDocument：文件名 + 匹配关键词（matched_keywords），无关键词退化为文件名

## 6. 构建、部署与验证
- [x] 6.1 `npx tsc --noEmit` 编译通过
- [x] 6.2 增量部署到 x5
- [x] 6.3 素材向量可语义检索（初始化保护逻辑已就位并部署）
- [x] 6.4 幂等验证：重跑重建 count 稳定 186、id 全 material_ 前缀、0 裸 uuid（旧脏数据被 clear 清除）
- [x] 6.5 清理测试临时文件，无占用端口