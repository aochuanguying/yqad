# 图片 URL 流转逻辑深度复盘

## 核心发现

**重大误区纠正**：
- ❌ **错误理解**：图片需要上传到奥迪 CDN
- ✅ **正确理解**：图片 URL 应该是 **X5 服务器地址**，AutoJS 脚本从 X5 服务器下载图片

---

## 正确的图片流转架构

```
┌─────────────────────────────────────────────────────────────┐
│  服务端 (yqad on X5-server:3080)                            │
│                                                              │
│  1. 选择本地图片                                             │
│     ./data/materials/processed/xxx.jpg                      │
│                                                              │
│  2. 生成图片元数据 (image-metadata.ts)                       │
│     url = `${config.web.baseUrl}/images/xxx.jpg`            │
│     = "https://yqad.hxfssc.com:8088/images/xxx.jpg"         │
│                                                              │
│  3. 保存到 pending_posts                                    │
│     image_urls: ["https://yqad.hxfssc.com:8088/images/..."] │
│                                                              │
│  4. AutoJS 脚本获取内容                                      │
│     GET /api/posts/pending/{taskId}                         │
│     返回 imageUrls 数组                                      │
│                                                              │
│  5. AutoJS 脚本下载图片                                      │
│     GET https://yqad.hxfssc.com:8088/images/xxx.jpg         │
│     保存到手机本地                                           │
│                                                              │
│  6. AutoJS 脚本发帖                                          │
│     使用手机 Token + 本地图片                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 关键代码分析

### 1. 图片元数据生成

**文件**: [`image-metadata.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/utils/image-metadata.ts#L105-L116)

```typescript
function generateImageUrl(relativePath: string): string {
  const config = loadConfig();
  
  const normalizedPath = relativePath.replace(/^\/+/, '');
  
  if (!config.web.baseUrl) {
    return `images/${normalizedPath}`;  // 相对路径（不推荐）
  }
  
  const baseUrl = config.web.baseUrl.replace(/\/+$/, '');
  return `${baseUrl}/images/${normalizedPath}`;  // ← 完整 URL
}
```

**示例输出**:
```
输入：relativePath = "temp-images/abc123.jpg"
输出：url = "https://yqad.hxfssc.com:8088/images/temp-images/abc123.jpg"
```

---

### 2. 错误的图片上传逻辑（应该删除）

**文件**: [`auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L669)

```typescript
// ❌ 错误逻辑：上传到奥迪 CDN
const token = await this.authService.getAccessToken();
const uploadResult = await this.api.uploadImages(token, imagePaths);
imageUrls = uploadResult.urls;  // 奥迪 CDN URL，AutoJS 无法访问！
```

**为什么这是错的**：
1. 奥迪 CDN URL 需要 Token 才能访问
2. AutoJS 脚本在手机上，无法使用服务端的 Token
3. 奥迪 CDN URL 可能有防盗链限制
4. **完全没必要**：图片本来就在 X5 服务器上！

---

### 3. 正确的图片流转（应该使用）

**文件**: [`auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts#L1192-L1194)

```typescript
// ✅ 正确逻辑：使用本地素材库
const localMaterials = await hybridMaterialService.matchLocalMaterials([generated.title], 50);
const imagePaths = localMaterials.slice(0, neededImages).map(m => m.path);

// 生成元数据（自动转换为 X5 服务器 URL）
const imageInfos = generateBatchImageMetadata(imagePaths);
const imageUrls = imageInfos.map(info => info.url);
// 结果：["https://yqad.hxfssc.com:8088/images/xxx.jpg", ...]
```

---

## AutoJS 脚本端逻辑

### 脚本获取发帖内容

**文件**: `docs/AutoJS6 发帖客户端使用指南.md`

```javascript
// AutoJS 脚本调用服务端 API
const response = http.postJson(`${SERVER_URL}/posts/generate`, {
  useTopic: true,
  mode: "featured"
}, {
  headers: {
    "Authorization": `Bearer ${AUTH_TOKEN}`
  }
});

const data = response.body.json();
const imageUrls = data.data.images; 
// ["https://yqad.hxfssc.com:8088/images/xxx.jpg", ...]
```

### AutoJS 脚本下载图片

```javascript
// AutoJS 脚本从 X5 服务器下载图片
imageUrls.forEach((url, index) => {
  const imgResponse = http.get(url);  // ← 直接访问 X5 服务器
  const savePath = `/sdcard/Pictures/AudiPosts/img_${index}.jpg`;
  files.writeBytes(savePath, imgResponse.bytes);
});
```

---

## 配置说明

### config/default.yaml

```yaml
web:
  enabled: true
  port: 3000          # 本地开发端口
  baseUrl: "https://yqad.hxfssc.com:8088"  # ← 生产环境访问地址
```

**重要**：
- `baseUrl` 必须是 **AutoJS 脚本能访问到的地址**
- 如果使用 Docker 部署，需要确保：
  - 图片目录挂载到容器外
  - Nginx 反向代理 `/images` 路径
  - 防火墙允许访问

---

## 图片访问流程详解

### 1. 本地图片存储

```
X5-server 文件系统:
  /opt/docker/yqad/data/materials/processed/
    ├── topic-001/
    │   ├── img1.jpg
    │   ├── img2.jpg
    │   └── img3.jpg
    └── temp-images/
        └── ref_abc123.jpg
```

### 2. Docker 挂载配置

```yaml
# docker-compose.yml
services:
  yqad:
    volumes:
      - ./data/materials/processed:/app/data/materials/processed
      # 确保图片目录挂载到容器外
```

### 3. Nginx 反向代理（可选）

如果使用 Nginx 代理：

```nginx
# Nginx 配置
location /images/ {
    alias /opt/docker/yqad/data/materials/processed/;
    add_header Access-Control-Allow-Origin *;
}
```

访问示例：
```
https://yqad.hxfssc.com:8088/images/temp-images/ref_abc123.jpg
```

---

## 为什么不需要上传到奥迪 CDN？

### 1. 架构层面

```
错误架构：
本地图片 → 上传到奥迪 CDN → AutoJS 下载 → 发帖
         ↑ 需要 Token      ↑ 可能失败

正确架构：
本地图片 → X5 服务器 URL → AutoJS 下载 → 发帖
         ↑ 公开访问       ↑ 直接下载
```

### 2. Token 隔离

| 环节 | Token 需求 | 说明 |
|------|-----------|------|
| 服务端访问奥迪 API | ✅ 需要 | 图片上传、签到等 |
| AutoJS 脚本访问 X5 服务器 | ❌ **不需要** | 公开下载 |
| AutoJS 脚本发帖 | ✅ 需要 | 使用手机 Token |

### 3. 实际效果对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| 上传奥迪 CDN | - | 需要 Token、可能防盗链、增加失败点 |
| 使用 X5 服务器 | ���单直接、无需额外 Token、稳定可靠 | 需要确保 X5 服务器可访问 |

---

## 代码修正建议

### 应该删除的逻辑

```typescript
// ❌ 删除这些上传图片到 CDN 的代码
const token = await this.authService.getAccessToken();
const uploadResult = await this.api.uploadImages(token, imagePaths);
imageUrls = uploadResult.urls;
```

### 应该使用的逻辑

```typescript
// ✅ 直接使用 generateBatchImageMetadata
const imageInfos = generateBatchImageMetadata(imagePaths);
const imageUrls = imageInfos.map(info => info.url);

// 或者更简单（如果已经是本地路径）
const imageUrls = imagePaths.map(path => {
  const info = generateImageMetadata(path);
  return info.url;
});
```

---

## Token 刷新策略的影响

### 修改后的配置

```typescript
// src/services/auth.ts
private readonly TOKEN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;   // 6 小时
private readonly TOKEN_REFRESH_LEAD_TIME = 24 * 60 * 60 * 1000; // 24 小时
```

### 对图片流转的影响

**修改前**（错误理解）：
- Token 用于上传图片到奥迪 CDN
- Token 过期 → 无法上传图片 → 发帖失败

**修改后**（正确理解）：
- Token **不用于**图片流转
- Token 用于：签到、获取帖子列表、评论等
- 图片始终通过 X5 服务器提供，**不依赖 Token**

---

## 完整的发帖流程（修正版）

```
1. AI 生成内容
   ↓
2. 选择本地图片 (./data/materials/processed/xxx.jpg)
   ↓
3. 生成图片 URL (https://yqad.hxfssc.com:8088/images/xxx.jpg)
   ↓
4. 保存到 pending_posts (image_urls 字段)
   ↓
5. AutoJS 脚本获取内容
   ↓
6. AutoJS 脚本下载图片 (从 X5 服务器)
   ↓
7. AutoJS 脚本发帖 (使用手机 Token)
   ↓
8. 回调服务端更新状态
```

---

## 关键要点总结

### ✅ 正确理解

1. **图片 URL 来源**: `config.web.baseUrl + "/images/" + relativePath`
2. **图片存储位置**: X5 服务器本地文件系统
3. **AutoJS 访问方式**: HTTP 下载（公开访问，无需 Token）
4. **Token 使用场景**: 服务端调用奥迪 API（签到、评论等）

### ❌ 错误理解

1. ~~图片需要上传到奥迪 CDN~~
2. ~~AutoJS 需要 Token 才能下载图片~~
3. ~~Token 刷新会影响图片上传~~

### 🔧 需要修正的代码

| 文件 | 行号 | 问题 | 修正方案 |
|------|------|------|---------|
| `auto-post.ts` | 669 | 上传到奥迪 CDN | 改用 `generateBatchImageMetadata()` |
| `auto-post.ts` | 1100 | 上传到奥迪 CDN | 改用 `generateBatchImageMetadata()` |
| `auto-post.ts` | 1201 | 上传到奥迪 CDN | 改用 `generateBatchImageMetadata()` |
| `auto-post.ts` | 1387 | 上传到奥迪 CDN | 改用 `generateBatchImageMetadata()` |

---

## 验证方法

### 1. 检查图片 URL 格式

```bash
# 查看 pending_posts 表中的 image_urls
mysql> SELECT id, image_urls FROM pending_posts LIMIT 1;

# 应该看到类似：
# ["https://yqad.hxfssc.com:8088/images/xxx.jpg", ...]
```

### 2. 测试 AutoJS 下载

```javascript
// AutoJS 脚本测试
const testUrl = "https://yqad.hxfssc.com:8088/images/test.jpg";
const response = http.get(testUrl);
log(response.statusCode); // 应该返回 200
```

### 3. 浏览器访问

```
直接在浏览器打开：
https://yqad.hxfssc.com:8088/images/xxx.jpg

应该能看到图片
```

---

**文档生成时间**: 2026-07-26  
**相关文件**: 
- [`src/utils/image-metadata.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/utils/image-metadata.ts)
- [`src/utils/image-downloader.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/utils/image-downloader.ts)
- [`src/services/auto-post.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/auto-post.ts)
- [`config/default.yaml`](file:///Users/mac/Documents/workspace/krio/yqad/config/default.yaml)
