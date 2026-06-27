## 上下文

当前发帖素材选择逻辑位于 [image-selector.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/services/image-selector.ts)，索引匹配仅按 token 是否出现在 `searchableText` 进行等权统计。素材索引由 [material-processing.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/services/material-processing.ts) 生成并维护，Web 素材列表由 [materials-service.ts](file:///Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/中转站/yqad/src/web/services/materials-service.ts) 扫描文件系统生成，导致 Web 端与发帖端数据源割裂。

**约束：**
- 必须保持现有 API 行为向后兼容
- 不能破坏主题指定素材路径的现有逻辑
- 缓存机制不能影响素材梳理后的及时刷新

## 目标 / 非目标

**目标：**
- 提高发帖素材匹配精度，减少无关图片被选中
- 统一扩展名定义，避免不同模块支持不一致
- 减少重复 IO 读取，提升大素材库下的发帖性能
- 精华补图不偏离主题，保持内容质量
- 选图结果可复现，便于问题排查

**非目标：**
- 不引入向量数据库或语义检索模型（保持轻量级）
- 不改变 `.materials/index.json` 的文件格式
- 不修改素材梳理的核心流程（转换、Vision 识别等）

## 决策

### 1. 加权匹配算法

**决策：** 引入字段权重机制，计算公式为：
```
score = sum(token_matches * weight_map[field] * token_weight)
```
其中：
- `tags`: 权重 3.0（用户明确标注的标签最相关）
- `intro`: 权重 2.0（Vision 生成的描述较准确）
- `directory`: 权重 1.5（目录名通常反映内容分类）
- `filename`: 权重 1.0（文件名可能包含描述信息）
- 2 字 token 权重 0.5，3 字及以上权重 1.0（减少泛化误命中）

**替代方案：**
- 使用 TF-IDF 或 BM25：过于复杂，需要维护语料库统计信息
- 使用向量相似度：需要引入 embedding 模型，增加依赖和计算成本

**理由：** 加权匹配在保持简单的前提下显著提升精度，且易于调试和调优。

### 2. 索引缓存机制

**决策：** 在 `material-processing.ts` 中实现基于文件 mtime 的内存缓存：
```typescript
interface IndexCache {
  mtimeMs: number;
  data: MaterialIndex;
}
let _indexCache: IndexCache | null = null;

function loadMaterialIndex(): MaterialIndex {
  const stat = fs.statSync(materialIndexPath);
  if (_indexCache && _indexCache.mtimeMs === stat.mtimeMs) {
    return _indexCache.data;
  }
  // 读取并缓存
}
```

在 `rebuildMaterialIndex()` 完成后主动清空缓存。

**替代方案：**
- 使用 LRU 缓存：不需要，只有一个索引文件
- 定时刷新：不如 mtime 检测精确

**理由：** mtime 检测简单可靠，只在文件变化时重新读取，避免不必要的 IO。

### 3. 统一扩展名常量

**决策：** 在 `material-processing.ts` 中导出 `SUPPORTED_IMAGE_EXTENSIONS` 常量：
```typescript
export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
```

在 `image-selector.ts`、`materials-service.ts`、上传前校验等处统一导入使用。

**理由：** 避免不同模块支持不一致，修改扩展名列表时只需改一处。

### 4. 稳定随机选图

**决策：** 使用 `seedrandom` 库或简单的 hash 函数生成确定性随机种子：
```typescript
function seededRandom(seed: string): number {
  const hash = crypto.createHash('md5').update(seed).digest('uint32LE');
  return (hash % 10000) / 10000;
}

function seededSelect<T>(items: T[], seed: string, maxCount: number): T[] {
  const shuffled = [...items];
  for (let i = 0; i < maxCount; i++) {
    const j = i + Math.floor(seededRandom(seed + i) * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxCount);
}
```

种子格式：`${topic.id}-${useCount}-${dateStr}`

**理由：** 在保留随机性的同时，相同主题和日期下选图结果可复现。

### 5. 精华补图优化

**决策：** 修改 `selectFeaturedImageCandidates()` 逻辑：
```typescript
// 当前：图片不足时全库随机补图
const additional = randomSelect(remainingPool, needed + 8);

// 优化后：按索引得分继续取下一批候选
const topCandidates = scoredItems
  .filter(x => !selected.includes(x.item.relativePath))
  .slice(selected.length, selected.length + needed + 8);
const additional = topCandidates.map(x => path.resolve(basePath, x.item.relativePath));
```

如无更多候选，记录日志并降级为普通帖。

**理由：** 避免为了凑数混入无关图片，保持内容质量。

### 6. Web 与发帖数据源统一

**决策：** 修改 `materials-service.ts` 的 `refreshMaterials()`：
```typescript
export async function refreshMaterials(): Promise<MaterialItem[]> {
  // 优先读取索引
  const index = loadMaterialIndex();
  if (index && index.items.length > 0) {
    return index.items.map(item => ({
      filename: item.filename,
      directory: item.directory,
      relativePath: item.relativePath,
      size: item.size,
      // ...
    }));
  }
  // 降级：扫描文件系统
  return scanDirectory(processedPath);
}
```

**理由：** Web 端和发帖端使用同一数据源，避免展示不一致。

## 风险 / 权衡

**[风险] 缓存可能导致素材更新延迟** → 缓解措施：在 `rebuildMaterialIndex()` 完成后主动清空缓存，确保梳理后立即生效

**[风险] 加权参数需要调优** → 缓解措施：将权重配置化，支持运行时调整，记录匹配日志便于分析

**[风险] 稳定随机可能降低多样性** → 缓解措施：种子包含日期，每天自动变化；支持配置关闭稳定随机

**[风险] Web 读取索引可能遗漏未梳理素材** → 缓解措施：索引为空或不存在时降级扫描文件系统，用户可手动触发梳理

## 迁移计划

1. **阶段 1**：实现索引缓存和加权匹配，不改变默认行为
2. **阶段 2**：统一扩展名常量，更新所有引用点
3. **阶段 3**：实现稳定随机和精华补图优化
4. **阶段 4**：Web 端切换为优先读索引

**回滚策略：** 如出现问题，可通过配置开关关闭加权匹配和稳定随机，回退到原有逻辑。

## Open Questions

- 权重参数的默认值是否需要通过实验数据调优？
- 是否需要为加权匹配提供配置界面？
- 稳定随机是否需要支持按小时变化（更高频）？
