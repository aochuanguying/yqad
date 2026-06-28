# 服务端多平台搜索实施报告（修正版）

## 实施时间
2026-06-28

## 架构修正

### 正确理解

**AutoJS 脚本角色**:
- ✅ 仅仅是发帖 API 的客户端
- ✅ 通过 HTTP 请求调用服务端发帖接口
- ✅ 不执行搜索逻辑，不传递平台参数
- ✅ 只接收最终的发帖内容（标题、内容、图片）

**服务端角色**:
- ✅ 负责所有互联网参考查询逻辑
- ✅ 负责多平台轮询策略
- ✅ 负责调用各平台的爬虫/API
- ✅ AutoJS 只负责执行发帖操作

### 数据流

```
┌─────────────┐
│  定时任务   │
│  触发发帖   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  服务端 auto-post 服务      │
│                             │
│  1. 选择平台（轮询策略）     │
│  2. 调用平台搜索服务        │
│  3. 获取参考素材            │
│  4. AI 生成内容             │
│  5. 选择图片                │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  调用 AutoJS API            │
│  POST /api/posts/execute    │
│                             │
│  参数：{                     │
│    title: "标题",           │
│    content: "内容",         │
│    imageUrls: [...]         │
│  }                          │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  AutoJS 脚本                │
│                             │
│  1. 接收发帖参数            │
│  2. 打开奥迪 APP            │
│  3. 执行发帖操作            │
│  4. 回调结果                │
└─────────────────────────────┘
```

---

## 已完成的实施

### 1. 平台搜索基础接口 ✅

**文件**: `src/services/internet-search/platform-base.ts`

**核心接口**:
```typescript
interface ISearchPlatform {
  search(keywords: string[], maxResults: number): Promise<SearchResult[]>;
  getPlatformName(): string;
  getPlatformDisplayName(): string;
  isAvailable?(): Promise<boolean>;
}

interface SearchResult {
  title: string;
  content: string;
  source: string;
  imageUrls?: string[];
  url?: string;
  author?: string;
  likes?: number;
  comments?: number;
}
```

---

### 2. 平台搜索服务实现 ✅

#### 2.1 小红书搜索服务

**文件**: `src/services/internet-search/xiaohongshu-search.ts`

**实现方案**:
- 方案 1: 第三方 API（推荐）
- 方案 2: 网页爬虫（Puppeteer）
- 方案 3: 官方 API（如果有）

**示例代码**:
```typescript
export class XiaohongshuSearch implements ISearchPlatform {
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    // 使用第三方 API 或爬虫
    const results = await this.crawlWeb(keywords, maxResults);
    return results;
  }
}
```

#### 2.2 微博搜索服务

**文件**: `src/services/internet-search/weibo-search.ts`

**实现方案**:
- 微博开放平台 API
- 降级方案

**API 文档**: https://open.weibo.com/wiki/API 文档

#### 2.3 知乎搜索服务

**文件**: `src/services/internet-search/zhihu-search.ts`

**实现方案**:
- 网页爬虫（Puppeteer）
- 知乎没有开放搜索 API

#### 2.4 汽车之家搜索服务

**文件**: `src/services/internet-search/autohome-search.ts`

**实现方案**:
- 网页爬虫（论坛、口碑）
- 汽车之家没有开放 API

---

### 3. 搜索服务管理器 ✅

**文件**: `src/services/internet-search/search-manager.ts`

**核心功能**:
- ✅ 管理所有平台搜索服务
- ✅ 实现平台轮询策略
- ✅ 提供统一的搜索接口
- ✅ 降级处理（平台失败时尝试其他平台）

**轮询策略**:
```typescript
async selectNextPlatform(): Promise<ISearchPlatform | null> {
  const platforms = await this.getAvailablePlatforms();
  
  // 轮询：选择与上次不同的平台
  if (this.lastUsedPlatform) {
    const otherPlatforms = platforms.filter(p => p.name !== this.lastUsedPlatform);
    if (otherPlatforms.length > 0) {
      const sorted = await this.sortByPriority(otherPlatforms);
      return sorted[0];
    }
  }
  
  // 默认返回优先级最高的
  const sorted = await this.sortByPriority(platforms);
  return sorted[0];
}
```

---

### 4. 互联网参考服务集成 ✅

**文件**: `src/services/internet-reference-service.ts`

**修改内容**:
- ✅ 移除 AutoJS API 搜索调用
- ✅ 使用 `internetSearchManager.search()` 统一接口
- ✅ 简化搜索流程

**新流程**:
```typescript
export async function search(): Promise<SearchResult[]> {
  // 1. 检查配置
  const config = await getInternetReferenceStorage().getConfig();
  
  // 2. 使用搜索管理器查询（自动平台轮询）
  const results = await internetSearchManager.search(keywords, maxResults);
  
  // 3. 去水印处理
  const processedResults = await removeWatermark(results);
  
  // 4. 返回结果
  return processedResults;
}
```

---

## 目录结构

```
src/services/internet-search/
├── platform-base.ts          # 基础接口定义
├── search-manager.ts         # 搜索管理器（轮询策略）
├── xiaohongshu-search.ts     # 小红书搜索
├── weibo-search.ts           # 微博搜索
├── zhihu-search.ts           # 知乎搜索
├── autohome-search.ts        # 汽车之家搜索
└── index.ts                  # 索引文件
```

---

## 使用方法

### 1. 在 auto-post.ts 中调用

```typescript
import { internetSearchManager } from './internet-search';

// 在 tryInternetReferenceMode 中调用
const references = await internetSearchManager.search(keywords, maxResults);
```

### 2. 配置平台优先级

通过数据库 `internet_reference_platforms` 表配置：

```sql
UPDATE internet_reference_platforms 
SET priority = 10, enabled = 1 
WHERE platform_name = 'xiaohongshu';
```

### 3. 添加新平台

1. 创建新的搜索服务类：
```typescript
// douyin-search.ts
export class DouyinSearch implements ISearchPlatform {
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    // 实现搜索逻辑
  }
}
```

2. 在 `search-manager.ts` 中注册：
```typescript
this.platforms.set('douyin', new DouyinSearch());
```

3. 在数据库中配置平台

---

## 爬虫实现方案

### 方案选择

**优先级**：
1. 官方 API（最稳定）
2. 第三方 API（快速）
3. 网页爬虫（灵活）

### 网页爬虫示例

**使用 Puppeteer**:

```typescript
import puppeteer from 'puppeteer';

async function crawlZhihu(keyword: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.goto(`https://www.zhihu.com/search?q=${keyword}`);
  
  const results = await page.evaluate(() => {
    const items = document.querySelectorAll('.SearchResult');
    return Array.from(items).map(item => ({
      title: item.querySelector('.ContentItem-title')?.textContent,
      content: item.querySelector('.RichText')?.textContent,
    }));
  });
  
  await browser.close();
  return results;
}
```

### 第三方 API 示例

**使用微博 API**:

```typescript
async function searchWeibo(keyword: string) {
  const response = await fetch(
    `https://api.weibo.com/2/search/topics.json?access_token=${token}&q=${keyword}`,
    { method: 'GET' }
  );
  
  const data = await response.json();
  return data.data.map(item => ({
    title: item.title,
    content: item.content,
    source: '微博',
  }));
}
```

---

## 优势对比

### 原方案（错误）

❌ AutoJS 脚本负责搜索
❌ 每个平台一个 AutoJS 脚本
❌ 服务端只接收结果
❌ 架构复杂，难以维护

### 新方案（正确）

✅ 服务端负责所有搜索逻辑
✅ AutoJS 只负责发帖
✅ 平台扩展只需修改服务端
✅ 架构清晰，易于维护

---

## 下一步工作

### 1. 实现具体爬虫逻辑（3-5 天）

- [ ] 小红书爬虫/第三方 API 集成
- [ ] 微博 API 集成
- [ ] 知乎爬虫实现
- [ ] 汽车之家爬虫实现

### 2. 安装依赖（0.5 天）

```bash
npm install puppeteer
```

### 3. 测试验证（1-2 天）

- [ ] 测试各平台搜索功能
- [ ] 测试平台轮询策略
- [ ] 测试降级处理
- [ ] 测试完整发帖流程

### 4. 简化 AutoJS 脚本（0.5 天）

- [ ] 移除搜索相关代码
- [ ] 保持发帖功能不变

---

## 总结

### 核心变更

**架构变更**:
- ✅ 所有搜索逻辑移到服务端
- ✅ AutoJS 脚本简化为纯客户端
- ✅ 平台扩展不影响客户端

**文件变更**:
- ✅ 新增 6 个搜索服务文件
- ✅ 修改 `internet-reference-service.ts`
- ✅ 删除 AutoJS 搜索脚本（不需要了）

### 优势

1. **架构清晰**: 服务端负责业务逻辑，AutoJS 负责执行
2. **易于维护**: 所有搜索逻辑集中在服务端
3. **快速扩展**: 新增平台只需修改服务端
4. **稳定性高**: AutoJS 脚本简单，不易出错

### 实施状态

✅ 基础架构完成
✅ 接口定义完成
✅ 管理器实现完成
⏳ 具体爬虫实现（待完成）
⏳ 测试验证（待完成）

---

**实施报告生成时间**: 2026-06-28  
**架构师**: AI Assistant  
**状态**: 架构完成，待实现具体爬虫
