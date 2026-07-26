# 图片上传到 CDN 使用逻辑详解

## 概述

在自动发帖流程中，**图片上传到奥迪 CDN** 是唯一需要调用服务端 Token 的环节（AutoJS 远程发帖模式下）。

**核心逻辑**：
1. AI 生成内容后，从本地素材库选择图片
2. 调用奥迪 API `uploadImages()` 将图片上传到 CDN
3. 获取图片 URL，传递给 AutoJS 脚本
4. AutoJS 脚本使用这些 URL 进行发帖（手机端使用自己的 Token）

---

## 使用场景

### 场景 1：主题发帖模式（executeTopicPost）

**文件**: [`auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L647)

**调用位置**:
```typescript
// 步骤 4：上传图片到 CDN
private async uploadImagesTo CDN(ctx: PostPipelineContext): Promise<void> {
  const token = await this.authService.getAccessToken(); // ← 行 655
  
  if (featuredEnabled) {
    // 精华帖模式：确保最少图片数量
    imageUrls = await this.uploadImagesToMinCount(
      token,           // ← 需要 Token
      imagePaths, 
      featuredConfig?.minImages || 3,
      featuredConfig?.maxImageUploadRetries || 3
    );
  } else {
    // 普通帖模式：直接上传
    const uploadResult = await this.api.uploadImages(token, imagePaths); // ← 行 669
    imageUrls = uploadResult.urls;
  }
}
```

**调用链路**:
```
executeTopicPost()
  ↓
executePostPipeline()
  ↓
uploadImagesToCDN(ctx)  ← 第 647 行
  ↓
getAccessToken()        ← 第 655 行
  ↓
uploadImages(token, imagePaths)  ← 第 669 行
```

---

### 场景 2：自由发帖模式（executeFreePost）- 简单模式

**文件**: [`auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L1200)

**调用位置**:
```typescript
// 自由发帖模式（非互联网参考）
const imagePaths = localMaterials.slice(0, neededImages).map(m => m.path);

// 上传图片（需要 accessToken）
const imageUrls: string[] = [];
if (imagePaths.length > 0) {
  try {
    const token = await this.authService.getAccessToken(); // ← 行 1200
    const uploadResult = await this.api.uploadImages(token, imagePaths); // ← 行 1201
    imageUrls.push(...uploadResult.urls);
  } catch (uploadErr: any) {
    logger.warn(`图片上传失败，以纯文字方式继续：${uploadErr.message}`);
  }
}
```

**调用链路**:
```
executeFreePost()
  ↓
AI 生成内容
  ��
选择本地图片
  ↓
getAccessToken()        ← 第 1200 行
  ↓
uploadImages(token, imagePaths)  ← 第 1201 行
```

---

### 场景 3：自由发帖模式（executeFreePost）- 互联网参考模式

**文件**: [`auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L1379)

**调用位置**:
```typescript
// 互联网参考模式
if (featuredEnabled) {
  // 精华帖模式：确保最少图片数量
  const supplemental = selectFeaturedImageCandidates({
    keywords: generated.title + ' ' + generated.content,
    minCount: minImages,
  });
  const candidates = Array.from(new Set([...imagePaths, ...supplemental]));
  
  imageUrls = await this.uploadImagesToMinCount(
    token,                                      // ← token 来自行 1367
    candidates, 
    minImages,
    featuredConfig?.maxImageUploadRetries || 3
  ); // ← 行 1379
  
  // 降级逻辑
  if (imageUrls.length < minImages && featuredEnabled) {
    logger.warn(`图片上传后数量不足（${imageUrls.length}/${minImages}），降级为普通帖`);
    currentMode = 'normal';
  }
} else {
  // 普通帖模式
  const uploadResult = await this.api.uploadImages(token, imagePaths); // ← 行 1387
  imageUrls = uploadResult.urls;
}
```

**调用链路**:
```
executeFreePost() - 互联网参考模式
  ↓
AI 生成内容 + 互联网参考
  ↓
选择本地图片 + 补充素材
  ↓
getAccessToken()        ← 第 1367 行
  ↓
uploadImagesToMinCount(token, ...)  ← 第 1379 行 (精华模式)
  或
uploadImages(token, imagePaths)     ← 第 1387 行 (普通模式)
```

---

## 核心函数详解

### 1. uploadImagesToCDN()

**位置**: 行 647-683

**功能**: 主题发帖模式下的图片上传

**逻辑**:
```typescript
private async uploadImagesTo CDN(ctx: PostPipelineContext): Promise<void> {
  // 1. 获取 Token
  const token = await this.authService.getAccessToken(); // 行 655
  
  // 2. 根据模式选择上传策略
  if (featuredEnabled) {
    // 精华帖：确保最少 3 张图片
    imageUrls = await this.uploadImagesToMinCount(
      token, 
      imagePaths, 
      minImages (默认 3),
      maxRetries (默认 3)
    );
  } else {
    // 普通帖：直接上传所有图片
    const uploadResult = await this.api.uploadImages(token, imagePaths);
    imageUrls = uploadResult.urls;
  }
  
  // 3. 保存到上下文
  ctx.imageUrls = imageUrls;
}
```

---

### 2. uploadImagesToMinCount()

**位置**: 行 1080-1114

**功能**: 确保上传成功至少 `minImages` 张图片

**参数**:
- `token: string` - 奥迪 API Token
- `candidates: string[]` - 候选图片路径列表
- `minImages: number` - 最少需要的图片数量（通常 3 张）
- `maxRetries: number` - 最大重试次数（通常 3 次）

**逻辑**:
```typescript
private async uploadImagesToMinCount(
  token: string,
  candidates: string[],
  minImages: number,
  maxRetries: number
): Promise<string[]> {
  const remaining = [...candidates];
  const used = new Set<string>();
  const imageUrls: string[] = [];

  // 循环上传，直到达到最少数量或无图可传
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (imageUrls.length >= minImages) break;
    
    const available = remaining.filter(p => !used.has(p));
    if (available.length === 0) break;

    // 计算本批次上传数量（最多 9 张）
    const need = minImages - imageUrls.length;
    const batchSize = Math.min(9, available.length, Math.max(minImages, need));
    const batch = available.slice(0, batchSize);
    
    // 标记为已使用
    for (const p of batch) used.add(p);

    // 上传本批次
    const uploadResult = await this.api.uploadImages(token, batch); // ← 行 1100
    for (const url of uploadResult.urls) {
      if (!imageUrls.includes(url)) imageUrls.push(url);
    }

    if (imageUrls.length >= minImages) break;
  }

  // 降级处理
  if (imageUrls.length === 0) {
    logger.warn('图片上传全部失败，以纯文字方式继续发帖');
  } else if (imageUrls.length < minImages) {
    logger.warn(`图片上传后仍不足：${imageUrls.length}/${minImages}，将降级发普通帖`);
  }

  return imageUrls;
}
```

**特点**:
- ✅ **分批上传**: 每批次最多 9 张图片
- ✅ **重试机制**: 最多重试 3 次
- ✅ **智能补充**: 不足时从候选列表中补充
- ✅ **降级处理**: 全部失败时发纯文字帖

---

### 3. api.uploadImages()

**功能**: 调用奥迪 API 上传图片到 CDN

**API 接口**:
```typescript
async uploadImages(token: string, imagePaths: string[]): Promise<{
  urls: string[];
  failed: number;
}>
```

**Headers** (需要 Token):
```typescript
{
  'x-access-token': token,
  'x-audi-did': 'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1',
  'x-channel': 'iOS',
  'x-audi-entry': 'app',
  'x-microservice-name': 'api-gateway',
  'x-namespace-code': 'production',
  'sv': '6.1.1',
  'user-agent': 'AudiApp/506.1.1 (com.fawvw.audisuper; build:33; iOS 26.5.0) Alamofire/5.11.1',
  'accept': 'application/json',
  'content-type': 'application/json',
  'x-lang': 'zh-CN',
}
```

**端点**: `POST /cnapi/v1/image/upload` (推测)

---

## Token 刷新策略对图片上传的影响

### 修改后的配置

```typescript
// src/services/auth.ts
private readonly TOKEN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;   // 6 小时检查一次
private readonly TOKEN_REFRESH_LEAD_TIME = 24 * 60 * 60 * 1000; // 剩余 24 小时刷新
```

### 影响分析

| 场景 | 修改前 | 修改后 | 改善 |
|------|--------|--------|------|
| 检查频率 | 12 小时 | **6 小时** | 更及时发现 Token 问题 |
| 刷新阈值 | 剩余 6 小时 | **剩余 24 小时** | 更充足缓冲，避免上传失败 |
| 安全裕度 | 低 | **高** | 图片上传成功率提升 |

**实际效果**:
- ✅ 图片上传失败率降低（Token 始终有效）
- ✅ 夜间也能自动刷新（无需人工干预）
- ✅ 精华帖图片数量更有保障

---

## 错误处理与降级

### 1. Token 获取失败

```typescript
try {
  const token = await this.authService.getAccessToken();
  // ... 上传逻辑
} catch (tokenErr: any) {
  logger.error(`获取 Token 失败：${tokenErr.message}`);
  // 降级：以纯文字方式发帖
  imageUrls = [];
}
```

### 2. 图片上传部分失败

```typescript
const uploadResult = await this.api.uploadImages(token, imagePaths);
if (uploadResult.failed > 0 && imageUrls.length > 0) {
  logger.warn(`部分图片上传失败：成功${imageUrls.length}张，失败${uploadResult.failed}张`);
  // 使用成功的图片继续
} else if (imageUrls.length === 0) {
  logger.warn('图片上传全部失败，以纯文字方式继续发帖');
}
```

### 3. 精华帖降级为普通帖

```typescript
if (imageUrls.length < minImages && featuredEnabled) {
  logger.warn(`图片上传后数量不足（${imageUrls.length}/${minImages}），降级为普通帖`);
  currentMode = 'normal';  // 强制降级
}
```

---

## 完整调用链路图

```
用户触发发帖
  ↓
┌──────────────────────────────────────┐
│ 1. 内容生成                           │
│    - AI 生成标题和内容                 │
│    - 不需要 Token                      │
└──────────────────────────────────────┘
  ↓
┌──────────────────────────────────────┐
│ 2. 图片选择                           │
│    - 从本地素材库选择                  │
│    - 不需要 Token                      │
└──────────────────────────────────────┘
  ↓
┌──────────────────────────────────────┐
│ 3. 图片上传到 CDN (需要 Token!) ⚠️    │
│    - getAccessToken()                │
│    - 检查 Token 有效性                 │
│    - 如剩余时间 < 24h 则刷新           │
│    - uploadImages(token, paths)      │
│    - 获取图片 URL                      │
└──────────────────────────────────────┘
  ↓
┌──────────────────────────────────────┐
│ 4. 保存到 pending_posts               │
│    - 不需要 Token                      │
│    - 等待 AutoJS 回调                  │
└──────────────────────────────────────┘
  ↓
┌──────────────────────────────────────┐
│ 5. AutoJS 脚本执行                    │
│    - 从服务端获取内容+图片 URL          │
│    - 下载图片到手机                    │
│    - 使用手机 Token 发帖 ⚠️            │
│    - 回调服务端更新状态                │
└──────────────────────────────────────┘
```

---

## 关键要点总结

### Token 使用位置

| 行号 | 函数 | 场景 | 说明 |
|------|------|------|------|
| 655 | `uploadImagesToCDN()` | 主题发帖 | 获取 Token 用于上传 |
| 669 | `uploadImagesToCDN()` | 主题发帖 (普通模式) | 直接上传所有图片 |
| 1100 | `uploadImagesToMinCount()` | 主题发帖 (精华模式) | 确保最少 3 张图片 |
| 1200-1201 | `executeFreePost()` | 自由发帖 (简单模式) | 直接上传 |
| 1367, 1379, 1387 | `executeFreePost()` | 自由发帖 (互联网参考) | 精华/普通模式 |

### 为什么需要上传图片到 CDN？

1. **帖子内容完整性**: 图文并茂的帖子更有吸引力
2. **精华帖要求**: 精华帖必须至少 3 张图片
3. **AutoJS 发帖**: 脚本需要图片 URL 才能发帖
4. **CDN 加速**: 图片存储在奥迪 CDN，加载更快

### Token 刷新的必要性

- ✅ **图片上��必须 Token**: 没有 Token 无法上传图片
- ✅ **提前 24 小时刷新**: 确保上传时 Token 有效
- ✅ **6 小时检查**: 及时发现并处理问题
- ✅ **降级机制**: Token 失效时发纯文字帖

---

**文档生成时间**: 2026-07-26  
**相关文件**: 
- [`src/services/auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts)
- [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts)
- [`docs/token-usage-review.md`](file:///Users/mac/Documents/workspace/krio/yqad/docs/token-usage-review.md)
