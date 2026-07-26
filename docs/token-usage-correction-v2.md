# Token 使用逻辑复盘 - 修正版

## 重要修正说明

**之前的错误盘点**：
- ❌ 错误 1：列出了"签到操作"作为 Token 使用场景
- ❌ 错误 2：声称"图片上传到奥迪 CDN"需要 Token
- ❌ 错误 3：没有区分清楚 AutoJS 远程发帖模式

**正确的事实**：
- ✅ 自动签到功能**早已废弃**，代码中不存在
- ✅ 图片**不需要**上传到奥迪 CDN，使用 X5 服务器 URL
- ✅ AutoJS 远程发帖**不需要**服务端 Token

---

## 真正的 Token 使用场景

### 1. 获取热门话题列表

**文件**: [`auto-post.ts:694`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L694)

```typescript
// 步骤 5：匹配热门话题
private async matchHotTopics(ctx: PostPipelineContext): Promise<void> {
  const token = await this.authService.getAccessToken();
  
  try {
    const hotTopics = await fetchHotTopics(token);  // ← 需要 Token
    // ...
  } catch (error: any) {
    logger.warn(`话题匹配失败：${error.message}，以无话题方式继续发帖`);
  }
}
```

**说明**: 
- 调用奥迪 API 获取热门话题列表
- 失败时降级为无话题发帖
- **不影响主流程**

---

### 2. 自动评论服务

**文件**: [`auto-comment.ts:132`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-comment.ts#L132)

```typescript
// 发布评论
const currentToken = await this.authService.getAccessToken();
const response = await this.api.publishComment(
  currentToken,  // ← 需要 Token
  enrichedPost.id, 
  generated.content, 
  enrichedPost.contentType
);
```

**说明**:
- 这是**真正需要 Token** 的场景
- 调用奥迪 API 发表评论
- Token 过期会导致评论失败

---

### 3. 会员信息查询

**文件**: [`member-routes.ts:35`](file:///Users/mac/Documents/workspace/krio/yqad/src/web/routes/member-routes.ts#L35)

```typescript
// GET /api/member/info
const accessToken = await auth.getAccessToken();
const memberInfo = await api.getMemberInfo(accessToken);  // ← 需要 Token
```

**说明**:
- Web UI 查看会员信息
- Token 过期会返回 `code=10009 请您重新登录系统`

---

### 4. API 模式远程发帖（可选）

**文件**: [`auto-post.ts:1883`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L1883)

```typescript
// 注意：这里需要 token，但 API 模式下由手机端发布，所以可选
const hotTopics = await fetchHotTopics('');  // ← 可以传空字符串
```

**说明**:
- API 模式下 Token 是**可选的**
- 话题匹配可以传空字符串跳过
- 发帖由 AutoJS 脚本使用手机 Token 完成

---

## 不存在的 Token 使用场景

### ❌ 场景 1：自动签到

**错误描述**: 之前盘点声称有"签到操作"需要 Token

**事实核查**:
```bash
# 搜索代码中的签到相关
$ grep -r "signIn\|签到\|checkIn" src/services/
# 结果：无任何匹配

# 搜索 autoSign
$ grep -r "autoSign" src/
# 结果：仅在 API 文档中提及，代码中无实现
```

**结论**: 
- 自动签到功能**早已废弃**
- 代码中**不存在**签到相关逻辑
- 不应该列入 Token 使用场景

---

### ❌ 场景 2：图片上传到奥迪 CDN

**错误描述**: 之前盘点声称"图片上传需要 Token"

**事实核查**:

**错误的代码理解**:
```typescript
// ❌ 错误理解：认为这些代码需要保留
const token = await this.authService.getAccessToken();
const uploadResult = await this.api.uploadImages(token, imagePaths);
```

**正确的理解**:
```typescript
// ✅ 正确理解：这些代码应该删除！
// 图片应该使用 X5 服务器 URL，不需要上传到奥迪 CDN

// 正确的逻辑应该是：
const imageInfos = generateBatchImageMetadata(imagePaths);
const imageUrls = imageInfos.map(info => info.url);
// 结果：["https://yqad.hxfssc.com:8088/images/xxx.jpg", ...]
```

**结论**:
- 图片**不应该**上传到奥迪 CDN
- 图片 URL 应该是 **X5 服务器地址**
- AutoJS 脚本从 X5 服务器下载图片
- **不需要 Token**

---

## Token 刷新策略的真实影响

### 修改后的配置

```typescript
// src/services/auth.ts
private readonly TOKEN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;   // 6 小时检查
private readonly TOKEN_REFRESH_LEAD_TIME = 24 * 60 * 60 * 1000; // 24 小时刷新
```

### 真正受影响的场景

| 场景 | 是否需要 Token | 影响程度 | 说明 |
|------|--------------|---------|------|
| **自动评论** | ✅ **需要** | 🔴 **高** | Token 过期无法评论 |
| **会员信息查询** | ✅ **需要** | 🔴 **高** | Token 过期无法查询 |
| **热门话题获取** | ✅ **需要** | 🟡 **中** | 失败可降级为无话题 |
| **图片上传 CDN** | ❌ **不需要** | 🟢 **无** | 图片走 X5 服务器 |
| **自动签到** | ❌ **不存在** | 🟢 **无** | 功能已废弃 |
| **AutoJS 远程发帖** | ❌ **不需要** | 🟢 **无** | 使用手机 Token |

---

## 正确的 Token 使用频率排序

### 实际使用情况

1. **自动评论** - 每条评论调用 1 次（最高频）
   - 文件：[`auto-comment.ts:132`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-comment.ts#L132)
   - 频率：取决于评论数量

2. **会员信息查询** - 用户主动查询时调用
   - 文件：[`member-routes.ts:35`](file:///Users/mac/Documents/workspace/krio/yqad/src/web/routes/member-routes.ts#L35)
   - 频率：取决于用户查询频率

3. **热门话题获取** - 每次发帖调用 1 次
   - 文件：[`auto-post.ts:694`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L694)
   - 频率：取决于发帖频率
   - **可降级**: 失败时不影响发帖

### 不存在的场景

- ❌ 自动签到（功能已废弃）
- ❌ 图片上传到 CDN（改用 X5 服务器）
- ❌ AutoJS 远程发帖（使用手机 Token）

---

## 代码修正建议

### 应该删除的代码

**文件**: [`auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts)

```typescript
// ❌ 删除这些上传图片到 CDN 的代码（行号：669, 1100, 1201, 1387）
const token = await this.authService.getAccessToken();
const uploadResult = await this.api.uploadImages(token, imagePaths);
imageUrls = uploadResult.urls;
```

**替换为**:
```typescript
// ✅ 正确的逻辑：生成 X5 服务器 URL
const imageInfos = generateBatchImageMetadata(imagePaths);
const imageUrls = imageInfos.map(info => info.url);
// 结果：["https://yqad.hxfssc.com:8088/images/xxx.jpg", ...]
```

---

## 监控与告警修正

### 正确的监控点

1. **Token 过期告警**
   ```
   [member-routes] 获取会员信息失败：code=10009 请您重新登录系统
   ```

2. **评论失败告警**
   ```
   [auto-comment] 发布评论失败：Token 已过期
   ```

3. **Token 刷新日志**
   ```
   [auth] 【Token 主动刷新检查 - 触发刷新】
   [auth] 【Token 主动刷新结果 - 成功/失败】
   ```

### 应该移除的监控点

- ❌ "签到失败"（功能已废弃）
- ❌ "图片上传失败"（不上传 CDN）

---

## 总结

### 核心要点

1. **自动签到已废弃** - 不应该列入 Token 使用场景
2. **图片不上传 CDN** - 使用 X5 服务器 URL，不需要 Token
3. **AutoJS 远程发帖** - 使用手机 Token，不需要服务端 Token
4. **真正的 Token 用户** - 评论、会员查询、话题获取（可选）

### Token 刷新策略的意义

- ✅ **6 小时检查** - 及时发现 Token 问题
- ✅ **24 小时刷新** - 确保评论、会员查询等功能正常
- ✅ **提前量大** - 避免 Token 过期导致服务中断
- ✅ **不影响的场景** - 图片流转、AutoJS 发帖

### 修正后的文档

- ✅ 删除"自动签到"相关描述
- ✅ 删除"图片上传 CDN"相关描述
- ✅ 明确 AutoJS 远程发帖不需要服务端 Token
- ✅ 聚焦真正的 Token 使用场景

---

**文档生成时间**: 2026-07-26  
**修正原因**: 之前盘点存在重大错误，误导了对 Token 使用场景的理解  
**相关文件**: 
- [`src/services/auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts)
- [`src/services/auto-comment.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-comment.ts)
- [`src/services/auth.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auth.ts)
- [`src/utils/image-metadata.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/utils/image-metadata.ts)
