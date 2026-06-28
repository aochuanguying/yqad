# 小红书搜索配置指南

本文档详细说明如何配置和使用小红书搜索功能。

## 📋 目录

- [功能概述](#功能概述)
- [技术原理](#技术原理)
- [获取 Cookie](#获取-cookie)
- [配置步骤](#配置步骤)
- [测试验证](#测试验证)
- [常见问题](#常见问题)

---

## 功能概述

小红书搜索功能允许你：

- ✅ 搜索小红书笔记内容
- ✅ 获取笔记标题、描述、作者信息
- ✅ 获取互动数据（点赞、收藏、评论）
- ✅ 支持关键词搜索
- ✅ 免费使用，无需企业资质

### 与知乎 API 对比

| 特性 | 知乎 | 小红书 |
|------|------|--------|
| API 类型 | 官方开放 API | Web API（逆向） |
| 认证方式 | Bearer Token | Cookie |
| 费用 | 免费 1000 次/天 | 完全免费 |
| 稳定性 | 高 | 中（依赖 Cookie 有效性） |
| 企业资质 | 不需要 | 不需要 |

---

## 技术原理

### xhs Python 库

我们使用开源的 [`xhs`](https://github.com/ReaJason/xhs) Python 库来实现小红书搜索：

- **GitHub**: https://github.com/ReaJason/xhs
- **功能**: 基于小红书 Web 端的请求封装
- **核心**: 逆向工程实现了 x-s 签名算法

### 签名算法

小红书使用 `x-s` 和 `x-t` 请求头进行签名验证：

- `x-t`: 毫秒级时间戳
- `x-s`: 基于时间戳、请求路径、参数的签名值
- `x-s-common`: 公共签名信息

xhs 库通过逆向小红书 Web 端 JavaScript 代码，在 Python 中完整复现了签名算法。

### 架构设计

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Node.js    │ ───> │ Python xhs   │ ───> │ 小红书 API  │
│  主应用     │ <─── │  子进程调用  │ <─── │             │
└─────────────┘      └──────────────┘      └─────────────┘
```

---

## 获取 Cookie

### 步骤 1：登录小红书

1. 打开浏览器（推荐 Chrome 或 Edge）
2. 访问 [小红书网页版](https://www.xiaohongshu.com)
3. 使用小红书 APP 扫码登录

### 步骤 2：打开开发者工具

1. 按 `F12` 打开开发者工具
2. 切换到 **Network（网络）** 标签
3. 勾选 **Preserve log（保留日志）**

### 步骤 3：获取 Cookie

1. 刷新页面（`F5` 或 `Ctrl+R`）
2. 在左侧请求列表中找到任意请求（如 `explore` 或 `api` 开头的请求）
3. 点击该请求
4. 在右侧 **Headers（请求头）** 标签中找到 `Cookie` 字段
5. 复制整个 Cookie 值

**Cookie 示例：**
```
web_session=abcdef1234567890; a1=xyz789abc123; ...
```

### 关键 Cookie 字段

确保 Cookie 包含以下关键字段：

- ✅ `web_session` - 会话标识（必需）
- ✅ `a1` - 设备指纹（用于签名）

---

## 配置步骤

### 方法 1：通过 Web 管理界面（推荐）

1. **访问管理界面**
   - 打开 YQAD Web 管理界面
   - 进入 **💬 论坛设置 → 🌐 网络发帖**

2. **配置小红书**
   - 找到 **小红书配置** 卡片
   - 粘贴 Cookie 到输入框
   - 勾选 **启用小红书搜索**

3. **测试连接**
   - 点击 **🔍 测试连接** 按钮
   - 等待测试结果
   - 如果成功，会显示返回的结果数量

4. **保存配置**
   - 点击 **💾 保存配置**
   - 系统会将配置保存到数据库

### 方法 2：直接修改数据库

```sql
UPDATE network_post_config 
SET 
  xiaohongshu_cookie = '你的 Cookie 值',
  xiaohongshu_enabled = 1
WHERE id = 1;
```

---

## 测试验证

### 使用 Python 测试脚本

我们提供了独立的测试脚本：

```bash
cd /Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000\ Workspace/yqad
python3 test_xiaohongshu.py
```

**运行效果：**
```
============================================================
小红书搜索测试工具
============================================================

请输入小红书 Cookie（从浏览器开发者工具复制）：
提示：Cookie 应该包含 web_session 和 a1 字段

Cookie: web_session=abcdef...; a1=xyz789...

正在搜索：奥迪
最大结果数：10
------------------------------------------------------------
✅ 搜索成功！找到 10 条结果

1. 奥迪 Q5L 真实用车体验
   作者：汽车达人
   描述：买了奥迪 Q5L 半年了，分享一下真实感受...
   互动：❤️ 1234  ⭐ 567  💬 89
   链接：https://www.xiaohongshu.com/explore/65abc123...

2. 奥迪 A4L vs 宝马 3 系
   作者：选车顾问
   描述：两款车详细对比，帮你做出最佳选择...
   互动：❤️ 2345  ⭐ 890  💬 123
   链接：https://www.xiaohongshu.com/explore/65def456...

...

============================================================
测试完成！
============================================================
```

### 使用 API 测试

```bash
curl -X POST http://localhost:3000/api/network-post-config/test-xiaohongshu \
  -H "Content-Type: application/json" \
  -d '{"cookie": "你的 Cookie 值"}'
```

**成功响应：**
```json
{
  "success": true,
  "message": "小红书 API 连接测试成功",
  "resultCount": 5
}
```

---

## 常见问题

### Q1: Cookie 有效期多久？

**A:** Cookie 有效期不固定，通常几天到几周不等。当 Cookie 失效时：
- 搜索会返回错误或空结果
- 需要重新登录并获取新的 Cookie

### Q2: 为什么搜索结果为空？

**A:** 可能的原因：
1. **Cookie 失效** - 重新获取 Cookie
2. **关键词无结果** - 尝试其他关键词
3. **网络问题** - 检查网络连接
4. **账号被限制** - 减少请求频率

### Q3: 可以使用多个账号的 Cookie 吗？

**A:** 当前版本只支持一个 Cookie。如果需要多账号轮询，可以：
- 修改代码实现 Cookie 池
- 定期手动切换 Cookie

### Q4: 搜索频率有限制吗？

**A:** 虽然没有官方限制，但建议：
- 避免短时间内大量搜索（如每秒多次）
- 建议间隔 1-2 秒
- 长时间高频使用可能导致 Cookie 失效

### Q5: Cookie 安全吗？会被盗号吗？

**A:** Cookie 包含登录态信息，有一定风险：
- ✅ 只在自己电脑使用
- ✅ 不要分享给他人
- ✅ 定期更换 Cookie
- ⚠️ 不要使用重要账号的 Cookie

### Q6: 为什么使用 Python 子进程而不是直接集成？

**A:** 原因：
1. **xhs 是 Python 库** - 无法在 Node.js 中直接调用
2. **隔离性好** - Python 进程崩溃不影响主应用
3. **易于维护** - xhs 库更新时无需修改主应用

---

## 代码示例

### 在发帖系统中使用

```typescript
import { XiaohongshuSearch } from './services/internet-search/xiaohongshu-search';

// 从数据库获取 Cookie
const cookie = await getCookieFromDatabase();

// 创建搜索实例
const xiaohongshu = new XiaohongshuSearch(cookie);

// 执行搜索
const results = await xiaohongshu.search(['奥迪', 'Q5L'], 10);

// 处理结果
results.forEach(result => {
  console.log(`标题：${result.title}`);
  console.log(`作者：${result.author}`);
  console.log(`点赞：${result.likes}`);
  console.log(`链接：${result.url}`);
});
```

---

## 相关文档

- [网络发帖配置总览](./NETWORK_POST_CONFIG_SETUP.md)
- [知乎搜索配置](./ZHIHU_API_SETUP.md)
- [免费搜索平台对比](./FREE_SEARCH_PLATFORMS.md)

---

## 技术支持

遇到问题可以：

1. 查看 [xhs 库的 GitHub Issues](https://github.com/ReaJason/xhs/issues)
2. 检查 Cookie 是否有效
3. 查看应用日志获取详细错误信息

---

**最后更新**: 2026-06-28
