# 主题复用策略优化 - 实现进度总结

## 已完成的任务

### ✅ 任务 1: 数据结构扩展
- [x] 1.1 在 topics-service.ts 中定义 SubDirection 接口
- [x] 1.2 扩展 Topic 接口，增加 subDirections 和 usedSubDirectionIndices 字段
- [x] 1.3 更新 normalizeTopic 函数，为旧格式补充 subDirections 默认值

**修改文件：** `src/web/services/topics-service.ts`

```typescript
// 新增 SubDirection 接口
export interface SubDirection {
  title: string;        // 子方向标题
  direction: string;    // 子方向描述
  outline: string;      // 内容提纲
}

// Topic 接口扩展
export interface Topic {
  // ... 现有字段
  subDirections?: SubDirection[];
  usedSubDirectionIndices?: number[];
}

// normalizeTopic 函数更新
function normalizeTopic(raw: any): Topic {
  const hasSubDirections = Array.isArray(raw.subDirections) && raw.subDirections.length > 0;
  return {
    ...raw,
    subDirections: hasSubDirections 
      ? raw.subDirections 
      : [{ title: raw.title, direction: raw.direction, outline: raw.outline || '' }],
    usedSubDirectionIndices: raw.usedSubDirectionIndices || [],
  };
}
```

### ✅ 任务 2: 内容池选取逻辑
- [x] 2.1 实现 selectNextSubDirection 函数，按索引顺序选取子方向
- [x] 2.2 在 topics-service.ts 中导出该函数

**修改文件：** `src/web/services/topics-service.ts`

```typescript
export function selectNextSubDirection(topic: Topic): SubDirection | null {
  if (!topic.subDirections || topic.subDirections.length === 0) {
    return null;
  }

  const indices = topic.usedSubDirectionIndices || [];
  const allIndices = topic.subDirections.map((_, i) => i);
  const unusedIndices = allIndices.filter(i => !indices.includes(i));

  if (unusedIndices.length > 0) {
    // 选取未使用过的最小编号
    return topic.subDirections[unusedIndices[0]];
  } else if (indices.length > 0) {
    // 已用完，循环使用
    const nextIndex = indices[indices.length - 1] % topic.subDirections.length;
    return topic.subDirections[nextIndex];
  }

  return topic.subDirections[0];
}
```

### ✅ 任务 3: 递增使用计数时记录子方向
- [x] 3.3 在 incrementUseCount 时同步更新 usedSubDirectionIndices

**修改文件：** `src/web/services/topics-service.ts`

```typescript
export function incrementUseCount(id: string, postSummary: PostSummary, usedSubDirectionIndex?: number): Topic | null {
  // ... 现有代码
  
  // 如果提供了子方向索引，记录已使用的子方向
  if (usedSubDirectionIndex !== undefined && topics[index].subDirections) {
    if (!topics[index].usedSubDirectionIndices) {
      topics[index].usedSubDirectionIndices = [];
    }
    topics[index].usedSubDirectionIndices!.push(usedSubDirectionIndex);
  }
  
  // ... 现有代码
}
```

### ✅ 任务 4: 发帖历史增强
- [x] 5.1 扩展 PostSummary 接口，增加 usedSubDirectionIndex 字段

**修改文件：** `src/types/posting-optimization.ts`

```typescript
export interface PostSummary {
  title: string;
  contentSnippet: string;
  timestamp: string;
  usedSubDirectionIndex?: number;  // 使用的子方向索引
}
```

### ✅ 任务 5: Prompt 构建优化
- [x] 4.1 在 prompts.ts 中更新 buildPostSystemPrompt，增加子方向参数
- [x] 4.2 在 System Prompt 中明确说明"主题标题仅供参考"

**修改文件：** `src/ai/prompts.ts`

```typescript
export function buildPostSystemPrompt(
  summary: AnalysisSummary,
  globalPrompt?: GlobalPostPrompt,
  topicHistory?: PostSummary[],
  subDirection?: { title: string; direction: string; outline: string },
  isTitleReference: boolean = false
): string {
  // 构建子方向提示块
  const subDirectionBlock = subDirection
    ? `\n\n【本次创作的具体方向】
主题标题：${subDirection.title}${isTitleReference ? '（仅供参考，不需要保持一致）' : ''}
子方向：${subDirection.direction}
内容提纲：${subDirection.outline || '无'}

注意：
- 标题请根据子方向和内容自由生成，体现帖子亮点${isTitleReference ? '，主题标题仅供参考' : ''}
- 同一主题的多次发帖应有差异化和递进性`
    : '';

  // ... 返回包含 subDirectionBlock 的完整 prompt
}
```

### ✅ 任务 6: 内容生成器集成
- [x] 在 content-generator.ts 中解析 topicConstraint 并传递 subDirection

**修改文件：** `src/ai/content-generator.ts`

```typescript
export async function generatePost(...): Promise<GeneratedPost> {
  // 解析 topicConstraint 获取子方向
  let subDirection: { title: string; direction: string; outline: string } | undefined;
  if (topicConstraint) {
    const isSubDirection = topicConstraint.startsWith('子方向：');
    if (isSubDirection) {
      const lines = topicConstraint.split('\n');
      const direction = lines[0].replace('子方向：', '').trim();
      const outlineMatch = lines.find(l => l.startsWith('内容提纲：'));
      const outline = outlineMatch ? outlineMatch.replace('内容提纲：', '').trim() : '';
      subDirection = { title: topic, direction, outline };
    }
  }

  const systemPrompt = buildPostSystemPrompt(
    summary,
    options?.globalPrompt,
    options?.topicHistory,
    subDirection,
    true  // isTitleReference = true
  );
  
  // ... 继续生成内容
}
```

## 待完成的任务

### ⏳ 任务 3: 发帖流程集成（部分完成）
- [ ] 3.1 在 auto-post.ts 的 postWithTopic 中调用 selectNextSubDirection
- [ ] 3.2 修改 topicConstraint 构建，使用子方向的 direction 和 outline
- [ ] 3.3 在 incrementUseCount 时同步更新 usedSubDirectionIndices（已完成）

**需要修改的文件：** `src/services/auto-post.ts`

需要做的修改：
1. 在 postWithTopic 函数开始处调用 selectNextSubDirection
2. 根据返回的子方向构建 topicConstraint
3. 在 incrementUseCount 调用时传入 usedSubDirectionIndex

### ⏳ 任务 7: 向后兼容处理
- [ ] 7.1 确保旧 topics.json 读取时自动补充 subDirections（已通过 normalizeTopic 实现）
- [ ] 7.2 测试无 subDirections 字段时退化为原 behavior
- [ ] 7.3 验证 maxUseCount=1 的主题不受影响

### ⏳ 任务 8: 测试与验证
- [ ] 8.1 创建测试主题（maxUseCount=3，3 个子方向）
- [ ] 8.2 执行 3 次发帖，验证每次使用不同子方向
- [ ] 8.3 验证生成的标题各不相同且与子方向相关
- [ ] 8.4 验证发帖历史记录包含 usedSubDirectionIndex
- [ ] 8.5 运行现有测试确保无破坏性变更

## 下一步操作

需要完成 auto-post.ts 的修改，主要是在 postWithTopic 函数中：

1. **调用 selectNextSubDirection 选取子方向**
2. **构建 topicConstraint 使用子方向**
3. **在 incrementUseCount 时传入子方向索引**

修改完成后，整个功能即可投入使用。

## 测试计划

1. 创建测试主题：
```json
{
  "title": "大同古城游记",
  "direction": "分享大同古城游览体验",
  "maxUseCount": 3,
  "subDirections": [
    {
      "title": "古城墙夜景",
      "direction": "描述大同古城墙的壮丽夜景和拍摄体验",
      "outline": "1. 到达时间 2. 灯光效果 3. 拍摄角度 4. 门票信息"
    },
    {
      "title": "古城美食探索",
      "direction": "分享大同古城内的特色美食和小吃",
      "outline": "1. 推荐店铺 2. 必点菜品 3. 价格参考 4. 口味评价"
    },
    {
      "title": "历史文化体验",
      "direction": "讲述大同古城的历史文化背景和游览感受",
      "outline": "1. 历史沿革 2. 建筑特色 3. 文化体验 4. 游览建议"
    }
  ]
}
```

2. 执行 3 次发帖，验证：
   - 每次使用不同的 subDirection
   - 生成的标题各不相同
   - 内容与子方向紧密相关
   - postHistory 中记录了 usedSubDirectionIndex

3. 验证向后兼容性：
   - 旧格式主题（无 subDirections）正常工作
   - maxUseCount=1 的主题不受影响

## 总结

核心功能已实现完成，包括：
- ✅ 数据结构扩展
- ✅ 内容池选取逻辑
- ✅ Prompt 构建优化
- ✅ 发帖历史增强

仅剩 auto-post.ts 的集成工作，预计 10 分钟内即可完成。
