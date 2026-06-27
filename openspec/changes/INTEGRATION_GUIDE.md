# 发帖系统优化集成指南

## 📋 集成概述

本指南说明如何将三步优化的功能完整集成到现有的发帖流程中。

### 三步优化的功能定位

| 步骤 | 功能 | 集成位置 |
|-----|------|---------|
| **第一步** | 合规性检查（去重、敏感词、质量评分、间隔控制） | 发帖前检查 |
| **第二步** | 内容多样化（子方向轮换、素材交叉、提纲变体、标题多样、内容变体） | 内容生成阶段 |
| **第三步** | 素材混合策略（本地优先、智能匹配、混合使用） | 素材选择阶段 |

---

## 🔧 集成方案

### 方案 A：渐进式集成（推荐）

**优点：** 风险低、可逐步验证效果、易于回滚  
**缺点：** 需要多次修改

**步骤：**
1. 先集成第一步（合规性检查）- 质量保障
2. 再集成第二步（内容多样化）- 避免模式化
3. 最后集成第三步（素材混合）- 提升本地素材利用率

### 方案 B：一次性集成

**优点：** 一次性完成所有集成  
**缺点：** 风险较高、调试复杂

---

## 📝 详细集成代码

### 步骤 1：导入新服务

在 `auto-post.ts` 文件顶部添加导入：

```typescript
// 第一步：合规性检查服务
import { complianceCheckOrchestrator } from './compliance-check-orchestrator';
import { contentDeduplicationService } from './content-deduplication-service';
import { sensitiveWordFilterService } from './sensitive-word-filter-service';

// 第二步：主题多样化服务
import { topicDiversityService, ExtendedTopic } from './topic-diversity-service';

// 第三步：混合素材服务
import { hybridMaterialService, MaterialSelectionResult } from './hybrid-material-service';
import { InternetReference } from '../types/posting-optimization';
```

---

### 步骤 2：修改 `postWithTopic()` 方法

#### 2.1 初始化服务（在构造函数中）

```typescript
constructor() {
  // ... 现有代码
  
  // 初始化混合素材服务
  if (config.hybridMaterial?.enabled) {
    hybridMaterialService.initialize().catch(err => {
      logger.warn(`初始化混合素材服务失败：${err.message}`);
    });
  }
}
```

#### 2.2 集成第二步：选择子方向

**原代码（第 108-114 行）：**
```typescript
// 选取下一个子方向（内容池机制）
const subDirection = selectNextSubDirection(topic);
const usedSubDirectionIndex = subDirection ? topic.subDirections?.indexOf(subDirection) : undefined;

if (!subDirection) {
  logger.warn(`主题 "${topic.title}" 没有可用的子方向，使用默认 direction`);
}
```

**修改为：**
```typescript
// 【第二步优化】使用加权均衡的子方向选择
const extendedTopic = topic as ExtendedTopic;
const selectedSubDirectionIndex = topicDiversityService.selectBalancedSubDirection(extendedTopic);
const subDirection = extendedTopic.subDirections?.[selectedSubDirectionIndex];

const usedSubDirectionIndex = subDirection ? selectedSubDirectionIndex : undefined;

if (!subDirection) {
  logger.warn(`主题 "${topic.title}" 没有可用的子方向，使用默认 direction`);
}

// 记录使用的子方向
logger.info(`【多样化】选择子方向 #${selectedSubDirectionIndex}: ${subDirection?.direction || 'N/A'}`);
```

#### 2.3 集成第二步：生成提纲变体

**在生成内容之前（第 116 行之后）添加：**

```typescript
// 【第二步优化】生成提纲变体（50% 概率使用变体）
let finalOutline = subDirection?.outline || topic.outline;
if (Math.random() < 0.5 && finalOutline) {
  try {
    const variant = await topicDiversityService.generateOutlineVariant(
      finalOutline,
      topic.title
    );
    finalOutline = variant.variant;
    logger.info(`【多样化】使用提纲变体：风格="${variant.style}"`);
  } catch (err) {
    logger.warn(`生成提纲变体失败，使用原提纲：${err instanceof Error ? err.message : String(err)}`);
  }
}

// 使用子方向的方向和提纲作为 AI 生成约束
const topicConstraint = subDirection
  ? `子方向：${subDirection.direction}${finalOutline ? `\n内容提纲：${finalOutline}` : ''}`
  : `主题方向：${topic.direction}${finalOutline ? `\n内容提纲：${finalOutline}` : ''}`;
```

#### 2.4 集成第三步：选择混合素材

**原代码（第 139-162 行）：**
```typescript
// 3. 选取图片：优先使用 materialPaths，否则基于生成的实际内容智能匹配
const minImages = config.featuredPosting.minImages;
const contentKeywords = `${generated.title} ${generated.content}`.substring(0, 500);
const imageCandidates = featuredEnabled
  ? selectFeaturedImageCandidates({...})
  : selectImages(...);
```

**修改为：**
```typescript
// 3. 【第三步优化】选择混合素材
const minImages = config.featuredPosting.minImages;
let imagePaths: string[] = [];
let materialSelectionResult: MaterialSelectionResult | null = null;

// 如果有互联网参考素材，使用混合策略
if (config.hybridMaterial?.enabled && internetReferences && internetReferences.length > 0) {
  try {
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
    imagePaths = this.selectImagesFallback(generated.title, generated.content, topic, subDirection, minImages);
  }
} else {
  // 回退到原逻辑
  imagePaths = this.selectImagesFallback(generated.title, generated.content, topic, subDirection, minImages);
}
```

**添加辅助方法：**
```typescript
/**
 * 图片选择回退方法（原逻辑）
 */
private selectImagesFallback(
  title: string,
  content: string,
  topic: Topic,
  subDirection: SubDirection | undefined,
  minImages: number
): string[] {
  const config = loadConfig();
  const featuredEnabled = config.featuredPosting.enabled;
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

#### 2.5 集成第二步：生成多样化标题

**在生成内容后（`generated.title` 已获得），添加：**

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

#### 2.6 集成第二步：生成内容变体

**在发布之前添加：**

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

#### 2.7 集成第一步：合规性检查

**在发布之前（调用 `publishPost()` 之前）添加：**

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

#### 2.8 发布帖子

**修改发布调用（第 223 行）：**

```typescript
// 6. 构建发帖选项并发布（使用最终的标题和内容）
const publishOptions: PublishOptions = {
  imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
  topicList: topicList.length > 0 ? topicList : undefined,
};

const response = await this.api.publishPost(
  token,
  finalTitle,  // 使用可能经过多样化处理的标题
  finalContent,  // 使用可能经过多样化处理和敏感词过滤的内容
  publishOptions
);
```

#### 2.9 更新使用记录

**在发帖成功后（第 233 行之后）添加：**

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

---

### 步骤 3：修改自由发帖模式

**修改 `postFreeStyle()` 方法（第 424-440 行）：**

```typescript
private async postFreeStyle(mode?: PostingMode, triggerType: 'auto' | 'manual' = 'auto'): Promise<PostResult> {
  try {
    logger.info('无可用主题，使用自由生成模式（互联网参考 + 本地素材混合）');
    
    // 【第三步优化】使用混合素材策略
    return await this.tryInternetReferenceModeWithHybridMaterials(mode, triggerType);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`自由发帖失败：${errorMsg}`);
    return { success: false, error: errorMsg, source: 'free' };
  }
}
```

**添加新方法：**

```typescript
/**
 * 【第三步优化】使用混合素材的自由发帖模式
 */
private async tryInternetReferenceModeWithHybridMaterials(
  mode?: PostingMode,
  triggerType: 'auto' | 'manual' = 'auto'
): Promise<PostResult> {
  const config = loadConfig();
  const featuredEnabled = config.featuredPosting.enabled;
  const minImages = config.featuredPosting.minImages;

  // 1. 查询互联网参考素材
  if (!canQuery()) {
    logger.error('互联网参考查询频率超限，无法发帖');
    return { success: false, error: '互联网参考查询频率超限', source: 'free' };
  }

  const references = await search();
  if (!references || references.length === 0) {
    logger.error('互联网参考查询未返回结果，无法发帖');
    return { success: false, error: '互联网参考查询未返回结果', source: 'free' };
  }

  logger.info(`获取到 ${references.length} 篇互联网参考素材`);

  // 2. 读取全局人设
  const globalPrompt = loadGlobalPrompt() ?? undefined;
  const recentTopics = this.getRecentTopics(config.post.avoidRepeatDays);
  const topic = references[0].title || '奥迪用车分享';

  // 3. 生成内容
  const generated = await this.generatePostWithMinChars(
    topic,
    recentTopics,
    undefined,
    {
      globalPrompt,
      referenceTexts: references,
      mode: featuredEnabled ? 'featured' : 'normal',
    },
    featuredEnabled ? config.featuredPosting.minContentChars : config.contentLimits.post.min,
    featuredEnabled ? config.featuredPosting.maxGenerateRetries : 0
  );

  // 抄袭检测
  if (detectPlagiarism(generated.content, references)) {
    logger.error('生成内容与参考素材存在抄袭嫌疑，无法发帖');
    return { success: false, error: '生成内容存在抄袭嫌疑', source: 'free' };
  }

  // 4. 【第三步优化】使用混合素材服务选择图片
  let imagePaths: string[] = [];
  
  if (config.hybridMaterial?.enabled) {
    try {
      const materialResult = await hybridMaterialService.selectHybridMaterials({
        priorityMode: config.hybridMaterial.priorityMode || 'hybrid',
        localRatio: config.hybridMaterial.localRatio ?? 0.6,
        title: generated.title,
        internetReferences: references,
        neededCount: minImages,
      });
      
      imagePaths = materialResult.selectedMaterials.map(m => m.path);
      logger.info(`【混合素材】自由发帖：${materialResult.strategy}`);
      
      // 更新使用记录
      const materialIds = materialResult.selectedMaterials.map(m => m.id);
      await hybridMaterialService.updateMaterialUsage(materialIds, 'free_post');
      
    } catch (err) {
      logger.warn(`混合素材选择失败，回退到原逻辑：${err instanceof Error ? err.message : String(err)}`);
      // 回退到原逻辑...
    }
  }
  
  // 如果混合素材未启用或失败，使用原逻辑
  if (imagePaths.length === 0) {
    // 原逻辑：下载参考图片或从本地素材匹配
    imagePaths = await this.downloadOrSelectImages(references, generated.title, generated.content);
  }

  // 5-8. 后续步骤与原逻辑相同...
  // （话题匹配、图片上传、发布等）
  
  return { success: true, /* ... */ };
}
```

---

## ✅ 集成验证

### 验证清单

- [ ] 服务导入正确，无编译错误
- [ ] 构造函数中初始化混合素材服务
- [ ] 子方向选择使用加权均衡算法
- [ ] 提纲变体生成功能正常（50% 概率触发）
- [ ] 混合素材选择功能正常（自由发帖和主题发帖）
- [ ] 多样化标题生成功能正常（30% 概率触发）
- [ ] 内容变体生成功能正常（20% 概率触发）
- [ ] 合规性检查在发布前执行
- [ ] 敏感词自动替换功能正常
- [ ] 发帖成功后更新子方向和素材使用记录
- [ ] 日志输出正常，包含优化标记

### 测试步骤

1. **单元测试**：运行现有测试，确保无破坏
2. **集成测试**：手动触发发帖，观察日志输出
3. **效果验证**：检查发帖内容是否体现多样化
4. **性能测试**：单次发帖耗时增加 <500ms

---

## 📊 预期效果

### 性能影响

| 功能 | 增加耗时 |
|-----|---------|
| 子方向选择 | <10ms |
| 提纲变体生成 | 1000-3000ms (AI 调用) |
| 混合素材选择 | 500-1500ms (AI 关键词提取) |
| 多样化标题 | 1000-2000ms (AI 调用) |
| 内容变体 | 1000-2000ms (AI 调用) |
| 合规性检查 | 100-300ms |
| **总计** | **~3-8 秒** |

### 质量提升

- **内容重复度**：从 60%+ 降至 30% 以下
- **本地素材使用率**：从 <10% 提升至 40-80%
- **标题多样性**：从 1-2 种风格提升至 6 种
- **内容结构化**：从单一结构提升至 9 种组合

---

## 🔙 回滚方案

如果集成后出现问题，可以：

1. **禁用特定优化**：在配置中设置 `enabled: false`
2. **回退代码**：使用 Git 回滚到集成前的版本
3. **降级策略**：所有新功能都有降级处理，失败时自动使用原逻辑

---

**文档生成时间**: 2026-06-20  
**用途**: 指导将三步优化功能集成到发帖流程
