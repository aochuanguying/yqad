# 发帖逻辑全面复盘报告

## 一、历史任务回顾

### 1.1 发帖模式演变

#### 第一阶段：基础发帖
- **功能**：基于预配置主题发帖
- **流程**：选择主题 → AI 生成内容 → 选择图片 → 发布
- **问题**：内容单一，容易重复

#### 第二阶段：主题多样化
- **新增**：子方向选择、提纲变体生成
- **目的**：同一主题下产生不同角度的内容
- **实现**：`topicDiversityService.selectBalancedSubDirection()`

#### 第三阶段：混合素材服务
- **新增**：本地素材 + 互联网素材混合使用
- **目的**：提高图片质量和相关性
- **实现**：`hybridMaterialService.selectHybridMaterials()`

#### 第四阶段：互联网参考模式（自由发帖）
- **新增**：从小红书等平台获取参考素材
- **目的**：无主题时也能生成高质量内容
- **实现**：`internet-reference-service.search()`

#### 第五阶段：合规性检查
- **新增**：内容合规性自动审查
- **目的**：降低违规风险
- **实现**：`complianceCheckOrchestrator.check()`

#### 第六阶段：内容去重
- **新增**：语义级别的重复检测
- **目的**：避免与历史帖子重复
- **实现**：`contentDeduplicationService.checkSimilarity()`

---

## 二、当前发帖逻辑架构

### 2.1 两种发帖模式

#### 模式 1：主题发帖（postWithTopic）
```
可用主题？
  ↓ 是
选择子方向 → 生成提纲变体 → AI 生成内容 → 标题去重
  ↓
选择混合素材 → 上传图片 → 匹配热门话题
  ↓
应用多样化变换 → 合规性检查 → 发布并记录
```

**调用链路**：
- `performDailyPosts()` → `postWithTopic()` → Pipeline 8 步骤

**适用场景**：
- 有预配置主题时
- 每日自动发帖优先使用

#### 模式 2：自由发帖（postFreeStyle）
```
无可用主题？
  ↓
互联网参考模式（tryInternetReferenceMode）
  ↓
查询互联网参考素材 → AI 改写 → 抄袭检测
  ↓
选择混合素材 → 上传图片 → 匹配话题 → 发布
```

**调用链路**：
- `performDailyPosts()` → `postFreeStyle()` → `tryInternetReferenceMode()`

**适用场景**：
- 无预配置主题时
- 主题耗尽后的降级方案

---

### 2.2 核心流程对比

| 步骤 | 主题发帖 | 自由发帖 |
|------|---------|---------|
| 1. 内容来源 | 主题方向 + 子方向 | 互联网参考素材 |
| 2. 提纲生成 | 子方向提纲变体 | 参考帖子标题 |
| 3. AI 生成 | `generatePostWithDedup()` | `generatePostWithMinChars()` |
| 4. 去重检查 | 标题去重（最多 2 次重试） | 抄袭检测（互联网参考） |
| 5. 素材选择 | 混合素材服务（本地 + 网络） | 混合素材服务（本地 + 去水印网络图） |
| 6. 图片上传 | 批量上传，失败降级 | 同左 |
| 7. 话题匹配 | 热门话题匹配 | 同左 |
| 8. 多样化 | 标题变换、内容变换 | 无 |
| 9. 合规检查 | 强制检查 | 无（应添加） |
| 10. 发布记录 | 发帖历史 + 日志 | 同左 |

---

## 三、已实现的关键功能

### 3.1 ✅ 互联网参考服务（最新实现）

**文件**：`src/services/internet-reference-service.ts`

**功能**：
1. ✅ 频率限制控制（`canQuery()`）
2. ✅ 调用 AutoJS API 执行搜索脚本（`executeSearchScript()`）
3. ✅ 轮询获取搜索结果（`getSearchResults()`）
4. ✅ 图片去水印处理（`removeWatermark()`）
5. ✅ 完整查询流程（`search()`）

**工作流**：
```
检查配置 → 执行搜索脚本 → 轮询结果 → 去水印 → 返回参考帖子
```

**配置要求**：
- `internet_reference_config` 表：启用状态、关键词、频率限制
- `autojs_api_config` 表：API 地址、Token、脚本名称

---

### 3.2 ✅ 混合素材服务

**文件**：`src/services/hybrid-material-service.ts`

**功能**：
1. ✅ 关键词提取（AI）
2. ✅ 本地素材语义搜索（ChromaDB）
3. ✅ 互联网素材处理（下载、去水印）
4. ✅ 智能选择策略（本地优先/网络优先/混合）
5. ✅ 素材使用追溯

**选择逻辑**：
- 混合模式：按贴合度排序，不强制混合
- 本地优先：本地不足时用网络补充
- 网络优先：网络不足时用本地补充

---

### 3.3 ✅ 主题多样化服务

**文件**：`src/services/topic-diversity-service.ts`

**功能**：
1. ✅ 子方向平衡选择
2. ✅ 提纲变体生成（5 种风格）
3. ✅ 标题变换（5 种风格）
4. ✅ 内容变换（4 种技巧）
5. ✅ 使用记录追踪

**变换类型**：
- 标题：疑问式、数字式、对比式、故事式、警告式
- 内容：增加细节、调整语气、改变结构、替换词汇

---

### 3.4 ✅ 合规性检查服务

**文件**：`src/services/compliance-check-orchestrator.ts`

**功能**：
1. ✅ 敏感词检测
2. ✅ 广告识别
3. ✅ 负面情绪识别
4. ✅ 合规评分
5. ✅ 修改建议生成

**检查流程**：
```
标题 + 内容 → 多维度检查 → 合规报告 → 通过/修改/拒绝
```

---

### 3.5 ✅ 内容去重服务

**文件**：`src/services/content-deduplication-service.ts`

**功能**：
1. ✅ 语义相似度检测（ChromaDB）
2. ✅ 标题重复检测
3. ✅ 阈值控制（0.75 相似）
4. ✅ 历史内容比对

---

## 四、发现的问题和改进建议

### 4.1 ❗ 自由发帖缺少合规性检查

**问题**：
- `tryInternetReferenceMode()` 中没有调用合规性检查
- 主题发帖有合规检查，但自由发帖没有
- 可能导致违规内容发布

**建议**：
```typescript
// 在 tryInternetReferenceMode 中添加合规检查
const compliancePassed = await complianceCheckOrchestrator.check(
  generated.title,
  generated.content
);

if (!compliancePassed) {
  logger.warn('自由发帖内容未通过合规检查');
  return { success: false, error: '内容未通过合规检查' };
}
```

---

### 4.2 ❗ 互联网参考查询超时时间可能不足

**问题**：
- `getSearchResults()` 默认超时 30 秒
- 如果 AutoJS 脚本执行较慢，可能超时
- 搜索脚本需要打开 APP、搜索、抓取数据，30 秒可能不够

**建议**：
```typescript
// 增加超时时间到 60 秒
const results = await getSearchResults(taskId, 60000);
```

---

### 4.3 ❗ 搜索脚本不存在时的降级处理

**问题**：
- 如果 `audi_search.js` 脚本不存在，搜索会失败
- 当前代码返回空数组，触发 AI 直接生成
- 但应该有更明确的错误提示

**建议**：
```typescript
if (!searchResult.success) {
  logger.error('搜索脚本执行失败，可能脚本不存在');
  // 回退到 AI 直接生成
  return await generateWithAI();
}
```

---

### 4.4 ❗ 图片上传失败后的处理不够智能

**问题**：
- 图片上传全部失败时，以纯文字方式发帖
- 但精华帖要求至少 3 张图片
- 应该降级为普通帖，而不是坚持发精华帖

**建议**：
```typescript
if (imageUrls.length === 0 && featuredEnabled) {
  logger.warn('图片上传失败，降级为普通帖');
  mode = 'normal';  // 强制降级
  featuredReadiness = undefined;
}
```

---

### 4.5 ❗ 发帖失败后的重试机制缺失

**问题**：
- 发帖失败后直接返回错误
- 没有自动重试机制
- 临时网络问题会导致发帖中断

**建议**：
```typescript
// 添加重试逻辑
async function postWithRetry(
  maxRetries: number = 2
): Promise<PostResult> {
  for (let i = 0; i <= maxRetries; i++) {
    const result = await tryPostOnce();
    if (result.success || i === maxRetries) {
      return result;
    }
    logger.warn(`发帖失败，重试 ${i + 1}/${maxRetries}`);
    await sleep(3000);  // 等待 3 秒
  }
  return { success: false, error: '重试耗尽' };
}
```

---

### 4.6 ❗ 互联网参考的频率限制过于严格

**问题**：
- 默认 10 次/小时
- 如果每天发帖 10 次，可能全部触发互联网参考
- 导致部分帖子无法使用互联网参考

**建议**：
- 增加配置灵活性（如 50 次/小时）
- 或者实现智能降级：超限时自动切换到 AI 直接生成

---

### 4.7 ❗ 缺少发帖成功率统计

**问题**：
- 没有统计发帖成功率
- 无法分析哪种模式更容易成功
- 无法优化发帖策略

**建议**：
```typescript
// 添加统计功能
interface PostStatistics {
  totalPosts: number;
  successCount: number;
  topicModeSuccess: number;
  freeModeSuccess: number;
  averageImages: number;
  averageContentLength: number;
}

async function getStatistics(): Promise<PostStatistics> {
  // 从数据库统计
}
```

---

### 4.8 ❗ 自由发帖没有使用多样化变换

**问题**：
- 主题发帖有标题变换、内容变换
- 自由发帖直接使用 AI 生成的原始内容
- 内容可能缺乏变化

**建议**：
```typescript
// 在自由发帖中也应用多样化变换
const transformedTitle = await topicDiversityService.transformTitle(
  generated.title,
  '数字式'  // 或其他风格
);

const transformedContent = await topicDiversityService.transformContent(
  generated.content,
  '增加细节'
);
```

---

## 五、建议的优化清单

### 优先级 1（必须修复）

1. **添加自由发帖合规性检查**
   - 位置：`tryInternetReferenceMode()` 中发布前
   - 原因：避免违规内容

2. **增加图片上传失败降级逻辑**
   - 位置：图片上传后
   - 原因：精华帖图片不足时应降级

3. **优化互联网参考超时时间**
   - 从 30 秒增加到 60 秒
   - 原因：搜索脚本执行需要时间

---

### 优先级 2（重要改进）

4. **添加发帖失败重试机制**
   - 位置：`postWithTopic()` 和 `tryInternetReferenceMode()`
   - 原因：应对临时网络问题

5. **自由发帖添加多样化变换**
   - 位置：AI 生成内容后
   - 原因：提高内容多样性

6. **完善搜索脚本错误处理**
   - 位置：`executeSearchScript()`
   - 原因：明确错误原因

---

### 优先级 3（可选增强）

7. **添加发帖成功率统计**
   - 位置：单独的统计服务
   - 原因：数据分析优化

8. **互联网参考频率限制智能降级**
   - 位置：`canQuery()`
   - 原因：超限时自动切换模式

9. **添加发帖性能监控**
   - 记录每个步骤耗时
   - 识别性能瓶颈

---

## 六、总结

### 当前架构优势

✅ **双模式发帖**：主题发帖 + 自由发帖，灵活应对
✅ **互联网参考**：实时获取外部素材，提高质量
✅ **混合素材**：本地 + 网络，智能选择
✅ **多样化变换**：避免内容单一
✅ **合规检查**：降低违规风险
✅ **内容去重**：避免重复发帖

### 主要改进方向

🔧 **一致性**：自由发帖也需要合规检查
🔧 **容错性**：添加重试机制和降级方案
🔧 **智能化**：图片不足时自动降级
🔧 **可观测性**：添加统计和监控

### 下一步行动

1. 立即修复自由发帖合规检查缺失
2. 优化图片上传失败处理逻辑
3. 增加发帖失败重试机制
4. 完善错误日志和监控

---

**报告生成时间**：2026-06-28  
**复盘范围**：发帖逻辑历史任务 + 当前实现  
**涉及文件**：11 个��心服务文件
