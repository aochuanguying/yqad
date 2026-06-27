## 1. 索引缓存机制

- [x] 1.1 在 material-processing.ts 中实现 IndexCache 接口和缓存变量
- [x] 1.2 修改 loadMaterialIndex() 函数，添加基于 mtime 的缓存逻辑
- [x] 1.3 在 rebuildMaterialIndex() 完成后清空缓存
- [ ] 1.4 为索引缓存添加单元测试

## 2. 加权匹配算法

- [x] 2.1 在 image-selector.ts 中定义字段权重常量配置
- [x] 2.2 修改 selectImagesFromIndex() 函数，实现加权匹配算法
- [x] 2.3 实现 token 长度权重逻辑（2 字 0.5，3 字及以上 1.0）
- [ ] 2.4 为加权匹配添加单元测试，验证不同字段权重效果
- [x] 2.5 添加匹配日志，记录各字段命中情况和最终得分

## 3. 稳定随机选图

- [x] 3.1 实现 seededRandom() 函数，使用 MD5 哈希生成种子
- [x] 3.2 实现 seededSelect() 函数，基于种子的 Fisher-Yates 洗牌
- [x] 3.3 修改 selectImages() 和 selectFeaturedImageCandidates() 使用稳定随机
- [ ] 3.4 为稳定随机添加单元测试，验证相同种子结果一致

## 4. 精华补图优化

- [x] 4.1 修改 selectFeaturedImageCandidates() 逻辑，按匹配分补图
- [x] 4.2 实现候选耗尽时的降级逻辑和日志记录
- [ ] 4.3 为精华补图添加单元测试，验证不混入无关图片

## 5. 统一扩展名常量

- [x] 5.1 在 material-processing.ts 中导出 SUPPORTED_IMAGE_EXTENSIONS 常量
- [x] 5.2 修改 image-selector.ts 导入并使用统一常量
- [x] 5.3 修改 materials-service.ts 导入并使用统一常量
- [x] 5.4 验证所有扩展名引用点已更新

## 6. Web 数据源统一

- [x] 6.1 修改 materials-service.ts 的 refreshMaterials() 优先读索引
- [x] 6.2 实现索引不存在时的降级扫描逻辑
- [x] 6.3 验证 Web 素材列表与发帖索引数据一致

## 7. 集成测试与验证

- [x] 7.1 创建发帖选图集成测试用例（curl 命令 md 文件）
- [ ] 7.2 验证加权匹配在真实素材库上的效果
- [ ] 7.3 验证缓存机制在大素材库下的性能提升
- [ ] 7.4 验证稳定随机在相同条件下的结果一致性
