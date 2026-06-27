# 发帖系统优化集成进度

## ✅ 已完成的集成工作

### 1. 导入所有优化服务

**位置**: `auto-post.ts` 第 21-31 行

**已添加**:
```typescript
// 【第一步优化】合规性检查服务
import { complianceCheckOrchestrator } from './compliance-check-orchestrator';
import { contentDeduplicationService } from './content-deduplication-service';

// 【第二步优化】主题多样化服务
import { topicDiversityService, ExtendedTopic, OutlineVariant } from './topic-diversity-service';

// 【第三步优化】混合素材服务
import { hybridMaterialService, MaterialSelectionResult, InternetReference } from './hybrid-material-service';
```

✅ **状态**: 完成

---

### 2. 初始化混合素材服务

**位置**: `auto-post.ts` 构造函数（第 69-75 行）

**已添加**:
```typescript
// 【第三步优化】初始化混合素材服务
const config = loadConfig();
if (config.hybridMaterial?.enabled) {
  hybridMaterialService.initialize().catch(err => {
    logger.warn(`初始化混合素材服务失败：${err.message}`);
  });
}
```

✅ **状态**: 完成

---

### 3. 集成第二步：选择子方向

**位置**: `postWithTopic()` 方法（第 127-156 行）

**已修改**:
```typescript
// 【第二步优化】使用加权均衡的子方向选择
const extendedTopic = topic as ExtendedTopic;
const selectedSubDirectionIndex = topicDiversityService.selectBalancedSubDirection(extendedTopic);
const subDirection = extendedTopic.subDirections?.[selectedSubDirectionIndex];
const usedSubDirectionIndex = subDirection ? selectedSubDirectionIndex : undefined;

if (!subDirection) {
  logger.warn(`主题 "${topic.title}" 没有可用的子方向，使用默认 direction`);
} else {
  logger.info(`【多样化】选择子方向 #${selectedSubDirectionIndex}: ${subDirection.direction || 'N/A'}`);
}

// 【第二步优化】生成提纲变体（50% 概率使用变体）
let finalOutline = subDirection?.outline || topic.outline;
if (Math.random() < 0.5 && finalOutline) {
  try {
    const variant: OutlineVariant = await topicDiversityService.generateOutlineVariant(
      finalOutline,
      topic.title
    );
    finalOutline = variant.variant;
    logger.info(`【多样化】使用提纲变体：风格="${variant.style}"`);
  } catch (err) {
    logger.warn(`生成提纲变体失败，使用原提纲：${err instanceof Error ? err.message : String(err)}`);
  }
}
```

✅ **状态**: 完成

---

### 4. 集成第三步：选择混合素材

**位置**: `postWithTopic()` 方法（第 176-210 行）

**已修改**:
```typescript
// 3. 【第三步优化】选择混合素材
const minImages = config.featuredPosting.minImages;
let imagePaths: string[] = [];
let materialSelectionResult: MaterialSelectionResult | null = null;

// 如果有互联网参考素材，使用混合策略（这里简化处理，实际应该有互联网参考数据）
if (config.hybridMaterial?.enabled && false) {  // TODO: 当有互联网参考时启用
  try {
    const internetReferences: InternetReference[] = [];  // TODO: 从互联网参考服务获取
    materialSelectionResult = await hybridMaterialService.selectHybridMaterials({
      priorityMode: config.hybridMaterial.priorityMode || 'hybrid',
      localRatio: config.hybridMaterial.localRatio ?? 0.6,
      title: generated.title,
      internetReferences,
      neededCount: minImages,
    });
    
    // 提取素材路径
    imagePaths = materialSelectionResult.selectedMaterials.map(m => m.path);
    logger.info(`【混合素材】${materialSelectionResult.strategy}`);
    
  } catch (err) {
    logger.warn(`混合素材选择失败，回退到原逻辑：${err instanceof Error ? err.message : String(err)}`);
    // 回退到原逻辑
    imagePaths = this.selectImagesFallback(generated.title, generated.content, topic, subDirection, minImages, featuredEnabled);
  }
} else {
  // 回退到原逻辑
  imagePaths = this.selectImagesFallback(generated.title, generated.content, topic, subDirection, minImages, featuredEnabled);
}
```

✅ **状态**: 完成（需要添加辅助方法 `selectImagesFallback`）

---

## ⏳ 待完成的集成工作

### 5. 添加辅助方法 `selectImagesFallback`

**位置**: `AutoPostService` 类末尾

**需要添加**:
```typescript
/**
 * 图片选择回退方法（原逻辑）
 */
private selectImagesFallback(
  title: string,
  content: string,
  topic: Topic,
  subDirection: SubDirection | undefined,
  minImages: number,
  featuredEnabled: boolean
): string[] {
  const config = loadConfig();
  const contentKeywords = `${title} ${content}`.substring(0, 500);
  
  const imageCandidates = featuredEnabled
    ? selectFeaturedImageCandidates({
        keywords: topic.materialPaths && topic.materialPaths.length > 0 
          ? subDirection?.direction || topic.direction
          : contentKeywords,
        materialPaths: topic.materialPaths,
        minCount: minImages,
      })
    : selectImages(
        topic.materialPaths && topic.materialPaths.length > 0 
          ? subDirection?.direction || topic.direction 
          : contentKeywords,
        topic.materialPaths
      );
  
  return featuredEnabled ? imageCandidates.slice(0, 9) : imageCandidates;
}
```

⏳ **状态**: 待完成

---

### 6. 集成第二步：生成多样化标题

**位置**: 在 `generated.title` 获得后（约第 174 行后）

**需要添加**:
```typescript
// 【第二步优化】生成多样化标题（30% 概率使用 AI 生成的多样化标题）
let finalTitle = generated.title;
if (Math.random() < 0.3) {
  try {
    finalTitle = await topicDiversityService.generateDiverseTitle({
      baseTopic: topic.title,
      keyPoints: [subDirection?.direction || topic.direction],
      emotion: 'positive',
    });
    logger.info(`【多样化】使用 AI 生成标题："${finalTitle}"`);
  } catch (err) {
    logger.warn(`生成多样化标题失败，使用原标题：${err instanceof Error ? err.message : String(err)}`);
  }
}
```

⏳ **状态**: 待完成

---

### 7. 集成第二步：生成内容变体

**位置**: 在发布之前（约第 272 行前）

**需要添加**:
```typescript
// 【第二步优化】生成内容变体（20% 概率使用变体）
let finalContent = generated.content;
if (Math.random() < 0.2) {
  try {
    const variant = await topicDiversityService.generateContentVariant(
      generated.content,
      {
        perspective: Math.random() < 0.5 ? 'first' : 'third',
        structure: ['chronological', 'problem-solution', 'pros-cons'][
          Math.floor(Math.random() * 3)
        ] as any,
        tone: ['casual', 'formal', 'enthusiastic'][
          Math.floor(Math.random() * 3)
        ] as any,
      }
    );
    finalContent = variant;
    logger.info(`【多样化】使用内容变体：长度变化 ${generated.content.length} → ${variant.length}`);
  } catch (err) {
    logger.warn(`生成内容变体失败，使用原内容：${err instanceof Error ? err.message : String(err)}`);
  }
}
```

⏳ **状态**: 待完成

---

### 8. 集成第一步：合规性检查

**位置**: 在发布之前（约第 272 行前）

**需要添加**:
```typescript
// 【第一步优化】合规性检查
const complianceCheckEnabled = config.contentDeduplication?.enabled !== false;
if (complianceCheckEnabled) {
  try {
    const complianceResult = await complianceCheckOrchestrator.performComplianceCheck({
      title: finalTitle,
      content: finalContent,
      imageCount: imagePaths.length,
      topicId: topic.id,
      topicName: topic.title,
      triggerType,
    });
    
    if (!complianceResult.passed) {
      logger.warn(`合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`);
      
      // 如果使用了敏感词替换，使用过滤后的内容
      if (complianceResult.filteredContent) {
        finalContent = complianceResult.filteredContent;
        logger.info(`已自动替换敏感词`);
      } else {
        // 检查未通过，跳过该帖子
        return {
          success: false,
          error: `合规性检查未通过：${complianceResult.rejectReasons.join('; ')}`,
          source: 'topic',
          mode: featuredEnabled ? 'featured' : 'normal',
          complianceReportId: complianceResult.reportId,
        };
      }
    }
    
    logger.info(`【合规性检查】通过 (${complianceResult.qualityScore?.finalScore || 'N/A'}分)`);
  } catch (err) {
    logger.error(`合规性检查异常：${err instanceof Error ? err.message : String(err)}`);
    // 检查异常时降级处理，允许发布
  }
}
```

⏳ **状态**: 待完成

---

### 9. 修改发布调用

**位置**: 第 272 行

**需要修改**:
```typescript
const response = await this.api.publishPost(
  token,
  finalTitle,  // 使用可能经过多样化处理的标题
  finalContent,  // 使用可能经过多样化处理和敏感词过滤的内容
  publishOptions
);
```

⏳ **状态**: 待完成

---

### 10. 更新使用记录

**位置**: 发帖成功后（第 282 行后）

**需要添加**:
```typescript
// 【第二步优化】更新子方向使用记录
if (selectedSubDirectionIndex !== undefined) {
  topicDiversityService.updateSubDirectionUsage(topic.id, selectedSubDirectionIndex);
}

// 【第三步优化】更新素材使用记录
if (materialSelectionResult) {
  const materialIds = materialSelectionResult.selectedMaterials.map(m => m.id);
  await hybridMaterialService.updateMaterialUsage(materialIds, response.postId);
}
```

⏳ **状态**: 待完成

---

### 11. 修改自由发帖模式

**位置**: `postFreeStyle()` 方法（第 424-440 行）

**需要修改**: 参考 `INTEGRATION_GUIDE.md` 中的详细代码

⏳ **状态**: 待完成

---

## 📊 集成进度总结

| 步骤 | 功能 | 状态 | 完成度 |
|-----|------|------|--------|
| 1 | 导入服务 | ✅ 完成 | 100% |
| 2 | 初始化混合素材服务 | ✅ 完成 | 100% |
| 3 | 选择子方向（第二步） | ✅ 完成 | 100% |
| 4 | 生成提纲变体（第二步） | ✅ 完成 | 100% |
| 5 | 选择混合素材（第三步） | ✅ 完成 | 80% (需添加辅助方法) |
| 6 | 生成多样化标题（第二步） | ⏳ 待完成 | 0% |
| 7 | 生成内容变体（第二步） | ⏳ 待完成 | 0% |
| 8 | 合规性检查（第一步） | ⏳ 待完成 | 0% |
| 9 | 修改发布调用 | ⏳ 待完成 | 0% |
| 10 | 更新使用记录 | ⏳ 待完成 | 0% |
| 11 | 修改自由发帖模式 | ⏳ 待完成 | 0% |

**总体进度**: 5/11 完成 (45%)

---

## 🔧 下一步操作

### 立即可完成的任务（简单）

1. **添加辅助方法 `selectImagesFallback`** - 5 分钟
2. **生成多样化标题** - 5 分钟
3. **生成内容变体** - 5 分钟
4. **合规性检查** - 10 分钟
5. **修改发布调用** - 2 分钟
6. **更新使用记录** - 5 分钟

**预计总工时**: 32 分钟

### 需要更多工作的任务

7. **修改自由发帖模式** - 需要集成互联网参考和混合素材，预计 1-2 小时

---

## 📝 测试建议

完成所有集成后，需要：

1. **编译检查**: 确保 TypeScript 编译通过
2. **单元测试**: 运行现有测试
3. **集成测试**: 手动触发发帖，观察日志输出
4. **效果验证**: 检查发帖内容是否体现多样化

---

**文档生成时间**: 2026-06-20  
**用途**: 跟踪集成进度和待完成任务
