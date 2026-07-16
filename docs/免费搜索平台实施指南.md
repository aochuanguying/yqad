# 免费互联网搜索平台实施指南

## 概述

本文档总结了所有**完全免费**的互联网搜索平台方案，用于多平台轮询发帖系统。

---

## ✅ 已验证可用的平台

### 1. 知乎 ⭐⭐⭐⭐⭐（强烈推荐）

**状态**：✅ 已实现并测试通过

**特点**：
- 官方数据开放平台 API
- 每天免费 1000 次调用
- 高质量专业内容
- 平均响应 600ms
- 支持全网搜索 + 站内搜索

**申请流程**：
1. 访问 https://developer.zhihu.com/
2. 注册知乎开发者账号
3. 创建应用
4. 获取 Access Secret
5. 设置环境变量：`ZHIHU_ACCESS_SECRET=your_token`

**API 端点**：
```
GET https://developer.zhihu.com/api/v1/content/zhihu_search
Headers:
  Authorization: Bearer <your_access_secret>
  X-Request-Timestamp: <秒级 Unix 时间戳>
  Content-Type: application/json
Params:
  Query: 搜索关键词
  limit: 结果数量
```

**测试结果**：
```bash
# 测试命令
python3 test_zhihu_correct.py

# 结果
HTTP 状态码：200
✓ 搜索成功！
```

**实施文件**：
- `src/services/internet-search/zhihu-search.ts`

---

### 2. 小红书 ⭐⭐⭐⭐

**状态**：⏳ 需要 Cookie 和签名算法

**特点**：
- 完全免费
- 只需网页版 Cookie
- 需要 x-s/x-t 签名算法
- 数据实时、内容丰富

**获取 Cookie**：
1. 访问 https://www.xiaohongshu.com/explore
2. 登录账号
3. F12 打开开发者工具
4. Network 标签 → 复制任意请求的 Cookie

**关键 Cookie 字段**：
- `id_token` - 身份认证令牌
- `web_session` - 会话 ID
- `xsecappid` - 应用 ID
- `a1` - 设备指纹
- `webid` - 用户 Web ID

**推荐方案**：
- 方案 A：使用 [xhs-mcp](https://github.com/jobsonlook/xhs-mcp)（需要研究签名算法）
- 方案 B：使用 [rednote-api](https://github.com/hostinger-bot/rednote-api)（Rust 实现）
- 方案 C：使用 [XHS-Downloader](https://github.com/lin49098022/XHS-Downloader)（Python 实现）

**挑战**：
- 需要 JavaScript 逆向工程生成签名
- Cookie 有有效期，需要定期更新

---

### 3. 微博 ⭐⭐⭐⭐

**状态**：⏳ 需要申请开发者账号

**特点**：
- 官方开放平台 API
- 免费额度（有频率限制）
- OAuth 2.0 认证
- 支持搜索、热榜、用户信息

**申请流程**：
1. 访问 http://open.weibo.com/
2. 注册微博开发者账号（需身份证认证）
3. 创建应用
4. 获取 App Key 和 App Secret
5. OAuth 2.0 认证获取 access_token

**API 端点**：
```
GET https://api.weibo.com/2/search/topics.json
Params:
  access_token: <OAuth Token>
  q: 搜索关键词
  count: 结果数量
```

**挑战**：
- 需要身份证照片认证
- 测试级别 Token 有效期只有 1 天
- 中文界面操作

---

## 🔧 实施步骤

### Step 1: 配置环境变量

```bash
# .env 文件
ZHIHU_ACCESS_SECRET=11d78a6c28453c03f047552bc588d03ad227db52
XHS_COOKIE=abRequestId=...; web_session=...; id_token=...; ...
WEIBO_ACCESS_TOKEN=your_weibo_token
```

### Step 2: 启用搜索服务

搜索管理器会自动轮询所有已配置的平台：

```typescript
// src/services/internet-search/search-manager.ts
export class InternetSearchManager {
  async search(keywords: string[], maxResults: number = 5): Promise<SearchResult[]> {
    // 自动选择已配置且可用的平台
    const platform = await this.selectNextPlatform();
    return await platform.search(keywords, maxResults);
  }
}
```

### Step 3: 测试验证

```bash
# 测试知乎搜索
python3 test_zhihu_correct.py

# 测试小红书搜索（需要实现签名）
python3 test_xhs_search.py
```

---

## 📊 平台对比

| 平台 | 费用 | 申请难度 | 数据质量 | 稳定性 | 推荐指数 |
|------|------|----------|----------|--------|----------|
| **知乎** | 免费 1000 次/天 | ⭐⭐ 简单 | ⭐⭐⭐⭐⭐ 专业 | ⭐⭐⭐⭐⭐ 官方 | ⭐⭐⭐⭐⭐ |
| **小红书** | 免费 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐ 丰富 | ⭐⭐⭐ 需签名 | ⭐⭐⭐⭐ |
| **微博** | 免费（有限额） | ⭐⭐⭐⭐ 需身份证 | ⭐⭐⭐ 实时 | ⭐⭐⭐⭐ 官方 | ⭐⭐⭐⭐ |

---

## 🎯 推荐实施方案

### 快速上线（1 小时）

1. ✅ **知乎 API** - 已测试通过，立即可用
2. ⏳ 配置环境变量 `ZHIHU_ACCESS_SECRET`
3. ⏳ 测试搜索功能

### 完整方案（1-2 天）

1. ✅ 知乎 API（已完成）
2. ⏳ 微博 API（申请开发者账号）
3. ⏳ 小红书（研究签名算法或使用第三方库）

---

## 💡 使用建议

### 知乎 API

**适用场景**：
- 专业领域内容（科技、汽车、数码等）
- 深度分析文章
- 高质量问答

**搜索技巧**：
- 使用具体关键词（如"奥迪 Q5L 保养"而非"汽车"）
- 限制结果数量（5-10 条最佳）
- 结合 AI 改写生成原创内容

### 小红书

**适用场景**：
- 生活方式分享
- 产品评测
- 图片丰富的内容

**注意事项**：
- Cookie 需要定期更新
- 建议实现多个账号轮换
- 图片注意版权和去水印

### 微博

**适用场景**：
- 热点事件
- 实时话题
- 明星/KOL 动态

---

## 🔒 安全注意事项

1. **Token 保管**
   - 不要提交到版本控制
   - 使用环境变量或加密存储
   - 定期更新 Token

2. **频率控制**
   - 遵守平台 API 限制
   - 实现请求限流
   - 避免被封 IP

3. **数据使用**
   - 遵守平台使用协议
   - 注明内容来源
   - 不用于违法用途

---

## 📚 相关文档

- [多平台搜索架构](./MULTI_PLATFORM_ARCHITECTURE.md)
- [搜索功能实现状态](./SEARCH_IMPLEMENTATION_STATUS.md)
- [服务端搜索实施报告](./SERVER_SIDE_SEARCH_IMPLEMENTATION.md)

---

## 📞 问题反馈

如有问题或建议，请联系开发团队或提交 Issue。

**文档更新时间**: 2026-06-28  
**状态**: 知乎 API 已验证可用 ✅
