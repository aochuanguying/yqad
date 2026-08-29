## 1. 数据库加字段
- [ ] 1.1 生产 MySQL 执行 `ALTER TABLE material_records ADD COLUMN description TEXT NULL`
- [ ] 1.2 确认列已添加且现有数据不受影响

## 2. 打通 description 数据流
- [ ] 2.1 `MaterialRecord` 类型加 `description?: string`；`CreateMaterialRecordInput` 加 `description?: string`
- [ ] 2.2 upsert SQL 增加 description 列与 `description = VALUES(description)`
- [ ] 2.3 `mapToMaterialRecord` 映射 description 列
- [ ] 2.4 `material-processor.ts` 第 6 步落库带上 description

## 3. 向量文本改用描述
- [ ] 3.1 `material-record-storage.buildVectorText`：有 description 用 description+keywords，无则退化文件名+keywords
- [ ] 3.2 `material-index-rebuild-service.buildMaterialDocument`：同一策略
- [ ] 3.3 删除 `material-processor.ts` 中失效的 buildVectorText 死代码

## 4. 存量回填脚本
- [x] 4.1 新增 `src/tools/backfill-material-descriptions.ts`：遍历记录重新 Vision 生成描述/标签、upsert 重新向量化（须容器内运行，素材文件在容器内）
- [x] 4.2 复用 upsertMaterialRecord（带 description，内部 syncToChromaDB 重新向量化）
- [x] 4.3 串行 + 单条重试 2 次 + 间隔 + FallbackChain 初始化，只处理缺有效描述的记录，幂等可重跑

## 5. 构建、部署与验证
- [x] 5.1 `npx tsc --noEmit` 编译通过
- [x] 5.2 增量部署到 x5
- [x] 5.3 回填完成：成功 176、跳过 1（文件不存在）、失败 0，185 条有真实描述
- [x] 5.4 素材语义检索提升：海边风景 0.486、悬空寺 0.479（此前文件名向量为负相关 -0.10）
- [x] 5.5 抽查描述均为真实 Vision 内容（如"悬空寺建筑群依附悬崖峭壁"），向量可命中相关查询
- [x] 5.6 清理测试进程/日志，不占用端口