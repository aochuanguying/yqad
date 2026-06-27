# 自由发帖模式素材混合策略 - 设计方案

## 概述

本设计文档详细描述如何实现自由发帖模式素材混合策略，包括本地素材优先级配置、基于互联网参考标题的本地素材智能匹配、素材混合策略、素材质量评估和选择、素材使用记录追溯五个核心功能。

## 架构设计

### 组件关系

```
┌─────────────────────────────────────────────────────────┐
│                   AutoPostService                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │            HybridMaterialStrategy                │  │
│  │                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │  │
│  │  │ 优先级策略   │  │ 智能匹配器   │  │ 质量   │ │  │
│  │  │ (本地/网络)  │  │ (标题关键词) │  │ 评估   │ │  │
│  │  └───────┬──────┘  └───────┬──────┘  └───┬────┘ │  │
│  │          │                 │              │      │  │
│  │          ▼                 ▼              ▼      │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │         MaterialSelector (增强版)           │ │  │
│  │  │  - 混合策略选择                             │ │  │
│  │  │  - 质量排序                                 │ │  │
│  │  │  - 使用追溯记录                             │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────────────────���─────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              TopicsService (增强版)                     │
│                                                         │
│  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ 素材质量管理     │  │ 素材使用追溯                │ │
│  │ - 质量评分       │  │ - 使用记录                  │ │
│  │ - 评分更新       │  │ - 统计分析                  │ │
│  └──────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 详细设计

### 1. 数据结构扩展

#### 1.1 新增接口定义

**文件**: `src/types/material-strategy.ts`

```typescript
/** 素材优先级模式 */
export type MaterialPriorityMode = 
  | 'local-first'    // 本地优先
  | 'network-first'  // 网络优先
  | 'hybrid';        // 混合模式

/** 素材混合策略配置 */
export interface HybridMaterialConfig {
  /** 优先级模式 */
  priorityMode: MaterialPriorityMode;
  
  /** 混合比例（本地素材占比，0-1 之间，仅在 hybrid 模式下有效） */
  localRatio?: number;
  
  /** 是否启用智能匹配 */
  enableSmartMatching?: boolean;
  
  /** 是否启用质量评估 */
  enableQualityScoring?: boolean;
  
  /** 是否启用使用追溯 */
  enableUsageTracking?: boolean;
  
  /** 质量阈值（低于此阈值的素材不被使用） */
  qualityThreshold?: number;
  
  /** 匹配度阈值（低于此阈值的匹配结果不被采用） */
  matchingThreshold?: number;
}

/** 素材质量评分 */
export interface MaterialQualityScore {
  /** 素材路径 */
  path: string;
  
  /** 综合评分（0-100） */
  overallScore: number;
  
  /** 清晰度评分（0-100） */
  clarityScore?: number;
  
  /** 构图评分（0-100） */
  compositionScore?: number;
  
  /** 光线评分（0-100） */
  lightingScore?: number;
  
  /** 相关性评分（0-100�� */
  relevanceScore?: number;
  
  /** 新鲜度评分（0-100） */
  freshnessScore?: number;
  
  /** 评分时间 */
  scoredAt: string;
  
  /** 评分版本（用于缓存失效） */
  version?: string;
}

/** 素材使用记录 */
export interface MaterialUsageRecord {
  /** 素材路径 */
  path: string;
  
  /** 素材来源 */
  source: 'local' | 'network';
  
  /** 使用次数 */
  usedCount: number;
  
  /** 最后使用时间 */
  lastUsedAt?: string;
  
  /** 关联的发帖 ID 列表 */
  postIds?: string[];
  
  /** 历史使用记录 */
  usageHistory?: UsageHistoryItem[];
}

/** 单次使用记录 */
export interface UsageHistoryItem {
  /** 发帖 ID */
  postId: string;
  
  /** 使用时间 */
  usedAt: string;
  
  /** 素材来源 */
  source: 'local' | 'network';
  
  /** 质量评分 */
  qualityScore?: number;
  
  /** 匹配度评分 */
  matchingScore?: number;
  
  /** 发帖模式 */
  postMode?: 'featured' | 'normal';
  
  /** 主题 ID */
  topicId?: string;
}

/** 智能匹配结果 */
export interface MaterialMatchResult {
  /** 素材路径 */
  path: string;
  
  /** 素材来源 */
  source: 'local' | 'network';
  
  /** 匹配度评分（0-100） */
  matchScore: number;
  
  /** 匹配的关键词 */
  matchedKeywords?: string[];
  
  /** 质量评分 */
  qualityScore?: number;
  
  /** 综合评分（匹配度 + 质量） */
  overallScore?: number;
}
```

#### 1.2 Topic 接口扩展

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
  
  // === 新增字段（来自 topic-diversity）===
  subDirectionUsageCount?: number[];
  materialUsageHistory?: MaterialUsageRecord[];
  usedTitleStyles?: TitleStyleType[];
  lastUsedOutlineVariantIndex?: number;
  
  // === 新增字段（素材混合策略）===
  
  /** 素材质量评分缓存 */
  materialQualityScores?: MaterialQualityScore[];
  
  /** 素材使用追溯 */
  materialUsageTracking?: MaterialUsageRecord[];
  
  /** 互联网参考素材（网络素材） */
  networkReferenceMaterials?: NetworkReferenceMaterial[];
  
  /** 上次使用的素材混合策略配置 */
  lastUsedMaterialStrategy?: HybridMaterialConfig;
}

/** 互联网参考素材 */
export interface NetworkReferenceMaterial {
  /** 素材 URL */
  url: string;
  
  /** 本地缓存路径 */
  localPath?: string;
  
  /** 参考标题 */
  referenceTitle?: string;
  
  /** 采集时间 */
  collectedAt?: string;
  
  /** 质量评分 */
  qualityScore?: number;
}
```

### 2. 本地素材优先级配置

#### 2.1 配置管理

**文件**: `src/config/material-strategy.ts`

```typescript
/** 默认素材混合策略配置 */
export const DEFAULT_MATERIAL_STRATEGY: HybridMaterialConfig = {
  priorityMode: 'hybrid',
  localRatio: 0.7,  // 70% 本地素材
  enableSmartMatching: true,
  enableQualityScoring: true,
  enableUsageTracking: true,
  qualityThreshold: 60,
  matchingThreshold: 50,
};

/**
 * 加载素材混合策略配置
 */
export function loadMaterialStrategyConfig(): HybridMaterialConfig {
  const config = loadConfig();
  return {
    ...DEFAULT_MATERIAL_STRATEGY,
    ...(config.materialStrategy || {}),
  };
}

/**
 * 保存素材混合策略配置
 */
export function saveMaterialStrategyConfig(strategy: HybridMaterialConfig): void {
  const config = loadConfig();
  config.materialStrategy = strategy;
  saveConfig(config);
}
```

#### 2.2 优先级策略实现

**文件**: `src/services/materials/hybrid-strategy.ts`

```typescript
/**
 * 根据优先级模式选择素材
 * @param localMaterials 本地素材列表
 * @param networkMaterials 网络素材列表
 * @param config 混合策略配置
 * @param requiredCount 需要选择的素材数量
 * @returns 选中的素材列表
 */
export function selectMaterialsByPriority(
  localMaterials: MaterialMatchResult[],
  networkMaterials: MaterialMatchResult[],
  config: HybridMaterialConfig,
  requiredCount: number
): MaterialMatchResult[] {
  const { priorityMode, localRatio = 0.7 } = config;
  
  // 按综合评分排序
  const sortedLocal = [...localMaterials].sort((a, b) => 
    (b.overallScore || 0) - (a.overallScore || 0)
  );
  const sortedNetwork = [...networkMaterials].sort((a, b) => 
    (b.overallScore || 0) - (a.overallScore || 0)
  );
  
  let selected: MaterialMatchResult[] = [];
  
  switch (priorityMode) {
    case 'local-first':
      // 本地优先：先用本地，不足再用网络
      selected = [...sortedLocal];
      if (selected.length < requiredCount) {
        selected = selected.concat(sortedNetwork);
      }
      break;
      
    case 'network-first':
      // 网络优先：先用网络，不足再用本地
      selected = [...sortedNetwork];
      if (selected.length < requiredCount) {
        selected = selected.concat(sortedLocal);
      }
      break;
      
    case 'hybrid':
      // 混合模式：按比例混合
      const localCount = Math.ceil(requiredCount * localRatio);
      const networkCount = requiredCount - localCount;
      
      selected = [
        ...sortedLocal.slice(0, localCount),
        ...sortedNetwork.slice(0, networkCount),
      ];
      break;
  }
  
  // 截取所需数量
  return selected.slice(0, requiredCount);
}
```

### 3. 智能素材匹配

#### 3.1 关键词提取

**文件**: `src/services/materials/smart-matching.ts`

```typescript
/**
 * 从标题提取关键词
 * @param title 互联网参考标题
 * @returns 关键词列表
 */
export function extractKeywordsFromTitle(title: string): string[] {
  // 移除常见停用词
  const stopwords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个'];
  
  // 中文分词（简单实现，可使用第三方库如 node-segmentit）
  const words = title.split(/[\s,，.。?!？！]+/);
  
  // 过滤停用词和短词
  const keywords = words.filter(word => {
    return word.length > 1 && !stopwords.includes(word);
  });
  
  return keywords;
}

/**
 * 从标题提取实体（车型、地点、功能等）
 * @param title 标题
 * @returns 识别的实体列表
 */
export function extractEntitiesFromTitle(title: string): string[] {
  const entities: string[] = [];
  
  // 车型实体（简单正则，可增强为 AI 识别）
  const carPattern = /[\u4e00-\u9fa5]{2,4}( 款 | 版 | 型 | 系)/g;
  const carMatches = title.match(carPattern);
  if (carMatches) {
    entities.push(...carMatches);
  }
  
  // 地点实体
  const locationPattern = /[\u4e00-\u9fa5]{2,4}( 市 | 省 | 区 | 县 | 山 | 河 | 湖 | 海)/g;
  const locationMatches = title.match(locationPattern);
  if (locationMatches) {
    entities.push(...locationMatches);
  }
  
  return entities;
}
```

#### 3.2 素材匹配算法

**文件**: `src/services/materials/smart-matching.ts`

```typescript
/**
 * 智能匹配本地素材
 * @param referenceTitle 互联网参考标题
 * @param localMaterials 本地素材列表（带标签和元数据）
 * @returns 匹配结果列表
 */
export function smartMatchMaterials(
  referenceTitle: string,
  localMaterials: LocalMaterialInfo[]
): MaterialMatchResult[] {
  const keywords = extractKeywordsFromTitle(referenceTitle);
  const entities = extractEntitiesFromTitle(referenceTitle);
  const allQueryTerms = [...keywords, ...entities];
  
  const matchResults: MaterialMatchResult[] = localMaterials
    .map(material => {
      const matchScore = calculateMatchScore(material, allQueryTerms);
      const qualityScore = material.qualityScore || 0;
      
      return {
        path: material.path,
        source: 'local' as const,
        matchScore,
        matchedKeywords: getMatchedKeywords(material, allQueryTerms),
        qualityScore,
        overallScore: matchScore * 0.6 + qualityScore * 0.4, // 匹配度 60% + 质量 40%
      };
    })
    .filter(result => result.matchScore > 0)
    .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
  
  return matchResults;
}

/**
 * 计算匹配分数
 * @param material 本地素材
 * @param queryTerms 查询词项
 * @returns 匹配分数（0-100）
 */
function calculateMatchScore(
  material: LocalMaterialInfo,
  queryTerms: string[]
): number {
  let score = 0;
  
  // 文件名匹配（权重 20%）
  const fileNameMatch = queryTerms.some(term => 
    material.fileName.toLowerCase().includes(term.toLowerCase())
  );
  if (fileNameMatch) score += 20;
  
  // 标签匹配（权重 40%）
  const tagMatches = material.tags?.filter(tag =>
    queryTerms.some(term => tag.includes(term))
  ) || [];
  const tagScore = Math.min(40, (tagMatches.length / queryTerms.length) * 40);
  score += tagScore;
  
  // 描述匹配（权重 30%）
  const descriptionMatch = queryTerms.some(term =>
    material.description?.toLowerCase().includes(term.toLowerCase())
  );
  if (descriptionMatch) score += 30;
  
  // 元数据匹配（权重 10%）
  const metadataMatch = queryTerms.some(term =>
    JSON.stringify(material.metadata || {}).toLowerCase().includes(term.toLowerCase())
  );
  if (metadataMatch) score += 10;
  
  return Math.min(100, score);
}

/**
 * 获取匹配的关键词
 */
function getMatchedKeywords(
  material: LocalMaterialInfo,
  queryTerms: string[]
): string[] {
  return queryTerms.filter(term => {
    return (
      material.fileName.toLowerCase().includes(term.toLowerCase()) ||
      material.tags?.some(tag => tag.includes(term)) ||
      material.description?.toLowerCase().includes(term.toLowerCase())
    );
  });
}
```

### 4. 素材质量评估

#### 4.1 质量评分算法

**文件**: `src/services/materials/quality-scorer.ts`

```typescript
/**
 * 计算素材质量评分
 * @param material 素材信息
 * @returns 质量评分
 */
export function calculateMaterialQualityScore(
  material: MaterialInfo
): MaterialQualityScore {
  const clarityScore = evaluateClarity(material);
  const compositionScore = evaluateComposition(material);
  const lightingScore = evaluateLighting(material);
  const relevanceScore = evaluateRelevance(material);
  const freshnessScore = evaluateFreshness(material);
  
  // 加权平均
  const overallScore = 
    clarityScore * 0.25 +
    compositionScore * 0.20 +
    lightingScore * 0.20 +
    relevanceScore * 0.20 +
    freshnessScore * 0.15;
  
  return {
    path: material.path,
    overallScore: Math.round(overallScore),
    clarityScore: Math.round(clarityScore),
    compositionScore: Math.round(compositionScore),
    lightingScore: Math.round(lightingScore),
    relevanceScore: Math.round(relevanceScore),
    freshnessScore: Math.round(freshnessScore),
    scoredAt: new Date().toISOString(),
    version: '1.0',
  };
}

/**
 * 评估清晰度
 */
function evaluateClarity(material: MaterialInfo): number {
  // 基于分辨率评分
  const resolution = material.resolution || { width: 0, height: 0 };
  const megapixels = (resolution.width * resolution.height) / 1000000;
  const resolutionScore = Math.min(100, megapixels * 10);
  
  // 基于文件格式（HEIC > JPG > PNG）
  const formatScores: Record<string, number> = {
    'heic': 100,
    'jpg': 80,
    'jpeg': 80,
    'png': 70,
  };
  const formatScore = formatScores[material.format?.toLowerCase()] || 70;
  
  return (resolutionScore + formatScore) / 2;
}

/**
 * 评估构图（简化版，可使用 AI 增强）
 */
function evaluateComposition(material: MaterialInfo): number {
  // 简单规则：横屏照片通常构图更好
  const resolution = material.resolution || { width: 0, height: 0 };
  const isLandscape = resolution.width > resolution.height;
  
  // 检查主体是否居中（需要 AI 识别，这里简化）
  const hasGoodComposition = isLandscape;
  
  return hasGoodComposition ? 80 : 60;
}

/**
 * 评估光线（简化版）
 */
function evaluateLighting(material: MaterialInfo): number {
  // 基于拍摄时间（白天 vs 夜晚）
  const takenAt = material.metadata?.takenAt;
  if (takenAt) {
    const hour = new Date(takenAt).getHours();
    // 白天 9 点 -17 点光线较好
    if (hour >= 9 && hour <= 17) {
      return 85;
    }
  }
  return 70;
}

/**
 * 评估相关性
 */
function evaluateRelevance(material: MaterialInfo): number {
  // 基于标签和描述的完整性
  const hasTags = !!material.tags && material.tags.length > 0;
  const hasDescription = !!material.description;
  
  let score = 50; // 基础分
  if (hasTags) score += 25;
  if (hasDescription) score += 25;
  
  return score;
}

/**
 * 评估新鲜度
 */
function evaluateFreshness(material: MaterialInfo): number {
  const usageRecord = material.usageRecord;
  const usedCount = usageRecord?.usedCount || 0;
  
  // 使用次数越少，新鲜度越高
  const freshnessScore = Math.max(0, 100 - usedCount * 10);
  
  return freshnessScore;
}
```

### 5. 素材使用追溯

#### 5.1 使用记录管理

**文件**: `src/web/services/topics-service.ts`

```typescript
/**
 * 记录素材使用
 * @param topic 主题
 * @param materialPath 素材路径
 * @param postId 发帖 ID
 * @param score 质量评分
 * @param matchScore 匹配度评分
 */
export function recordMaterialUsage(
  topic: Topic,
  materialPath: string,
  postId: string,
  qualityScore?: number,
  matchScore?: number
): void {
  if (!topic.materialUsageTracking) {
    topic.materialUsageTracking = [];
  }
  
  let record = topic.materialUsageTracking.find(
    r => r.path === materialPath
  );
  
  if (!record) {
    record = {
      path: materialPath,
      source: 'local', // 需要根据实际情况判断
      usedCount: 0,
      usageHistory: [],
    };
    topic.materialUsageTracking.push(record);
  }
  
  record.usedCount++;
  record.lastUsedAt = new Date().toISOString();
  
  if (!record.usageHistory) {
    record.usageHistory = [];
  }
  
  record.usageHistory.push({
    postId,
    usedAt: new Date().toISOString(),
    source: record.source,
    qualityScore,
    matchingScore: matchScore,
  });
  
  // 保存更新
  saveTopics([topic]);
}

/**
 * 获取素材使用统计
 * @param topic 主题
 * @returns 使用统计信息
 */
export function getMaterialUsageStats(topic: Topic): MaterialUsageStats {
  const tracking = topic.materialUsageTracking || [];
  
  const totalUsage = tracking.reduce((sum, r) => sum + r.usedCount, 0);
  const localUsage = tracking
    .filter(r => r.source === 'local')
    .reduce((sum, r) => sum + r.usedCount, 0);
  const networkUsage = tracking
    .filter(r => r.source === 'network')
    .reduce((sum, r) => sum + r.usedCount, 0);
  
  const avgQualityScore = tracking
    .flatMap(r => r.usageHistory || [])
    .reduce((sum, h) => sum + (h.qualityScore || 0), 0) / (totalUsage || 1);
  
  return {
    totalUsage,
    localUsage,
    networkUsage,
    localRatio: totalUsage > 0 ? localUsage / totalUsage : 0,
    avgQualityScore: Math.round(avgQualityScore),
    uniqueMaterialsCount: tracking.length,
  };
}
```

### 6. 发帖流程集成

#### 6.1 修改 AutoPostService

**文件**: `src/services/auto-post.ts`

```typescript
private async postWithTopic(topic: Topic, mode?: PostingMode, triggerType: 'auto' | 'manual' = 'auto'): Promise<PostResult> {
  try {
    logger.info(`使用预配置主题发帖："${topic.title}"`);
    const config = loadConfig();
    const featuredEnabled = config.featuredPosting.enabled;

    // 获取最近发帖历史用于去重
    const recentTopics = this.getRecentTopics(7);

    // 1. 选择子方向（基于使用次数的轮换）
    const subDirection = selectNextSubDirection(topic);
    const usedSubDirectionIndex = subDirection ? topic.subDirections?.indexOf(subDirection) : undefined;
    
    // === 新增：素材混合策略 ===
    
    // 2. 获取互联网参考标题（如果有）
    const referenceTitle = subDirection?.direction || topic.direction;
    
    // 3. 智能匹配本地素材
    const localMaterials = await this.matchLocalMaterials(referenceTitle, topic);
    
    // 4. 获取网络素材
    const networkMaterials = await this.getNetworkMaterials(topic);
    
    // 5. 加载混合策略配置
    const materialStrategy = loadMaterialStrategyConfig();
    
    // 6. 根据优先级策略选择素材
    const selectedMaterials = selectMaterialsByPriority(
      localMaterials,
      networkMaterials,
      materialStrategy,
      config.featuredPosting.minImages
    );
    
    // 7. 记录素材使用
    if (materialStrategy.enableUsageTracking) {
      selectedMaterials.forEach(material => {
        recordMaterialUsage(
          topic,
          material.path,
          '', // 发帖 ID（发帖后更新）
          material.qualityScore,
          material.matchScore
        );
      });
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
      selectedMaterials.map(m => m.path) // 传递素材路径
    );

    // ... 后续流程保持不变
```

### 7. 配置设计

#### 7.1 默认配置

**文件**: `config/default.yaml`

```yaml
# 素材混合策略配置
materialStrategy:
  # 优先级模式：local-first | network-first | hybrid
  priorityMode: hybrid
  
  # 混合比例（本地素材占比，仅在 hybrid 模式下有效）
  localRatio: 0.7
  
  # 是否启用智能匹配
  enableSmartMatching: true
  
  # 是否启用质量评估
  enableQualityScoring: true
  
  # 是否启用使用追溯
  enableUsageTracking: true
  
  # 质量阈值（低于此阈值的素材不被使用）
  qualityThreshold: 60
  
  # 匹配度阈值（低于此阈值的匹配结果不被采用）
  matchingThreshold: 50
```

## 测试策略

### 单元测试

1. **优先级策略测试**：验证三种模式下的素材选择逻辑
2. **智能匹配测试**：验证关键词提取和匹配算法
3. **质量评估测试**：验证各维度评分计算
4. **使用追溯测试**：验证记录准确性和完整性

### 集成测试

1. **完整发帖流程测试**：验证混合策略集成到发帖流程
2. **配置加载测试**：验证配置的加载和应用
3. **数据持久化测试**：验证素材数据保存和加载

### 端到端测试

1. **多轮发帖测试**：连续发帖验证素材使用分布
2. **本地素材使用率**：验证本地素材使用率提升
3. **性能测试**：验证匹配和评估对发帖时间的影响

## 监控和日志

### 关键指标

- 本地素材使用率（本地素材数 / 总素材数）
- 素材匹配准确率
- 素材平均质量评分
- 素材使用追溯覆盖率

### 日志记录

```typescript
logger.info(`素材混合策略应用：模式=${materialStrategy.priorityMode}, 本地素材=${localMaterials.length}, 网络素材=${networkMaterials.length}, 选中=${selectedMaterials.length}`);
```

## 降级策略

如果素材混合策略失败，采用降级策略：

1. 智能匹配超时：回退到基于标签的简单匹配
2. 质量评估失败：使用默认质量分 70
3. 混合策略异常：回退到纯网络素材模式
4. 记录降级日志，不影响发帖主流程
