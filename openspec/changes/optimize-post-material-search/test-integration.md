# 发帖选图集成测试用例

## 测试场景 1：加权匹配算法验证

### 测试目的
验证加权匹配算法能够正确按字段权重匹配素材

### 测试步骤
1. 确保素材库索引已生成（`data/materials/processed/.materials/index.json` 存在）
2. 调用发帖 API 触发选图逻辑
3. 检查日志中的匹配分数字段权重是否符合预期

### 预期结果
- tags 字段命中权重 3.0
- intro 字段命中权重 2.0
- directory 字段命中权重 1.5
- filename 字段命中权重 1.0
- 2 字 token 权重 0.5，3 字及以上权重 1.0

### 验证日志
```
素材索引匹配 X 张，最高分 XX.XX，选取 X 张
```

---

## 测试场景 2：索引缓存验证

### 测试目的
验证索引缓存机制正常工作，减少重复 IO 读取

### 测试步骤
1. 首次调用 `loadMaterialIndex()` 函数
2. 再次调用 `loadMaterialIndex()` 函数（索引文件未修改）
3. 修改索引文件后再次调用 `loadMaterialIndex()` 函数

### 预期结果
- 首次调用：读取文件并缓存
- 第二次调用：直接返回缓存数据（不读取文件）
- 文件修改后：重新读取并更新缓存

### 验证方法
检查代码执行时间或在代码中添加日志确认缓存命中

---

## 测试场景 3：稳定随机选图验证

### 测试目的
验证相同主题和日期下选图结果一致

### 测试步骤
1. 使用相同的 topicId 和 useCount 调用 `selectFeaturedImageCandidates()`
2. 在同一天内再次使用相同的 topicId 和 useCount 调用
3. 比较两次返回的图片路径数组

### 预期结果
- 相同条件下返回的图片路径数组完全一致
- 不同日期返回的结果不同

### 测试代码示例
```typescript
const result1 = selectFeaturedImageCandidates({
  keywords: '自然风光',
  minCount: 6,
  topicId: 'test-topic-1',
  useCount: 0,
});

const result2 = selectFeaturedImageCandidates({
  keywords: '自然风光',
  minCount: 6,
  topicId: 'test-topic-1',
  useCount: 0,
});

// result1 和 result2 应该完全一致
```

---

## 测试场景 4：精华补图优化验证

### 测试目的
验证精华补图按匹配分选择，不混入无关图片

### 测试步骤
1. 配置精华发帖模式（`featuredPosting.enabled = true`）
2. 设置 `minImages` 大于主选图返回数量
3. 触发 `selectFeaturedImageCandidates()` 补图
4. 检查日志中的补图信息

### 预期结果
- 补图来源为索引匹配分排序的下一批候选
- 日志显示"精华补图：按匹配分补充 X 张图片"
- 如无匹配候选，日志显示"索引中无更多匹配候选，降级为全库随机补图"

---

## 测试场景 5：Web 素材列表优先读索引

### 测试目的
验证 Web 素材列表优先从索引文件加载

### 测试步骤
1. 确保 `.materials/index.json` 存在
2. 调用 `GET /api/materials` API
3. 检查返回的素材列表

### 预期结果
- API 返回的素材列表与索引文件内容一致
- 日志显示"从索引文件加载素材，共 X 个文件"
- 删除索引文件后，API 降级扫描文件系统并返回相同结果

---

## 测试场景 6：统一扩展名常量验证

### 测试目的
验证所有模块使用统一的扩展名常量

### 测试步骤
1. 检查 `material-processing.ts`、`image-selector.ts`、`materials-service.ts`
2. 确认所有文件都导入并使用 `SUPPORTED_IMAGE_EXTENSIONS`
3. 验证支持的扩展名包括：`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, `.heif`

### 预期结果
- 所有模块使用同一常量定义
- 无硬编码的扩展名数组
- 新增扩展名只需修改一处

---

## 性能测试：缓存机制效果

### 测试目的
验证索引缓存在大素材库下的性能提升

### 测试步骤
1. 准备包含 1000+ 素材的素材库
2. 连续调用 `loadMaterialIndex()` 100 次
3. 记录总执行时间

### 预期结果
- 首次调用后，后续调用应使用缓存
- 100 次调用总时间应小于 100ms（缓存命中）
- 无缓存时单次读取可能需要 10-50ms

---

## 回归测试：原有功能不受影响

### 测试目的
验证优化不影响原有功能

### 测试步骤
1. 测试主题指定素材路径功能
2. 测试目录兜底匹配功能
3. 测试自由发帖模式

### 预期结果
- 主题 `materialPaths` 配置仍然有效
- 索引无匹配时仍然降级到目录匹配
- 自由发帖模式正常工作
