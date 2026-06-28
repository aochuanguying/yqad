## 上下文

当前互联网发帖系统已支持知乎、小红书、汽车之家三个平台的素材搜索，但存在以下问题：

1. **搜索词策略单一**：所有平台使用相同的搜索词选择逻辑，未考虑平台技术实现差异（小红书签名算法限制、知乎 API 标准限制、汽车之家爬虫限制）
2. **AI 提示词通用化**：生成的内容风格单一，未适配不同平台的内容调性（小红书种草风、知乎专业风、汽车之家车主风）
3. **平台选择机械**：简单轮询策略，未根据发帖目的、内容类型智能推荐
4. **图片选择标准化**：仅按质量分数选择，未考虑平台图片偏好（小红书精美风、知乎信息图、汽车之家实拍图）

**约束条件**：
- 必须保持现有 API 向后兼容
- 不能增加外部依赖
- 需要支持数据库配置热更新
- 需要保持现有发帖 Pipeline 架构不变

## 目标 / 非目标

**目标：**
1. 实现分平台搜索词选择策略，提升搜索命中率和素材质量
2. 实现分平台 AI 提示词模板，生成符合平台风格的内容
3. 实现智能平台推荐算法，基于发帖目的和受众选择最优平台
4. 实现分平台图片选择策略，提升素材适配性
5. 提供数据库配置脚本和管理接口

**非目标：**
1. 不改变现有发帖 Pipeline 的 8 步流程
2. 不修改互联网参考服务的基本架构（MySQL+ChromaDB+Redis）
3. 不增加新的外部 API 依赖
4. 不修改现有 API 接口定义

## 决策

### 1. 搜索词选择架构

**决策**：采用"平台感知"的搜索词选择器，在 `internet-reference-service.ts` 中实现分平台策略

**方案对比**：

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **方案 A**: 在每个搜索服务中独立实现 | 隔离性好，互不影响 | 代码重复，难以统一管理 | ❌ |
| **方案 B**: 在 search-manager 中统一实现 | 集中管理，便于维护 | 增加 search-manager 复杂度 | ✅ |
| **方案 C**: 新增独立的搜索词选择服务 | 职责清晰，便于测试 | 增加服务调用开销 | ❌ |

**选择方案 B 的理由**：
- search-manager 已经负责平台选择和调度，搜索词选择逻辑在此处最自然
- 便于统一管理和配置更新
- 可以通过策略模式实现，保持代码清晰

**实现方式**：
```typescript
// 新增搜索词选择器接口
interface ISearchKeywordSelector {
  select(keywords: string[], platform: string): string;
}

// 实现分平台策略
class PlatformAwareKeywordSelector implements ISearchKeywordSelector {
  select(keywords: string[], platform: string): string {
    switch (platform) {
      case 'xiaohongshu':
        return this.selectXiaohongshuKeyword(keywords);
      case 'zhihu':
        return this.selectZhihuKeyword(keywords);
      case 'autohome':
        return this.selectAutohomeKeyword(keywords);
      default:
        return keywords[0];
    }
  }
}
```

### 2. AI 提示词分平台策略

**决策**：在 `content-generator.ts` 中实现分平台提示词构建器

**方案对比**：

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **方案 A**: 硬编码在 content-generator 中 | 简单直接 | 难以维护和扩展 | ❌ |
| **方案 B**: 使用策略模式，每个平台一个构建器 | 职责清晰，易于扩展 | 代码量增加 | ✅ |
| **方案 C**: 使用配置文件存储提示词模板 | 灵活，可热更新 | 模板语法复杂，调试困难 | ❌ |

**选择方案 B 的理由**：
- 提示词逻辑较复杂，需要条件判断和数据处理
- 策略模式便于后续增加新平台
- 类型安全，IDE 支��好

**实现方式**：
```typescript
// 提示词构建器接口
interface IPromptBuilder {
  build(topic: string, references: InternetReference[]): string;
}

// 分平台实现
class XiaohongshuPromptBuilder implements IPromptBuilder {
  build(topic: string, references: InternetReference[]): string {
    // 构建小红书风格提示词
  }
}

class ZhihuPromptBuilder implements IPromptBuilder {
  build(topic: string, references: InternetReference[]): string {
    // 构建知乎风格提示词
  }
}
```

### 3. 智能平台选择算法

**决策**：在 `search-manager.ts` 中实现"优先级 + 轮询"混合策略

**算法设计**：
```typescript
selectNextPlatform(): ISearchPlatform {
  // 1. 根据发帖目的计算基础优先级
  const basePriorities = this.calculateBasePriorities(postPurpose);
  
  // 2. 根据频率限制调整
  const adjustedPriorities = this.adjustByRateLimit(basePriorities);
  
  // 3. 根据成功率调整
  const finalPriorities = this.adjustBySuccessRate(adjustedPriorities);
  
  // 4. 轮询选择（权重随机）
  return this.weightedRandomSelect(finalPriorities);
}
```

**优先级因子**：
- 基础优先级（配置表）：1-10
- 频率限制惩罚：剩余次数越少，优先级越低
- 成功率奖励：历史成功率越高，优先级越高
- 最近使用惩罚：刚使用过的平台优先级降低

### 4. 图片选择策略

**决策**：在 `hybrid-material-service.ts` 中实现分平台图片选择器

**实现方式**：
```typescript
async selectImagesForPlatform(
  platform: string,
  materials: MaterialRecord[],
  neededCount: number
): Promise<MaterialRecord[]> {
  switch (platform) {
    case 'xiaohongshu':
      // 选择高清、精美、有滤镜的图片
      return materials
        .filter(m => m.qualityScore?.clarity > 15)
        .sort((a, b) => (b.qualityScore?.totalScore || 0) - (a.qualityScore?.totalScore || 0))
        .slice(0, neededCount);
    
    case 'zhihu':
      // 选择信息图、数据图、示意图
      return materials
        .filter(m => m.matchedKeywords?.includes('图表') || m.matchedKeywords?.includes('数据'))
        .slice(0, neededCount);
    
    case 'autohome':
      // 选择实拍图、细节图、改装图
      return materials
        .filter(m => m.matchedKeywords?.includes('实拍') || m.matchedKeywords?.includes('细节'))
        .slice(0, neededCount);
    
    default:
      return materials.slice(0, neededCount);
  }
}
```

### 5. 数据库配置设计

**表结构变更**：

**internet_reference_config 表**：
```sql
ALTER TABLE internet_reference_config 
ADD COLUMN platform VARCHAR(20) NOT NULL DEFAULT 'all' COMMENT '平台：xiaohongshu|zhihu|autohome|all';

ALTER TABLE internet_reference_config
MODIFY COLUMN search_keywords TEXT COMMENT '搜索词列表，逗号分隔';
```

**internet_reference_platforms 表**：
```sql
ALTER TABLE internet_reference_platforms
ADD COLUMN priority INT DEFAULT 5 COMMENT '优先级 1-10';

ALTER TABLE internet_reference_platforms
ADD COLUMN rate_limit_per_hour INT DEFAULT 50 COMMENT '每小时频率限制';

ALTER TABLE internet_reference_platforms
ADD COLUMN success_rate DECIMAL(5,2) DEFAULT 100.00 COMMENT '历史成功率（%）';
```

### 6. 配置管理接口

**新增接口**：
```typescript
// 在 internet-reference-storage.ts 中
interface InternetReferenceStorage {
  // 获取分平台配置
  getConfigByPlatform(platform: string): Promise<InternetReferenceConfig>;
  
  // 更新平台优先级
  updatePlatformPriority(platform: string, priority: number): Promise<void>;
  
  // 记录成功率
  recordSuccess(platform: string, success: boolean): Promise<void>;
}
```

## 风险 / 权衡

### 风险 1: 搜索词策略复杂化

**风险**：分平台搜索词策略增加了代码复杂度，可能导致 bug

**缓解措施**：
- 使用策略模式，保持代码清晰
- 编写单元测试覆盖所有平台
- 提供默认回退策略（策略失败时使用通用策略）

### 风险 2: AI 提示词质量不稳定

**风险**：分平台提示词可能生成不符合预期的内容

**缓解措施**：
- 提供提示词模板示例
- 实现内容质量评分机制
- 支持人工审核和反馈循环

### 风险 3: 平台选择算法偏差

**风险**：智能推荐可能导致某些平台被过度使用或忽视

**缓解措施**：
- 设置最低使用频率保证
- 定期重置成功率统计
- 支持手动配置优先级

### 风险 4: 数据库配置同步延迟

**风险**：配置更新后，缓存中的旧配置可能导致行为不一致

**缓解措施**：
- 使用 Redis 缓存配置，设置较短的过期时间（5 分钟）
- 提供配置刷新接口
- 关键配置变更时主动清除缓存

### 权衡 1: 代码复杂度 vs 灵活性

**权衡**：策略模式增加了代码量，但提供了更好的灵活性和可维护性

**决策**：选择灵活性，因为平台特点可能随时间变化，需要易于调整

### 权衡 2: 智能推荐 vs 简单轮询

**权衡**：智能推荐算法复杂，但能提升效果；简单轮询稳定，但缺乏针对性

**决策**：采用"智能推荐 + 轮询"混合策略，平衡效果和稳定性
