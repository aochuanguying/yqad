## 1. 依赖和配置

- [ ] 1.1 安装 sharp 依赖（npm install sharp）
- [ ] 1.2 更新 config/default.yaml，添加 materials 配置段（rawPath, processedPath, basePath）
- [ ] 1.3 创建配置类型定义（src/types/materials.ts）

## 2. 实现素材扫描器

- [ ] 2.1 创建 src/services/material-scanner.ts 文件
- [ ] 2.2 实现 scanDirectory 函数（递归扫描，返回文件路径列表）
- [ ] 2.3 实现 calculateFileHash 函数（SHA-256 哈希）
- [ ] 2.4 实现 filterSupportedFiles 函数（过滤扩展名、隐藏文件、符号链接）
- [ ] 2.5 实现 isNewMaterial 函数（检查 hash 是否存在于数据库）
- [ ] 2.6 添加单元测试

## 3. 实现素材处理器

- [ ] 3.1 创建 src/services/material-processor.ts 文件
- [ ] 3.2 实现 extractImageMetadata 函数（使用 sharp 提取 width/height/format/size）
- [ ] 3.3 实现 generateDescription 函数（AI 生成描述）
- [ ] 3.4 实现 generateTags 函数（AI 生成标签）
- [ ] 3.5 实现 processMaterial 函数（完整处理流程：元数据 + 描述 + 标签）
- [ ] 3.6 实现 batchProcessMaterials 函数（分批处理，每批 50 个）
- [ ] 3.7 添加错误处理和日志记录
- [ ] 3.8 添加单元测试

## 4. 完善素材整理调度器

- [ ] 4.1 修改 src/index.ts 的 materialProcessing 处理器（替换占位符）
- [ ] 4.2 实现 organizeMaterials 主函数（扫描 → 处理 → 录入 → 向量化）
- [ ] 4.3 实现并发控制（使用 scheduler.materialRunning 标志）
- [ ] 4.4 实现统计报告（成功数、失败数、跳过数、耗时）
- [ ] 4.5 添加详细日志记录
- [ ] 4.6 修改 src/web/routes/materials-routes.ts 实现 POST /api/materials/organize

## 5. 实现向量同步工具

- [ ] 5.1 创建 src/tools/vector-sync-tool.ts 文件
- [ ] 5.2 实现 syncHistoricalMaterials 函数（批量同步历史素材）
- [ ] 5.3 实现 buildVectorText 函数（组合描述 + 标签 + 文件名）
- [ ] 5.4 实现批量向量化（每批 100 个）
- [ ] 5.5 添加进度跟踪和日志
- [ ] 5.6 支持断点续传（记录已处理 ID）

## 6. 集成测试和验证

- [ ] 6.1 准备测试素材（10-20 张不同格式的图片）
- [ ] 6.2 执行完整素材整理 Pipeline
- [ ] 6.3 验证 MySQL 记录正确性
- [ ] 6.4 验证 ChromaDB 向量生成
- [ ] 6.5 验证语义搜索功能
- [ ] 6.6 测试错误场景（损坏文件、AI 服务不可用）

## 7. 文档和清理

- [ ] 7.1 更新 README.md 素材整理章节
- [ ] 7.2 创建素材整理使用指南（docs/MATERIAL_ORGANIZER.md）
- [ ] 7.3 清理调试日志
- [ ] 7.4 代码审查和格式化
