# 知乎 API 配置与使用指南

## ✅ 实施状态

**状态**：✅ 已完成并测试通过  
**测试时间**：2026-06-28  
**测试结果**：搜索"奥迪 Q5L"返回 10 条高质量结果

---

## 📋 快速开始

### Step 1: 获取 Access Secret

1. 访问知乎开放平台：https://developer.zhihu.com/
2. 注册/登录知乎账号
3. 进入个人中心：https://developer.zhihu.com/profile
4. 创建应用（如果需要）
5. 复制 **Access Secret**

### Step 2: 配置环境变量

**方式 1：添加到 .env 文件**
```bash
# 项目根目录的 .env 文件
ZHIHU_ACCESS_SECRET=11d78a6c28453c03f047552bc588d03ad227db52
```

**方式 2：直接设置环境变量**
```bash
# macOS/Linux
export ZHIHU_ACCESS_SECRET=11d78a6c28453c03f047552bc588d03ad227db52

# Windows PowerShell
$env:ZHIHU_ACCESS_SECRET="11d78a6c28453c03f047552bc588d03ad227db52"
```

### Step 3: 测试验证

```bash
# 运行测试脚本
python3 test_zhihu_correct.py
```

**预期输出**：
```
============================================================
开始测试知乎 API 搜索功能（正确方法）
============================================================

正在搜索：奥迪 Q5L
API 端点：https://developer.zhihu.com/api/v1/content/zhihu_search
时间戳：1782593205
请求头：Authorization: Bearer 11d78a6c28453c03f047...

HTTP 状态码：200
✓ 搜索成功！
Code: 0, Message: success
找到 10 条结果

【结果 1】
标题：燃油 SUV 车主熬出头了！华为乾崑智驾加持，全新奥迪 Q5L 率先实现智能化
类型：Article
作者：量子位
认证：新知答主
摘要：为了提升全新奥迪 Q5L 的动力响应速度，华为乾崑专门为奥迪深度调校了 VMM...
赞同：5
评论：0
权威等级：1, 排序分：1.54
链接：https://zhuanlan.zhihu.com/p/2031360576560046234?...
```

---

## 🔧 代码集成

### TypeScript 使用示例

```typescript
import { InternetSearchManager } from './src/services/internet-search';

// 创建搜索管理器
const manager = new InternetSearchManager();

// 搜索关键词
const keywords = ['奥迪 Q5L', '奥迪保养', 'SUV 推荐'];
const maxResults = 5;

try {
  const results = await manager.search(keywords, maxResults);
  
  console.log(`找到 ${results.length} 条结果`);
  
  for (const result of results) {
    console.log(`标题：${result.title}`);
    console.log(`作者：${result.author}`);
    console.log(`赞同：${result.likes}`);
    console.log(`链接：${result.url}`);
    console.log('---');
  }
} catch (error) {
  console.error('搜索失败:', error);
}
```

### 直接使用知乎搜索服务

```typescript
import { ZhihuSearch } from './src/services/internet-search/zhihu-search';

// 创建知乎搜索实例
const zhihuSearch = new ZhihuSearch();

// 执行搜索
const results = await zhihuSearch.search(['奥迪 Q5L'], 5);

// 处理结果
results.forEach(item => {
  console.log({
    title: item.title,
    content: item.content,
    author: item.author,
    likes: item.likes,
    comments: item.comments,
    url: item.url,
    metadata: item.metadata, // 额外信息
  });
});
```

---

## 📊 API 响应格式

### 成功响应示例

```json
{
  "Code": 0,
  "Message": "success",
  "Data": {
    "HasMore": false,
    "SearchHashId": "1234567890",
    "Items": [
      {
        "Title": "奥迪 Q5L 怎么样？",
        "ContentType": "Answer",
        "ContentID": "123456789",
        "ContentText": "2026.05.31 更新----今年春天去了河南和河北...",
        "Url": "https://www.zhihu.com/question/320106113/answer/125409698463?utm_medium=openapi_platform&utm_source=xxx",
        "CommentCount": 72,
        "VoteUpCount": 23,
        "AuthorName": "考拉呼呼",
        "AuthorAvatar": "https://picx.zhimg.com/xxx.jpg",
        "AuthorBadge": "",
        "AuthorBadgeText": "",
        "EditTime": 1717200000,
        "CommentInfoList": [],
        "AuthorityLevel": "1",
        "RankingScore": 1.48
      }
    ],
    "EmptyReason": ""
  }
}
```

### SearchResult 格式

```typescript
interface SearchResult {
  title: string;           // 标题
  content: string;         // 内容摘要
  source: string;          // 来源（"知乎"）
  url: string;            // 原文链接（带 UTM 参数）
  author: string;         // 作者（可能包含认证信息）
  likes: number;          // 赞同数
  comments: number;       // 评论数
  metadata?: {           // 额外信息（可选）
    contentType: string;      // 内容类型（Article/Answer）
    contentId: string;        // 内容 ID
    authorAvatar: string;     // 作者头像
    authorBadge: string;      // 作者认证图标
    editTime: number;         // 发布时间戳
    authorityLevel: string;   // 权威等级
    rankingScore: number;     // 排序分数
  };
}
```

---

## 🎯 使用场景

### 1. 互联网参考素材查询

```typescript
import { search } from './src/services/internet-reference-service';

// 查询互联网参考素材（自动使用知乎等平台）
const references = await search();

// 生成发帖内容
for (const ref of references) {
  console.log(`参考来源：${ref.source}`);
  console.log(`标题：${ref.title}`);
  console.log(`内容：${ref.content}`);
}
```

### 2. 多平台轮询搜索

```typescript
import { InternetSearchManager } from './src/services/internet-search';

const manager = new InternetSearchManager();

// 自动轮询所有已配置平台
const results = await manager.search(['奥迪 Q5L'], 10);

// 结果可能来自知乎、小红书、微博等平台
results.forEach(item => {
  console.log(`[${item.source}] ${item.title}`);
});
```

---

## ⚠️ 注意事项

### 1. 频率限制

- **免费额度**：每天 1000 次调用
- **建议**：实现请求限流，避免触发 429 错误
- **监控**：记录每日调用次数

```typescript
// 示例：简单的限流实现
class RateLimiter {
  private callsToday = 0;
  private lastResetDate = new Date().toDateString();
  
  async canCall(): Promise<boolean> {
    // 重置计数器（新的一天）
    if (new Date().toDateString() !== this.lastResetDate) {
      this.callsToday = 0;
      this.lastResetDate = new Date().toDateString();
    }
    
    // 检查是否超限
    return this.callsToday < 1000;
  }
  
  async recordCall(): Promise<void> {
    this.callsToday++;
  }
}
```

### 2. 错误处理

```typescript
try {
  const results = await zhihuSearch.search(['奥迪 Q5L'], 5);
  
  if (results.length === 0) {
    console.log('搜索结果为空，尝试其他关键词');
  }
} catch (error) {
  if (error.message.includes('401')) {
    console.error('认证失败，检查 Access Secret 配置');
  } else if (error.message.includes('429')) {
    console.error('频率超限，请稍后重试');
  } else {
    console.error('搜索失败:', error);
  }
}
```

### 3. 内容使用

- ✅ 可以用于内容参考和灵感获取
- ✅ 需要注明内容来源
- ⚠️ 不要直接复制粘贴（可能涉及版权问题）
- ✅ 建议结合 AI 改写生成原创内容

---

## 🔍 搜索技巧

### 1. 关键词优化

```typescript
// ❌ 太宽泛
await search(['汽车']);

// ✅ 更具体
await search(['奥迪 Q5L 保养费用']);
await search(['SUV 推荐 30 万']);
await search(['华为乾崑智驾 奥迪']);
```

### 2. 结果数量控制

```typescript
// 推荐 5-10 条
await search(['关键词'], 5);   // 最佳
await search(['关键词'], 10);  // 最大

// 太多会增加处理成本
await search(['关键词'], 20);  // 会被截断为 10
```

### 3. 结合其他平台

```typescript
// 多平台轮询，获取更丰富的素材
const keywords = ['奥迪 Q5L'];
const results = await manager.search(keywords, 10);

// 统计各平台结果
const platformCount = {};
results.forEach(item => {
  platformCount[item.source] = (platformCount[item.source] || 0) + 1;
});

console.log(platformCount);
// 输出：{ "知乎": 6, "小红书": 3, "微博": 1 }
```

---

## 📚 相关文档

- [免费搜索平台对比](./FREE_SEARCH_PLATFORMS.md)
- [多平台搜索架构](./MULTI_PLATFORM_ARCHITECTURE.md)
- [搜索功能实现状态](./SEARCH_IMPLEMENTATION_STATUS.md)

---

## 🐛 常见问题

### Q: 返回结果为空？

**A**: 可能原因：
1. 关键词太冷门，尝试更通用的关键词
2. 检查响应中的 `EmptyReason` 字段
3. 确认 Access Secret 是否有效

### Q: 认证失败（Code: 20001）？

**A**: 
1. 检查 Access Secret 是否正确
2. 确认 `X-Request-Timestamp` 是秒级时间戳
3. 检查时间戳是否与当前时间相差太大

### Q: 频率超限（Code: 30001）？

**A**: 
1. 等待第二天再试（每天 1000 次免费额度）
2. 联系知乎开放平台提升额度
3. 实现请求缓存，减少重复查询

---

**文档更新时间**: 2026-06-28  
**状态**: ✅ 生产就绪
