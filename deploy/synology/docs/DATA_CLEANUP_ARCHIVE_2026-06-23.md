# Data Directory Cleanup Archive

**清理日期**: 2026-06-23  
**执行人**: 系统管理员  
**清理目标**: 删除已迁移到数据库的历史遗留文件，保留核心元数据

---

## 📊 清理前状态

### 目录结构
```
data/
├── api-token.json              # Redis 迁移后冗余
├── token.json                  # Redis 迁移后冗余
├── vehicle-token.json          # Redis 迁移后冗余
├── image-cache.json            # Redis 迁移后冗余
├── comment-history.json        # MySQL 迁移后冗余
├── global-prompt.json          # MySQL 迁移后冗余
├── post-history.json           # MySQL 迁移后冗余
├── post-logs.json              # MySQL 迁移后冗余
├── sensitive-words.json        # Redis 迁移后冗余
├── pending-posts.json          # MySQL 迁移后冗余
├── post-history-content.json   # MySQL 迁移后冗余
├── test-output.txt             # 空文件（测试残留）
├── test-topic-example.json     # 测试示例文件
├── .DS_Store                   # macOS 系统文件
├── summaries/                  # MySQL 迁移后冗余（7 个文件）
├── compliance-reports/         # MySQL 迁移后冗余（12 个文件）
├── materials/                  # ✅ 正在使用（素材元数据）
│   └── processed/
│       ├── .materials/
│       │   ├── manifest.json
│       │   ├── index.json
│       │   └── info/**/*.json (44 个文件)
│       └── temp-images/        # 临时图片缓存
└── temp-images/                # 临时图片缓存
```

**总文件数**: ~79 个 JSON 文件 + 临时文件

---

## 🗑️ 已删除文件（16 个）

### 第一类：Redis 迁移后冗余（6 个）
- ❌ `api-token.json` - API Token（已在 Redis: `api:token`）
- ❌ `token.json` - Audi OAuth Token（已在 Redis）
- ❌ `vehicle-token.json` - 车辆 Token（已在 Redis: `vehicle:token`）
- ❌ `image-cache.json` - OCR 缓存（已在 Redis: `image:cache:*`）
- ❌ `sensitive-words.json` - 敏感词库（已在 Redis: `sensitive:*`）
- ❌ `pending-posts.json` - 待发布帖子（已在 MySQL: `pending_posts`）

### 第二类：MySQL 迁移后冗余（7 个）
- ❌ `comment-history.json` - 评论历史（已在 MySQL: `comments`）
- ❌ `global-prompt.json` - 全局提示词（已在 MySQL: `global_prompts`）
- ❌ `post-history.json` - 发帖历史（已在 MySQL: `posts`）
- ❌ `post-logs.json` - 发帖日志（已在 MySQL: `post_logs`）
- ❌ `post-history-content.json` - 帖子内容（已在 MySQL: `posts`）
- ❌ `summaries/` - 日报摘要目录（已在 MySQL: `daily_summaries`，7 个文件）
- ❌ `compliance-reports/` - 合规报告目录（已在 MySQL: `compliance_reports`，12 个文件）

### 第三类：无效文件（3 个）
- ❌ `test-output.txt` - 空文件（测试残留）
- ❌ `test-topic-example.json` - 测试示例文件
- ❌ `.DS_Store` - macOS 系统文件

**删除总计**: 16 个文件/目录

---

## ✅ 保留文件（关键元数据）

### materials/ 目录（必须保留）

```
materials/processed/
├── .materials/
│   ├── manifest.json          # ✅ 素材处理记录清单
│   ├── index.json             # ✅ 素材详细信息索引
│   └── info/                  # ✅ 单个素材元数据（44 个 JSON）
│       ├── 宣城市与黄山市/
│       │   └── *.json
│       ├── 邯郸市与安阳市/
│       │   └── *.json
│       └── ...
└── temp-images/               # ✅ 临时图片缓存（运行时使用）
```

### 为什么必须保留？

#### 1. **语义搜索依赖**
```typescript
// hybrid-material-service.ts
async matchLocalMaterials(keywords: string[], neededCount: number) {
  // 使用 ChromaDB 语义搜索
  const searchResults = await chromaSearchService.searchMaterials({
    query: keywords.join(' '),
    nResults: neededCount * 2,
  });
  
  // 从向量 ID 反查素材记录（需要文件系统元数据）
  for (const result of searchResults) {
    const record = await materialRecordStorage.getMaterialRecordById(result.id);
  }
}
```

#### 2. **发帖选图依赖 searchableText**
```typescript
// image-selector.ts
function selectImagesFromIndex(...) {
  const scored = index.items.map(item => {
    let score = 0;
    const searchText = (item.searchableText || '').toLowerCase();
    
    // 字段权重
    if (item.tags.some(tag => tag.includes(token))) {
      score += FIELD_WEIGHTS.tags * tokenWeight;  // 权重 3.0
    }
    if (item.intro.includes(token)) {
      score += FIELD_WEIGHTS.intro * tokenWeight; // 权重 2.0
    }
    // ...
  });
}
```

#### 3. **精华帖多角度检测**
```typescript
// image-selector.ts
function detectImageAngles(searchableText: string): string[] {
  const angles = [];
  if (keywords.some(kw => textLower.includes('外观'))) angles.push('exterior');
  if (keywords.some(kw => textLower.includes('内饰'))) angles.push('interior');
  if (keywords.some(kw => textLower.includes('细节'))) angles.push('details');
  if (keywords.some(kw => textLower.includes('场景'))) angles.push('scene');
  return angles;
}
```

#### 4. **完整元数据包含**
- ✅ EXIF 数据（相机型号、镜头、拍摄参数）
- ✅ GPS 坐标（经纬度、海拔）
- ✅ Vision AI 分析（tags, intro）
- ✅ searchableText（用于关键词匹配）
- ✅ 处理历史和时间戳

---

## 📈 清理后状态

### 目录结构
```
data/
├── materials/                  # ✅ 核心元数据（保留）
│   └── processed/
│       ├── .materials/
│       │   ├── manifest.json
│       │   ├── index.json
│       │   └── info/**/*.json (44 个)
│       └── temp-images/
└── temp-images/                # ✅ 临时缓存（保留）
```

**剩余文件数**: ~46 个（减少 42%）

---

## 🎯 存储架构说明

### 三层存储分工

| 存储层 | 存储内容 | 用途 | 状态 |
|--------|---------|------|------|
| **文件系统**<br>(`materials/.materials/`) | • 完整 EXIF 数据<br>• GPS 坐标<br>• Vision AI 分析（tags, intro）<br>• searchableText<br>• 处理历史 | ✅ 语义搜索的数据源<br>✅ 发帖选图的索引基础<br>✅ 多角度检测的关键词来源 | ✅ **保留** |
| **MySQL**<br>(`material_records`) | • 路径（original, processed）<br>• 基础尺寸信息<br>• OCR 文本<br>• 使用统计（used_count）<br>• 状态（status） | ✅ 业务查询<br>✅ 使用追溯<br>✅ 统计分析 | ✅ 已迁移 |
| **ChromaDB**<br>(`materials`) | • 512 维向量<br>• 简单元数据（file_path, tags） | ✅ 语义相似度搜索<br>✅ 智能推荐 | ✅ 已同步 |
| **Redis**<br>(各种 key) | • Token（api, vehicle, Audi OAuth）<br>• 敏感词库<br>• OCR 缓存<br>• 待发布队列 | ✅ 高速缓存<br>✅ 临时数据 | ✅ 已迁移 |

---

## ⚠️ 重要结论

### 文件系统元数据不可替代的原因

1. **ChromaDB 向量需要反查**
   - 向量只存储简单元数据
   - 完整信息在文件系统 JSON 中

2. **发帖选图依赖 searchableText**
   - 由路径、时间、相机、AI 分析等构建
   - 用于关键词匹配和评分

3. **精华帖需要多角度检测**
   - 检测外观、内饰、细节、场景
   - 基于 searchableText 中的关键词

4. **历史追溯需要完整记录**
   - EXIF、GPS、拍摄时间
   - AI 生成的 tags 和 intro

### 如果删除会怎样？

❌ **灾难性后果**：
- 语义搜索失效（无法反查完整信息）
- 发帖选图退化为随机选择
- 无法检测图片角度
- 精华帖质量下降
- 历史追溯完全丢失
- 需要重新运行 AI Vision（花钱）

---

## 🔧 后续建议

### 可选优化（但不删除）

1. **压缩历史元数据**
   ```bash
   # 对旧的 info JSON 进行 gzip 压缩
   find data/materials/processed/.materials/info -name "*.json" -mtime +30 -exec gzip {} \;
   ```

2. **定期重建索引**
   ```typescript
   // 已有功能
   await rebuildMaterialIndex(processedRoot, manifest);
   ```

3. **添加元数据缓存**
   - 将 searchableText 缓存到 Redis
   - 减少文件读取次数

4. **监控存储空间**
   - 定期检查 temp-images 目录
   - 清理过期临时文件

---

## 📋 清理命令记录

```bash
# 第一类：Redis 迁移后冗余
rm -f data/api-token.json
rm -f data/token.json
rm -f data/vehicle-token.json
rm -f data/image-cache.json
rm -f data/sensitive-words.json
rm -f data/pending-posts.json

# 第二类：MySQL 迁移后冗余
rm -f data/comment-history.json
rm -f data/global-prompt.json
rm -f data/post-history.json
rm -f data/post-logs.json
rm -f data/post-history-content.json
rm -rf data/summaries/
rm -rf data/compliance-reports/

# 第三类：无效文件
rm -f data/test-output.txt
rm -f data/test-topic-example.json
rm -f data/.DS_Store
```

---

## 📊 清理效果

| 指标 | 清理前 | 清理后 | 改善 |
|------|--------|--------|------|
| 文件总数 | ~79 | ~46 | -42% |
| 目录数 | 4 | 2 | -50% |
| 冗余数据 | 16 个 | 0 | -100% |
| 核心元数据 | 44 个 | 44 个 | 0% |

**清理完成时间**: 2026-06-23 11:18  
**验证状态**: ✅ 服务运行正常，发帖功能正常

---

## 📚 相关文档

- [数据库迁移指南](./DATABASE_MIGRATION_GUIDE.md)
- [素材处理流程](../src/services/material-processing.ts)
- [混合素材服务](../src/services/hybrid-material-service.ts)
- [图片选择器](../src/services/image-selector.ts)
- [ChromaDB 向量存储](../src/storage/chroma/material-vector-storage.ts)

---

**归档日期**: 2026-06-23  
**状态**: ✅ 完成  
**下次审查**: 2026-12-23（6 个月后）
