# 图片去水印功能使用指南

## 功能概述

图片去水印功能用于自动移除互联网参考图片中的水印，提升发帖质量。该功能集成在自由发帖模式中，当系统从小红书等平台获取参考素材时，会自动处理图片水印。

## 核心特性

- ✅ **AI 智能识别**：使用 AI 模型识别和移除水印，支持文字水印、logo 水印等多种类型
- ✅ **批量处理**：并行处理多张图片，提高效率
- ✅ **失败降级**：去水印失败时自动使用原图，不影响发帖流程
- ✅ **性能监控**：详细的日志记录，包含处理时间统计
- ✅ **可配置**：支持启用/禁用、超时时间、重试次数等配置

## 配置说明

在 `config/default.yaml` 或 `config/local.yaml` 中配置：

```yaml
internetReference:
  enabled: true
  searchKeywords:
    - "奥迪"
    - "奥迪 A6L"
  maxResults: 5
  timeout: 15000
  rateLimitPerHour: 10
  platform: "xiaohongshu"
  watermarkRemoval:
    enabled: true          # 是否启用去水印功能（默认：true）
    timeout: 30000         # 单个图片去水印超时时间（毫秒，默认：30000）
    maxRetries: 2          # 失败重试次数（默认：2）
    batchSize: 5           # 批量处理数量（默认：5）
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用去水印功能 |
| `timeout` | number | `30000` | 单个图片去水印的超时时间（毫秒） |
| `maxRetries` | number | `2` | 失败时的最大重试次数 |
| `batchSize` | number | `5` | 批量处理的图片数量 |

## 工作流程

```
1. 互联网参考服务获取参考帖子
   ↓
2. 检测到图片 URL
   ↓
3. 调用去水印服务
   ↓
4. AI 识别并移除水印
   ↓
5. 返回处理后的图片 URL
   ↓
6. 传递给内容生成器使用
```

## 日志示例

### 成功处理

```
[去水印] 开始处理 3 篇参考帖子，其中 2 篇包含图片
[批量处理] 开始批量去水印，共 5 张图片
[性能] 图片去水印成功：耗时 2340ms, https://example.com/img1.jpg -> https://processed.com/img1.jpg
[批量处理] 去水印完成：总耗时 5680ms, 成功 5/5 张，未变化 0 张
[去水印] 参考帖子图片处理完成：3 篇帖子，2 篇已处理
```

### 失败降级

```
[性能] 图片去水印失败 (尝试 1/2, 耗时 30000ms): 去水印请求超时
[性能] 图片去水印失败 (尝试 2/2, 耗时 30000ms): 去水印请求超时
[性能] 图片去水印彻底失败，使用原图：总耗时 60000ms, URL: https://example.com/img.jpg
[批量处理] 去水印完成：总耗时 60000ms, 成功 0/1 张，未变化 1 张
```

## 自由发帖模式集成

在自由发帖模式中，系统会优先使用去水印后的图片：

1. **优先级 1**：使用 `processedImageUrls`（去水印后的图片）
2. **优先级 2**：降级使用 `imageUrls`（原始图片）
3. **优先级 3**：本地素材库匹配

```typescript
// auto-post.ts 中的处理逻辑
for (const ref of references) {
  // 优先使用处理后的图片 URL
  if (ref.processedImageUrls && ref.processedImageUrls.length > 0) {
    processedImageUrls.push(...ref.processedImageUrls);
  } else if (ref.imageUrls && ref.imageUrls.length > 0) {
    // 降级使用原始图片 URL
    originalImageUrls.push(...ref.imageUrls);
  }
}
```

## API 参考

### removeWatermark

移除单张图片的水印

```typescript
import { removeWatermark } from './services/watermark-removal-service';

const processedUrl = await removeWatermark(imageUrl, {
  enabled: true,
  timeout: 30000,
  maxRetries: 2,
  batchSize: 5,
});
```

### batchRemoveWatermarks

批量处理多张图片去水印

```typescript
import { batchRemoveWatermarks } from './services/watermark-removal-service';

const processedUrls = await batchRemoveWatermarks(imageUrls, {
  enabled: true,
  timeout: 30000,
  maxRetries: 2,
  batchSize: 5,
});
```

### processReferencePosts

处理参考帖子的图片去水印

```typescript
import { processReferencePosts } from './services/watermark-removal-service';

const processedPosts = await processReferencePosts(referencePosts);
// processedPosts 中每篇帖子都包含 processedImageUrls 字段
```

## 性能优化建议

1. **合理配置 batchSize**：根据 AI 服务的并发能力调整批量大小
2. **设置合适的超时时间**：避免过短导致失败，过长影响整体性能
3. **监控日志**：定期检查性能日志，优化配置参数
4. **启用失败重试**：网络波动时自动重试，提高成功率

## 故障排查

### 问题 1：去水印功能未生效

**检查**：
- 配置中 `watermarkRemoval.enabled` 是否为 `true`
- 查看日志是否有 `[去水印] 功能未启用，跳过处理`

**解决**：
```yaml
internetReference:
  watermarkRemoval:
    enabled: true
```

### 问题 2：去水印失败率高

**检查**：
- 查看日志中的失败原因
- 检查 AI 服务是否正常
- 检查网络连接

**解决**：
- 增加 `timeout` 值
- 增加 `maxRetries` 次数
- 检查 AI 服务配置

### 问题 3：处理速度过慢

**检查**：
- 查看性能日志中的平均处理时间
- 检查 `batchSize` 配置

**解决**：
- 减小 `batchSize` 以降低单次处理压力
- 优化 AI 服务响应时间
- 考虑升级 AI 服务配置

## 注意事项

1. **AI 服务依赖**：去水印功能依赖 AI 服务，确保 AI 配置正确
2. **网络要求**：需要能够访问图片 URL 和 AI 服务
3. **性能影响**：去水印会增加处理时间，建议监控性能指标
4. **成本控制**：频繁调用 AI 服务可能增加成本，合理配置使用频率

## 版本历史

- **v1.0.0** (2026-06-07)
  - 初始版本
  - AI 驱动的图片去水印功能
  - 批量处理和失败降级
  - 集成到自由发帖模式
