# 优化主题发帖内容多样化 - 设计方案

## 概述

本设计文档详细描述如何实现主题发帖内容多样化优化，包括子方向轮换、素材交叉使用、提纲变体生成、标题风格多样化和内容变体生成五个核心功能。

## 架构设计

### 组件关系

```
┌─────────────────────────────────────────────────────────┐
│                   AutoPostService                       │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   子方向选择  │  │   素材选择    │  │   内容生成    │ │
│  │   (轮换策略) │  │   (交叉策略) │  │   (变体生成) │ │
│  └───────┬──────┘  └───────┬──────┘  └───────┬──────┘ │
│          │                 │                 │         │
│          ▼                 ▼                 ▼         │
│  ┌───────────────────────────────────────────────────┐ │
│  │          TopicsService (增强版)                   │ │
│  │  - 基于使用次数的子方向选择                        │ │
│  │  - 素材使用记录管理                                │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                ContentGenerator (增强版)                │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  标题生成器  │  │  提纲变体器  │  │  内容变体器  │ │
│  │  (多风格)    │  │  (AI 生成)    │  │  (结构调整)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 详细设计

### 1. 数据结构扩展

#### 1.1 Topic 接口扩展

**文件**: `src/web/services/topics-service.ts`

```typescript
export interface Topic {
  id: string;
  title: string;
  direction: string;
  outline?: string;
  materialPaths?: string[];
  subDirections?: SubDirection[];
  useCount: number;
  lastUsedAt?: string;
  
  // === 新增字段 ===
  
  /** 子方向使用次数计数（与 subDirections 数组索引对应） */
  subDirectionUsageCount?: number[];
  
  /** 素材使用记录 */
  materialUsageHistory?: MaterialUsageRecord[];
  
  /** 已使用的标题风格（用于避免重复） */
  usedTitleStyles?: TitleStyleType[];
  
  /** 上次使用的提纲变体索引 */
  lastUsedOutlineVariantIndex?: number;
}

/** 素材使用记录 */
export interface MaterialUsageRecord {
  /** 素材路径 */
  path: string;
  /** 使用次数 */
  usedCount: number;
  /** 最后使用时间 */
  lastUsedAt?: string;
  /** 关联的发帖 ID 列表 */
  postIds?: string[];
}

/** 标题风格类型 */
export type TitleStyleType = 
  | 'question'      // 提问式
  | 'sharing'       // 分享式
  | 'review'        // 评测式
  | 'comparison'    // 对比式
  | 'numeric'       // 数字式
  | 'suspense';     // 悬念式
```

#### 1.2 新增配置接口

**文件**: `src/types/posting-optimization.ts`

```typescript
/** 多样化配置 */
export interface DiversityConfig {
  /** 是否启用子方向轮换 */
  enableSubDirectionRotation: boolean;
  
  /** 是否启用素材交叉使用 */
  enableMaterialRotation: boolean;
  
  /** 是否启用提纲变体生成 */
  enableOutlineVariation: boolean;
  
  /** 是否启用标题风格多样化 */
  enableTitleStyleDiversity: boolean;
  
  /** 是否启用内容变体生成 */
  enableContentVariation: boolean;
  
  /** 标题风格权重配置 */
  titleStyleWeights?: Partial<Record<TitleStyleType, number>>;
  
  /** 素材重复使用间隔（次数） */
  materialReuseInterval?: number;
  
  /** 子方向重置阈值（当最大最小使用次数差小于此值时重置） */
  subDirectionResetThreshold?: number;
}
```

### 2. 子方向轮换机制

#### 2.1 实现逻辑

**文件**: `src/web/services/topics-service.ts`

```typescript
/**
 * 基于使用次数选择子方向（优先使用使用次数少的）
 * @param topic 主题
 * @returns 选中的子方向，如果没有可用子方向则返回 null
 */
export function selectNextSubDirection(topic: Topic): SubDirection | null {
  if (!topic.subDirections || topic.subDirections.length === 0) {
    return null;
  }

  // 初始化使用次数计数（如果不存在）
  if (!topic.subDirectionUsageCount) {
    topic.subDirectionUsageCount = new Array(topic.subDirections.length).fill(0);
  }

  // 计算每个子方向的权重（使用次数越少，权重越高）
  const weights = topic.subDirectionUsageCount.map(count => {
    // 使用反比权重：weight = 1 / (count + 1)
    // 加 1 避免除零，同时给未使用过的子方向更高权重
    return 1 / (count + 1);
  });

  // 归一化权重为概率
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map(w => w / totalWeight);

  // 轮盘赌选择
  const random = Math.random();
  let cumulative = 0;
  let selectedIndex = 0;

  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (random <= cumulative) {
      selectedIndex = i;
      break;
    }
  }

  // 递增使用次数
  topic.subDirectionUsageCount[selectedIndex]++;
  
  return topic.subDirections[selectedIndex];
}

/**
 * 重置子方向使用计数（当差异较小时）
 * @param topic 主题
 * @param threshold 重置阈值
 */
export function resetSubDirectionCountsIfNeeded(topic: Topic, threshold: number = 3): void {
  if (!topic.subDirectionUsageCount || topic.subDirectionUsageCount.length === 0) {
    return;
  }

  const maxCount = Math.max(...topic.subDirectionUsageCount);
  const minCount = Math.min(...topic.subDirectionUsageCount);

  if (maxCount - minCount <= threshold) {
    // 差异较小，重置为最小值
    const resetValue = minCount;
    topic.subDirectionUsageCount = topic.subDirectionUsageCount.map(() => resetValue);
    logger.debug(`重置主题 "${topic.title}" 的子方向使用计数为 ${resetValue}`);
  }
}
```

### 3. 素材交叉使用策略

#### 3.1 实现逻辑

**文件**: `src/web/services/topics-service.ts`

```typescript
/**
 * 选择素材（优先使用使用次数少的）
 * @param topic 主题
 * @param count 需要选择的素材数量
 * @param excludeRecent 是否排除最近使用的素材
 * @returns 选中的素材路径列表
 */
export function selectMaterials(topic: Topic, count: number, excludeRecent: boolean = true): string[] {
  if (!topic.materialPaths || topic.materialPaths.length === 0) {
    return [];
  }

  // 初始化素材使用记录（如果不存在）
  if (!topic.materialUsageHistory) {
    topic.materialUsageHistory = topic.materialPaths.map(path => ({
      path,
      usedCount: 0,
    }));
  }

  const config = loadConfig();
  const reuseInterval = config.diversity?.materialReuseInterval ?? 5;

  // 过滤掉最近使用过的素材（如果启用排除）
  let availableMaterials = topic.materialUsageHistory;
  if (excludeRecent) {
    const now = new Date();
    availableMaterials = availableMaterials.filter(record => {
      if (!record.lastUsedAt) return true;
      const lastUsed = new Date(record.lastUsedAt);
      const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
      // 使用次数少于阈值，或者距离上次使用超过一定时间
      return record.usedCount < reuseInterval || hoursSinceLastUse > 24;
    });
  }

  // 如果没有可用素材，回退到所有素材
  if (availableMaterials.length === 0) {
    availableMaterials = topic.materialUsageHistory;
  }

  // 按使用次数排序（优先选择使用次数少的）
  availableMaterials.sort((a, b) => a.usedCount - b.usedCount);

  // 选择前 N 个素材
  const selected = availableMaterials.slice(0, count);

  // 更新使用记录
  selected.forEach(record => {
    record.usedCount++;
    record.lastUsedAt = new Date().toISOString();
  });

  return selected.map(r => r.path);
}
```

### 4. AI 提纲变体生成

#### 4.1 实现逻辑

**文件**: `src/ai/content-generator.ts`

```typescript
/**
 * 生成提纲变体
 * @param originalOutline 原始提纲
 * @param topic 主题信息
 * @returns 变体提纲
 */
async function generateOutlineVariant(
  originalOutline: string,
  topic: Topic
): Promise<string> {
  const prompt = `
你是一位专业的内容策划专家。请基于以下原始提纲，生成一个变体版本。

**原始提纲**：
${originalOutline}

**变体要求**：
1. 保持核心要点不变
2. 调整层次结构（如：并列改递进、总分改分总）
3. 替换同义表达，避免措辞雷同
4. 可以调整详略程度（某些部分更详细，某些更简洁）
5. 改变论述角度（如：从用户体验改为技术分析）

请只输出变体后的提纲，不要其他说明。
`.trim();

  const response = await callAIClient(prompt, {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 500,
  });

  return response.content.trim();
}

/**
 * 选择提纲变体策略
 * @param topic 主题
 * @returns 是否使用变体
 */
function shouldUseOutlineVariant(topic: Topic): boolean {
  // 如果启用变体生成，且有原始提纲
  const config = loadConfig();
  if (!config.diversity?.enableOutlineVariation) {
    return false;
  }

  if (!topic.outline) {
    return false;
  }

  // 避免连续使用同一变体索引
  const variantsCount = 3; // 生成 3 个变体
  const currentIndex = topic.lastUsedOutlineVariantIndex ?? -1;
  const nextIndex = (currentIndex + 1) % variantsCount;
  
  return true;
}
```

### 5. 标题风格多样化

#### 5.1 标题风格模板

**文件**: `src/ai/prompts.ts`

```typescript
/** 标题风格模板 */
export const TITLE_STYLE_TEMPLATES: Record<TitleStyleType, string[]> = {
  question: [
    '如何评价{topic}？',
    '{topic}是什么体验？',
    '{topic}值得入手吗？',
    '为什么说{topic}是{feature}？',
  ],
  sharing: [
    '分享我的{topic}体验',
    '聊聊{topic}那些事儿',
    '我的{topic}使用心得',
    '{topic}，我想说几句',
  ],
  review: [
    '深度评测：{topic}',
    '{topic}优缺点全面分析',
    '专业评测：{topic}表现如何？',
    '{topic}详细测评报告',
  ],
  comparison: [
    '{topic} vs 竞品，谁更胜一筹？',
    '{topic}和{competitor}哪个更好？',
    '对比了三款{category}，我选了{topic}',
    '{topic}与同级别车型对比',
  ],
  numeric: [
    '关于{topic}的 5 个真相',
    '3 分钟了解{topic}',
    '{topic}的 10 个使用技巧',
    '购买{topic}前必须知道的 7 件事',
  ],
  suspense: [
    '没想到{topic}居然可以这样',
    '{topic}的秘密，90% 的人不知道',
    '用了{topic}后，我后悔了...',
    '为什么我强烈推荐{topic}？',
  ],
};

/**
 * 根据主题和历史记录选择标题风格
 * @param topic 主题
 * @param styleHistory 已使用的风格历史
 * @returns 选中的风格类型
 */
export function selectTitleStyle(topic: Topic, styleHistory: TitleStyleType[]): TitleStyleType {
  const config = loadConfig();
  const weights = config.diversity?.titleStyleWeights ?? {};

  // 定义默认权重
  const defaultWeights: Record<TitleStyleType, number> = {
    question: 1.0,
    sharing: 1.0,
    review: 0.8,
    comparison: 0.9,
    numeric: 1.1,
    suspense: 1.2,
  };

  const finalWeights = { ...defaultWeights, ...weights };

  // 过滤掉最近 3 次使用过的风格
  const recentStyles = styleHistory.slice(-3);
  const availableStyles = (Object.keys(finalWeights) as TitleStyleType[]).filter(
    style => !recentStyles.includes(style)
  );

  // 如果没有可用风格（极端情况），清空历史
  if (availableStyles.length === 0) {
    return selectTitleStyle(topic, []);
  }

  // 基于权重随机选择
  const totalWeight = availableStyles.reduce((sum, style) => sum + (finalWeights[style] || 1), 0);
  const random = Math.random() * totalWeight;
  let cumulative = 0;

  for (const style of availableStyles) {
    cumulative += finalWeights[style] || 1;
    if (random <= cumulative) {
      return style;
    }
  }

  return availableStyles[0];
}
```

#### 5.2 标题生成器

**文件**: `src/ai/content-generator.ts`

```typescript
/**
 * 生成多样化标题
 * @param topic 主题
 * @param style 标题风格
 * @param generatedContent 生成的内容（用于提取关键词）
 * @returns 生成的标题
 */
async function generateDiverseTitle(
  topic: Topic,
  style: TitleStyleType,
  generatedContent?: string
): Promise<string> {
  const templates = TITLE_STYLE_TEMPLATES[style];
  const template = templates[Math.floor(Math.random() * templates.length)];

  // 从内容中提取关键词
  const keywords = extractKeywords(generatedContent || topic.direction, 3);

  // 填充模板
  let title = template;
  title = title.replace('{topic}', topic.title);
  title = title.replace('{feature}', keywords[0] || '亮点');
  title = title.replace('{competitor}', '竞品');
  title = title.replace('{category}', '车型');

  // 如果模板仍有占位符，调用 AI 生成
  if (title.includes('{')) {
    const prompt = `
请根据以下信息，以${style}风格生成一个吸引人的标题。

**主题**：${topic.title}
**内容方向**：${topic.direction}
**关键词**：${keywords.join(', ')}
**模板参考**：${template}

要求：
1. 符合${style}风格特点
2. 标题长度在 15-30 字之间
3. 有吸引力，能引发点击欲望

只输出标题，不要其他说明。
`.trim();

    const response = await callAIClient(prompt, {
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 50,
    });

    title = response.content.trim();
  }

  return title;
}
```

### 6. 内容变体生成

#### 6.1 变体策略

**文件**: `src/ai/content-generator.ts`

```typescript
/** 内容变体类型 */
type ContentVariationType = 
  | 'narrative-angle'    // 叙述角度变化
  | 'structure-order'    // 结构顺序变化
  | 'language-style'     // 语言风格变化
  | 'detail-level';      // 详略程度变化

/**
 * 生成内容变体
 * @param originalContent 原始内容
 * @param variationType 变体类型
 * @returns 变体后的内容
 */
async function generateContentVariation(
  originalContent: string,
  variationType: ContentVariationType
): Promise<string> {
  const prompts: Record<ContentVariationType, string> = {
    'narrative-angle': `
请改写以下内容，调整叙述角度：

**原始内容**：
${originalContent}

**改写要求**：
- 如果是第一人称，改为第三人称；如果是第三人称，改为第一人称
- 如果是主观体验，改为客观分析；如果是客观分析，加入主观感受
- 保持核心信息不变

只输出改写后的内容。
`.trim(),

    'structure-order': `
请改写以下内容，调整结构顺序：

**原始内容**：
${originalContent}

**改写要求**：
- 如果是总分总结构，改为分总结构
- 如果是分总结构，改为总分结构
- 调整段落顺序，但保持逻辑连贯
- 保持核心信息不变

只输出改写后的内容。
`.trim(),

    'language-style': `
请改写以下内容，调整语言风格：

**原始内容**：
${originalContent}

**改写���求**：
- 如果是正式风格，改为轻松幽默风格
- 如果是轻松风格，改为专业严谨风格
- 保持核心信息不变

只输出改写后的内容。
`.trim(),

    'detail-level': `
请改写以下内容，调整详略程度：

**原始内容**：
${originalContent}

**改写要求**：
- 如果原文详细，精简到 70% 长度
- 如果原文简洁，扩展到 130% 长度，增加细节描述
- 保持核心信息不变

只输出改写后的内容。
`.trim(),
  };

  const response = await callAIClient(prompts[variationType], {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
  });

  return response.content.trim();
}

/**
 * 选择内容变体策略
 * @param topic 主题
 * @param history 历史变体类型
 * @returns 选中的变体类型
 */
function selectContentVariation(topic: Topic, history: ContentVariationType[]): ContentVariationType {
  const types: ContentVariationType[] = ['narrative-angle', 'structure-order', 'language-style', 'detail-level'];
  
  // 过滤掉最近 2 次使用过的类型
  const recentTypes = history.slice(-2);
  const availableTypes = types.filter(type => !recentTypes.includes(type));

  // 如果没有可用类型，清空历史
  if (availableTypes.length === 0) {
    return selectContentVariation(topic, []);
  }

  // 随机选择
  return availableTypes[Math.floor(Math.random() * availableTypes.length)];
}
```

### 7. 发帖流程集成

#### 7.1 修改 AutoPostService

**文件**: `src/services/auto-post.ts`

```typescript
private async postWithTopic(topic: Topic, mode?: PostingMode, triggerType: 'auto' | 'manual' = 'auto'): Promise<PostResult> {
  try {
    logger.info(`使用预配置主题发帖："${topic.title}"`);
    const config = loadConfig();
    const featuredEnabled = config.featuredPosting.enabled;

    // 获取最近发帖历史用于去重
    const recentTopics = this.getRecentTopics(7);

    // === 新增：多样化策略应用 ===
    
    // 1. 选择子方向（基于使用次数的轮换）
    const subDirection = selectNextSubDirection(topic);
    const usedSubDirectionIndex = subDirection ? topic.subDirections?.indexOf(subDirection) : undefined;
    
    // 2. 选择素材（交叉使用策略）
    const selectedMaterials = selectMaterials(topic, config.featuredPosting.minImages);
    
    // 3. 生成提纲变体（如果启用）
    let outlineToUse = subDirection?.outline || topic.outline;
    if (config.diversity?.enableOutlineVariation && outlineToUse) {
      outlineToUse = await generateOutlineVariant(outlineToUse, topic);
    }

    // 使用子方向的方向和提纲作为 AI 生成约束
    const topicConstraint = subDirection
      ? `子方向：${subDirection.direction}${outlineToUse ? `\n内容提纲：${outlineToUse}` : ''}`
      : `主题方向：${topic.direction}${outlineToUse ? `\n内容提纲：${outlineToUse}` : ''}`;

    // 1. 读取全局人设（降级为 undefined）
    const globalPrompt = loadGlobalPrompt() ?? undefined;

    // 2. 生成内容，带标题去重和多样化
    const generated = await this.generatePostWithDiversity(
      topic,
      recentTopics,
      topicConstraint,
      globalPrompt,
      featuredEnabled ? 'featured' : 'normal',
      selectedMaterials
    );

    // ... 后续流程保持不变
```

#### 7.2 新增多样化生成方法

```typescript
/**
 * 生成发帖内容（带多样化策略）
 * @param topic 主题
 * @param recentTopics 最近主题（用于去重）
 * @param topicConstraint 主题约束
 * @param globalPrompt 全局人设
 * @param mode 发帖模式
 * @param selectedMaterials 选中的素材
 * @returns 生成的内容
 */
private async generatePostWithDiversity(
  topic: Topic,
  recentTopics: string[],
  topicConstraint: string,
  globalPrompt: string | undefined,
  mode: PostingMode,
  selectedMaterials: string[]
): Promise<GeneratedPost | null> {
  const config = loadConfig();

  // 1. 选择标题风格
  const titleStyle = selectTitleStyle(topic, topic.usedTitleStyles || []);
  
  // 2. 选择内容变体类型
  const contentVariation = selectContentVariation(topic, []);

  // 3. 生成基础内容
  let generated = await generatePost({
    topic,
    recentTopics,
    topicConstraint,
    globalPrompt,
    mode,
  });

  if (!generated) {
    return null;
  }

  // 4. 应用标题风格
  if (config.diversity?.enableTitleStyleDiversity) {
    generated.title = await generateDiverseTitle(topic, titleStyle, generated.content);
    
    // 记录使用的风格
    if (!topic.usedTitleStyles) {
      topic.usedTitleStyles = [];
    }
    topic.usedTitleStyles.push(titleStyle);
    if (topic.usedTitleStyles.length > 10) {
      topic.usedTitleStyles.shift(); // 保持最近 10 次记录
    }
  }

  // 5. 应用内容变体
  if (config.diversity?.enableContentVariation) {
    generated.content = await generateContentVariation(generated.content, contentVariation);
  }

  return generated;
}
```

## 配置设计

### 默认配置

**文件**: `config/default.yaml`

```yaml
diversity:
  # 是否启用子方向轮换
  enableSubDirectionRotation: true
  
  # 是否启用素材交叉使用
  enableMaterialRotation: true
  
  # 是否启用提纲变体生成
  enableOutlineVariation: true
  
  # 是否启用标题风格多样化
  enableTitleStyleDiversity: true
  
  # 是否启用内容变体生成
  enableContentVariation: true
  
  # 标题风格权重（数值越高越容易被选择）
  titleStyleWeights:
    question: 1.0
    sharing: 1.0
    review: 0.8
    comparison: 0.9
    numeric: 1.1
    suspense: 1.2
  
  # 素材重复使用间隔（次数）
  materialReuseInterval: 5
  
  # 子方向重置阈值
  subDirectionResetThreshold: 3
```

## 数据持久化

### Topic 数据更新

在 `topics-service.ts` 的 `saveTopics` 函数中，确保新增字段被正确保存：

```typescript
export function saveTopics(topics: Topic[]): void {
  const data = {
    topics: topics.map(t => ({
      id: t.id,
      title: t.title,
      direction: t.direction,
      outline: t.outline,
      materialPaths: t.materialPaths,
      subDirections: t.subDirections,
      useCount: t.useCount,
      lastUsedAt: t.lastUsedAt,
      subDirectionUsageCount: t.subDirectionUsageCount,
      materialUsageHistory: t.materialUsageHistory,
      usedTitleStyles: t.usedTitleStyles,
      lastUsedOutlineVariantIndex: t.lastUsedOutlineVariantIndex,
    })),
  };
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
```

## 测试策略

### 单元测试

1. **子方向选择测试**：验证基于使用次数的权重选择逻辑
2. **素材选择测试**：验证素材交叉使用和排除逻辑
3. **标题风格选择测试**：验证风格轮换和权重选择
4. **内容变体测试**：验证变体生成的多样性

### 集成测试

1. **完整发帖流程测试**：验证多样化策略集成到发帖流程
2. **数据持久化测试**：验证 Topic 数据保存和加载
3. **配置加载测试**：验证多样化配置的加载和应用

### 端到端测试

1. **多轮发帖测试**：连续发帖 10 次，验证子方向、素材、标题风格的分布
2. **重复度检测**：使用 AI 检测生成内容的重复度
3. **性能测试**：验证多样化策略对发帖时间的影响

## 监控和日志

### 关键指标

- 子方向使用分布（标准差）
- 素材使用分布（标准差）
- 标题风格使用频率
- 内容变体使用频率
- 发帖时间变化（对比优化前后）

### 日志记录

```typescript
logger.info(`多样化策略应用：子方向索引=${usedSubDirectionIndex}, 素材数量=${selectedMaterials.length}, 标题风格=${titleStyle}, 内容变体=${contentVariation}`);
```

## 降级策略

如果多样化策略失败（如 AI 超时），采用降级策略：

1. 提纲变体生成超时：使用原始提纲
2. 标题风格生成超时：使用默认模板生成
3. 内容变体生成超时：使用原始内容
4. 记录降级日志，不影响发帖主流程
