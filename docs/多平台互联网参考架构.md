# 多平台互联网参考架构（修正版）

## 架构说明

### 正确理解

**AutoJS 脚本角色**:
- 仅仅是发帖 API 的客户端
- 通过 HTTP 请求调用服务端发帖接口
- 不执行搜索逻辑，不传递平台参数

**服务端角色**:
- 负责所有互联网参考查询逻辑
- 负责多平台轮询策略
- 负责调用各平台的爬虫/API
- AutoJS 只接收最终的发帖内容

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
│  2. 调用平台搜索 API/爬虫    │
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

## 正确的实现方案

### 方案 A：服务端爬虫（推荐）

**思路**：服务端直接调用各平台的 API 或爬虫获取素材

**架构**:
```
服务端 auto-post 服务
  ↓
调用各平台搜索接口
  ├─ 小红书爬虫
  ├─ 微博 API/爬虫
  ├─ 知乎 API/爬虫
  └─ 汽车之家爬虫
  ↓
获取参考素材
  ↓
AI 生成内容 + 选择图片
  ↓
调用 AutoJS API 发帖
```

**优点**:
- ✅ 所有逻辑集中在服务端，易于维护
- ✅ AutoJS 脚本保持简单
- ✅ 平台扩展不影响客户端

**缺点**:
- ⚠️ 需要实现各平台的爬虫
- ⚠️ 可能遇到反爬机制

---

### 方案 B：AutoJS 作为执行器（备选）

**思路**：AutoJS 脚本作为通用的浏览器/APP 操作工具，服务端控制流程

**架构**:
```
服务端
  ↓
发送指令给 AutoJS
  ├─ "打开小红书，搜索'奥迪'"
  ├─ "抓取搜索结果"
  ├─ "返回数据"
  ↓
服务端处理数据
  ↓
AI 生成内容
  ↓
调用 AutoJS 发帖
```

**优点**:
- ✅ 不需要爬虫，使用真实 APP
- ✅ 可以获取实时数据

**缺点**:
- ⚠️ 流程复杂，执行慢
- ⚠️ AutoJS 脚本需要支持多种操作

---

## 推荐实施方案 A

### 1. 服务端爬虫模块

**目录结构**:
```
src/services/internet-search/
├── platform-base.ts          # 基础平台接口
├── xiaohongshu-search.ts     # 小红书搜索
├── weibo-search.ts           # 微博搜索
├── zhihu-search.ts           # 知乎搜索
└── autohome-search.ts        # 汽车之家搜索
```

**基础接口**:
```typescript
// platform-base.ts
export interface SearchResult {
  title: string;
  content: string;
  source: string;
  imageUrls?: string[];
  url?: string;
  author?: string;
  likes?: number;
}

export interface ISearchPlatform {
  search(keywords: string[], maxResults: number): Promise<SearchResult[]>;
  getPlatformName(): string;
}
```

**小红书搜索示例**:
```typescript
// xiaohongshu-search.ts
export class XiaohongshuSearch implements ISearchPlatform {
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    // 调用小红书 API 或爬虫
    const results = await this.crawlXiaohongshu(keywords[0], maxResults);
    return results.map(item => ({
      title: item.title,
      content: item.content,
      source: '小红书',
      imageUrls: item.images,
      url: item.url,
    }));
  }
  
  getPlatformName(): string {
    return 'xiaohongshu';
  }
}
```

### 2. 平台轮询服务

```typescript
// internet-reference-service.ts
export async function search(): Promise<SearchResult[]> {
  // 1. 选择平台（轮询策略）
  const platform = await selectNextPlatform();
  
  // 2. 调用平台搜索
  const searchService = this.getSearchService(platform);
  const results = await searchService.search(keywords, maxResults);
  
  // 3. 去水印处理
  const processedResults = await this.removeWatermarks(results);
  
  // 4. 返回结果
  return processedResults;
}

private getSearchService(platform: Platform): ISearchPlatform {
  switch (platform.platformName) {
    case 'xiaohongshu':
      return new XiaohongshuSearch();
    case 'weibo':
      return new WeiboSearch();
    case 'zhihu':
      return new ZhihuSearch();
    case 'autohome':
      return new AutohomeSearch();
    default:
      throw new Error(`未知平台：${platform.platformName}`);
  }
}
```

### 3. AutoJS 脚本（简化版）

**audi_post.js** (保持不变或简化):
```javascript
// 从服务端获取发帖任务
const task = await fetchPostTask();

// 执行发帖
await publishPost({
  title: task.title,
  content: task.content,
  images: task.imageUrls,
});

// 回调结果
await callback({
  success: true,
  postId: '...',
});
```

**AutoJS 不再负责搜索**，只负责执行发帖操作。

---

## 实施步骤

### Step 1: 创建爬虫模块（3-5 天）

1. 实现基础平台接口
2. 实现小红书爬虫（已有）
3. 实现微博爬虫
4. 实现知乎爬虫
5. 实现汽车之家爬虫

### Step 2: 修改互联网参考服务（1 天）

1. 集成各平台搜索服务
2. 实现平台轮询策略
3. 统一数据格式

### Step 3: 简化 AutoJS 脚本（0.5 天）

1. 移除搜索相关代码
2. 保持发帖功能

### Step 4: 测试验证（1-2 天）

1. 测试各平台爬虫
2. 测试平台轮询
3. 测试完整流程

---

## 爬虫实现方案

### 方案 A1: 官方 API（优先）

如果平台提供官方 API：
- 使用官方 API
- 稳定可靠
- 遵守平台规则

**示例**:
```typescript
// 微博开放平台 API
const weiboResults = await fetch(
  'https://api.weibo.com/2/search/topics.json',
  {
    headers: { 'Authorization': `Bearer ${token}` },
    params: { q: '奥迪', count: 5 }
  }
);
```

### 方案 A2: 网页爬虫（备选）

如果没有 API，使用网页爬虫：
- 使用 Puppeteer/Playwright
- 模拟浏览器行为
- 解析 HTML 获取数据

**示例**:
```typescript
// 使用 Puppeteer 爬取知乎
import puppeteer from 'puppeteer';

async function crawlZhihu(keyword: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto(`https://www.zhihu.com/search?q=${keyword}`);
  await page.waitForSelector('.SearchResult');
  
  const results = await page.evaluate(() => {
    const elements = document.querySelectorAll('.SearchResult');
    return Array.from(elements).map(el => ({
      title: el.querySelector('.ContentItem-title')?.textContent,
      content: el.querySelector('.RichText')?.textContent,
    }));
  });
  
  await browser.close();
  return results;
}
```

### 方案 A3: 第三方服务（快速）

使用第三方数据服务：
- 聚合数据
- 阿里云市场
- 其他 API 服务商

**示例**:
```typescript
// 使用阿里云市场的微博 API
const response = await fetch(
  'https://wei-bo-api.showapi.com/search',
  {
    headers: { 'Authorization': `APPCODE ${token}` },
    params: { keyword: '奥迪' }
  }
);
```

---

## 总结

### 核心变更

**变更前**（错误理解）:
- ❌ AutoJS 脚本负责搜索
- ❌ 每个平台一个 AutoJS 脚本
- ❌ 服务端只接收结果

**变更后**（正确架构）:
- ✅ 服务端负责所有搜索逻辑
- ✅ AutoJS 只负责发帖
- ✅ 平台扩展只需修改服务端

### 优势

1. **架构清晰**: 服务端负责业务逻辑，AutoJS 负责执行
2. **易于维护**: 所有搜索逻辑集中在服务端
3. **快速扩展**: 新增平台只需修改服务端
4. **稳定性高**: AutoJS 脚本简单，不易出错

### 下一步

1. 确认爬虫实现方案（API/爬虫/第三方）
2. 实现各平台搜索服务
3. 集成到互联网参考服务
4. 测试验证
