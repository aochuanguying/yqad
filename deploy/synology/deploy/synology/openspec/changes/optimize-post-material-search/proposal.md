## 为什么

当前发帖寻找素材时，索引匹配算法过于简单，仅按 token 是否出现在 `searchableText` 进行等权匹配，未对 tags、intro、directory 等字段区分权重，导致匹配精度不足。同时存在扩展名支持不一致、索引缓存缺失、Web 端与发帖端数据源割裂等问题，影响发帖质量和用户体验。

## 变更内容

- **优化索引匹配算法**：引入字段权重机制，tags 权重最高，intro 次之，directory/filename 再次，降低 2 字 token 权重，减少泛化误命中
- **统一扩展名常量**：将素材扩展名配置抽到共享模块，确保素材处理、Web 浏览、发帖选图使用同一份扩展名定义
- **增加索引缓存**：为 `loadMaterialIndex()` 增加基于文件 mtime 的内存缓存机制，避免每次发帖重复读取大 JSON
- **改进精华补图策略**：图片不足时按索引得分继续取下一批候选，而非全库随机补图，避免语义偏离
- **增加稳定选图种子**：按 `topic.id + useCount + 日期` 生成伪随机种子，保留变化同时方便复现排查
- **统一 Web 与发帖数据源**：Web 素材列表优先读取 `.materials/index.json`，缺索引时再扫描文件系统兜底

## 功能 (Capabilities)

### 新增功能
- `material-index-cache`: 素材索引缓存机制，支持基于 mtime 的缓存失效
- `weighted-matching`: 加权匹配算法，按 tags、intro、directory 等字段权重计算匹配分
- `stable-random`: 稳定随机选图，基于 topic 和日期的确定性随机种子
- `featured-complement`: 精华补图优化，按相似度补齐而非全库随机

### 修改功能
- `post-materials`: 发帖素材选择逻辑变更，引入加权匹配和稳定随机
- `auto-post`: 自动发帖流程中精华补图策略变更

## 影响

- **代码影响**：需修改 [image-selector.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/services/image-selector.ts)、[material-processing.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/services/material-processing.ts)、[materials-service.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/web/services/materials-service.ts)
- **API 影响**：无破坏性变更，现有 API 行为保持一致
- **依赖影响**：无新增外部依赖
- **配置影响**：可选配置加权参数和随机种子策略，默认行为向后兼容
