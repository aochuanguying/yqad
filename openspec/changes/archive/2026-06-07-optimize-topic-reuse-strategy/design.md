## 上下文

### 当前状态
当前主题复用策略存在以下问题：
1. **标题处理僵化**：AI 生成标题时需要参考主题标题，但没有明确说明是否必须一致
2. **内容分配无规划**：当主题 maxUseCount > 1 时，没有机制确保多次发帖的内容均衡分配
3. **历史追踪不足**：postHistory 仅记录标题和摘要，未记录使用的具体子方向

### 业务需求
- 主题标题仅作为风格参考，AI 应基于子方向自由生成标题
- 当主题可复用 N 次时，应提供 N 个子方向，每次发帖使用不同的子方向
- 确保同一主题的 N 篇帖子内容有递进性和差异化

### 约束
- 向后兼容：旧格式 topics.json 需要能平滑过渡
- 最小侵入：尽量不影响现有发帖流程
- 简洁至上：实现逻辑应简单易懂，避免过度设计

## 目标 / 非目标

**目标：**
- 实现主题内容池机制，支持子方向管理和选取
- 优化标题生成策略，标题仅作为参考
- 增强发帖历史记录，记录使用的子方向信息
- 确保多次复用时内容均衡分配

**非目标：**
- 不改变自由发帖模式的逻辑
- 不引入复杂的语义去重算法（仅完全匹配去重）
- 不自动拆分现有主题的子方向（需要手动配置）

## 决策

### 1. 内容池数据结构设计

**决策**：在 Topic 接口中增加 subDirections 字段，类型为数组

```typescript
interface SubDirection {
  title: string;        // 子方向标题（用于发帖时参考）
  direction: string;    // 子方向描述（核心内容方向）
  outline: string;      // 内容提纲（可选）
}

interface Topic {
  // ... 现有字段
  subDirections?: SubDirection[];  // 子方向池
  usedSubDirectionIndices?: number[]; // 已使用的子方向索引
}
```

**理由**：
- 结构化存储，便于管理和查询
- 与现有 direction/outline 字段保持一致命
- 显式记录已使用的索引，避免重复选取

**替代方案**：
- 方案 A：仅扩展 direction 字段，用分隔符拆分多个方向
  - 缺点：难以管理，无法追踪使用情况
- 方案 B：使用 JSON Schema 验证
  - 缺点：增加复杂度，当前不需要

### 2. 子方向选取策略

**决策**：按索引顺序选取，优先使用未使用过的子方向

```typescript
function selectNextSubDirection(topic: Topic): SubDirection | null {
  const indices = topic.usedSubDirectionIndices || [];
  const allIndices = topic.subDirections!.map((_, i) => i);
  const unusedIndices = allIndices.filter(i => !indices.includes(i));
  
  if (unusedIndices.length > 0) {
    // 选取未使用过的最小编号
    return topic.subDirections![unusedIndices[0]];
  } else if (indices.length > 0) {
    // 已用完，循环使用（允许重复但需告知 AI 避免重复内容）
    return topic.subDirections![indices[indices.length - 1] % topic.subDirections!.length];
  }
  
  return null;
}
```

**理由**：
- 简单直观，易于理解和调试
- 确保每个子方向都被使用一次后再循环
- 记录已使用索引，便于追踪

**替代方案**：
- 方案 A：随机选取未使用的子方向
  - 缺点：不可预测，难以调试
- 方案 B：基于发帖时间动态计算
  - 缺点：过度设计，当前不需要

### 3. 标题去重逻辑调整

**决策**：仅与同主题历史发帖标题比对，不与主题标题本身比对

```typescript
// 修改前
const isDuplicate = historyTitles.some(
  histTitle => histTitle === generated.title
);
// historyTitles 来自 topic.postHistory.map(h => h.title)

// 修改后（逻辑不变，但明确文档说明）
// 仅与 postHistory 中的标题比对，不与 topic.title 比对
```

**理由**：
- 符合"标题仅供参考"的设计原则
- 保持代码最小变更（当前逻辑已经正确）
- 仅需在文档和注释中明确说明

### 4. Prompt 构建优化

**决策**：在 System Prompt 中明确说明标题仅供参考

```typescript
// 修改前
const systemPrompt = `
你是一位 30 岁的奥迪 A6L 车主...
你的任务是根据以下方向生成一篇小红书风格的帖子：
- 主题方向：${topic.direction}
`;

// 修改后
const systemPrompt = `
你是一位 30 岁的奥迪 A6L 车主...
你的任务是根据以下方向生成一篇小红书风格的帖子：
- 主题标题：${topic.title}（仅供参考，不需要保持一致）
- 子方向：${subDirection.direction}
- 内容提纲：${subDirection.outline || '无'}

注意：
- 标题请根据子方向和内容自由生成，体现帖子亮点
- 同一主题的多次发帖应有差异化和递进性
`;
```

**理由**：
- 明确告知 AI 标题的处理方式
- 强调子方向的重要性
- 鼓励差异化和递进性

### 5. 向后兼容处理

**决策**：为旧格式 topics.json 自动补充默认字段

```typescript
function normalizeTopic(raw: any): Topic {
  // 为没有 subDirections 的主题，使用 direction 作为默认子方向
  const hasSubDirections = Array.isArray(raw.subDirections) && raw.subDirections.length > 0;
  
  return {
    ...raw,
    subDirections: hasSubDirections 
      ? raw.subDirections 
      : [{ title: raw.title, direction: raw.direction, outline: raw.outline || '' }],
    usedSubDirectionIndices: raw.usedSubDirectionIndices || [],
    useCount: raw.useCount ?? 0,
    maxUseCount: raw.maxUseCount ?? 1,
    postHistory: raw.postHistory ?? [],
  };
}
```

**理由**：
- 旧主题自动兼容，无需手动迁移
- 单方向主题退化为原有行为
- 渐进式升级，降低迁移成本

## 风险 / 权衡

### 风险 1：旧主题无 subDirections 字段
**风险**：旧格式 topics.json 可能没有 subDirections 字段，导致读取失败

**缓解措施**：
- normalizeTopic() 函数自动补充默认子方向
- 使用 direction 字段作为唯一的子方向
- 确保代码对所有字段进行空值检查

### 风险 2：子方向数量不足
**风险**：用户配置的 subDirections 数量少于 maxUseCount，导致内容重复

**缓解措施**：
- 在创建主题时进行验证（可选）
- 当子方向耗尽时，在 Prompt 中告知 AI 避免与历史内容重复
- 记录日志提醒用户补充子方向

### 风险 3：发帖历史记录膨胀
**风险**：postHistory 记录过多子方向信息，导致文件过大

**缓解措施**：
- 仅记录必要字段（索引、标题、方向）
- 考虑添加配置限制 postHistory 最大长度
- 定期清理过期的历史记录（可选）

## 迁移计划

### 阶段 1：代码实现（本次变更）
- 扩展 Topic 接口和数据结构
- 实现子方向选取逻辑
- 优化 Prompt 构建
- 增强发帖历史记录

### 阶段 2：数据迁移（自动）
- 旧 topics.json 在读取时自动补充 subDirections
- 无需手动迁移脚本
- 首次读取时自动完成

### 阶段 3：用户引导（后续）
- 更新主题创建 UI，支持添加多个子方向
- 提供子方向编写指南
- 示例：如何为一个主题编写 5 个子方向

## Open Questions

1. **子方向验证**：是否需要在创建主题时验证 subDirections 数量 >= maxUseCount？
   - 倾向：作为警告而非错误，允许用户灵活配置

2. **历史记录清理**：是否需要定期清理 postHistory？
   - 倾向：暂不实现，等待实际需求

3. **子方向可视化**：如何在 UI 中展示和管理子方向？
   - 倾向：后续单独优化，本次仅实现后端逻辑
