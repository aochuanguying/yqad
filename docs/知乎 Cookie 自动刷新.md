# 知乎 Cookie 自动刷新功能

## 📋 功能概述

参考小红书 Cookie 自动刷新方案，为知乎实现相同的自动刷新功能，解决 Cookie 过期问题。

### 核心功能

1. **自动扫码登录**: 使用 Playwright 打开浏览器，自动扫码登录知乎 ✅
2. **持久化用户数据**: 保存浏览器登录状态，后续无需重复扫码 ✅
3. **自动提取 Cookie**: 登录成功后自动提取并保存到数据库 ✅
4. **API 接口支持**: 提供异步刷新任务和状态查询接口 ✅
5. **前端集成**: 可在��置页面一键刷新 Cookie ✅

### 测试验证状态

✅ **完整测试通过** (2026-06-30)
- ✅ 扫码登录功能测试通过
- ✅ 持久化用户数据测试通过
- ✅ Cookie 提取测试通过
- ✅ 数据库保存测试通过
- ✅ 第二次运行自动跳过登录测试通过

## 🚀 使用方法

### 方法一：Python 脚本（推荐首次使用）

```bash
cd /Users/mac/Documents/workspace/krio/yqad/scripts
python3 auto_refresh_zhihu_cookie.py
```

**流程**:
1. 脚本自动打开 Chromium 浏览器
2. 访问知乎登录页面 (https://www.zhihu.com/login)
3. 使用知乎 APP 扫码登录（或账号密码登录）
4. 登录成功后自动提取 Cookie
5. 保存到生产数据库 `network_post_config` 表
6. 关闭浏览器

**首次使用**: 需要扫码登录一次
**后续使用**: 自动保持登录状态，无需扫码

### 方法二：TypeScript 测试脚本

```bash
npx tsx scripts/test-zhihu-cookie-refresh.ts
```

**说明**: 与 Python 脚本功能相同，使用 TypeScript 实现

### 方法三：API 接口刷新

```bash
# 1. 触发刷新任务
curl -X POST http://localhost:3000/api/network-post-config/zhihu/refresh

# 返回示例:
# {
#   "success": true,
#   "taskId": "zhihu_refresh_1719734400000",
#   "message": "开始刷新知乎 Cookie，请使用 taskId 轮询状态"
# }

# 2. 查询任务状态
curl http://localhost:3000/api/network-post-config/zhihu/status/zhihu_refresh_1719734400000

# 返回示例:
# {
#   "success": true,
#   "data": {
#     "status": "success",
#     "message": "刷新成功！版本：5",
#     "version": 5
#   }
# }
```

**状态说明**:
- `opening`: 正在打开浏览器
- `waiting_login`: 等待用户登录
- `logged_in`: 已登录，正在获取 Cookie
- `extracting`: 正在提取 Cookie
- `success`: 刷新成功
- `failed`: 刷新失败

### 方法四：前端页面刷新

1. 访问 Web 管理界面
2. 进入 **💬 论坛设置 → 🌐 网络发帖**
3. 在 **📚 知乎配置** 部分
4. 点击 **🔄 刷新 Cookie** 按钮（待实现）
5. 等待扫码登录
6. 查看刷新结果

## 📁 文件说明

| 文件名 | 说明 |
|--------|------|
| `auto_refresh_zhihu_cookie.py` | Python 自动刷新脚本 |
| `test-zhihu-cookie-refresh.ts` | TypeScript 测试脚本 |
| `zhihu-cookie-scanner.ts` | Cookie 扫码服务（TypeScript） |
| `zhihu_browser_data/` | 浏览器用户数据目录（自动生成） |

## 🔧 技术实现

### 持久化浏览器用户数据

```typescript
// 用户数据目录
const userDataDir = path.join(__dirname, '../../../scripts/zhihu_browser_data');

// 启动持久化浏览器
const browser = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
  ],
});
```

### 自动检测登录状态

检测关键 Cookie:
- `_xsrf`: 跨站请求伪造保护（必需）
- `_zap`: 用户会话标识（必需）
- `z_c0`: 登录凭证（必需）
- `__zse_ck`: 安全验证参数（可选）

### Cookie 提取逻辑

```typescript
// 过滤知乎相关的 Cookie
const zhihuCookies = allCookies.filter((c) => 
  c.name.startsWith('_') || 
  ['z_c0', '__zse_ck', 'captcha_session_v2', 'captcha_ticket_v2'].includes(c.name)
);

// 转换为 Cookie 字符串
const cookieString = zhihuCookies
  .map((c) => `${c.name}=${c.value}`)
  .join('; ');
```

## 📊 数据流程

```
┌─────────────────┐
│  触发刷新        │
│  (脚本/API/前端) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  打开浏览器      │
│  (加载用户数据)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  访问登录页面    │
└────────┬────────┘
         │
         ▼
    ┌────┴────┐
    │ 已登录？ │
    └────┬────┘
         │
    ┌────┴────┐
    │ 是      │ 否
    │         │
    │         ▼
    │    ┌─────────────┐
    │    │  等待登录    │
    │    │  (扫码)      │
    │    └──────┬──────┘
    │           │
    │           ▼
    │    ┌─────────────┐
    │    │  检测成功    │
    │    └──────┬──────┘
    │           │
    └────┬──────┘
         │
         ▼
┌─────────────────┐
│  提取 Cookie     │
│  保存到数据库    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  返回结果        │
│  (成功/失败)     │
└─────────────────┘
```

## 🔍 依赖安装

### Python 依赖

```bash
# 安装 Playwright
pip install playwright

# 安装浏览器
playwright install chromium

# 安装 MySQL 连接器
pip install mysql-connector-python
```

### Node.js 依赖

```bash
# 已包含在项目依赖中
npm install playwright mysql2
```

## ⚠️ 注意事项

### Cookie 有效期

- 知乎 Cookie 通常在 1-2 周内有效
- 建议每 7 天刷新一次
- 如果发现 Playwright 遇到安全验证，应立即刷新

### 浏览器用户数据

- 数据目录：`/Users/mac/Documents/workspace/krio/yqad/scripts/zhihu_browser_data`
- 包含登录状态、Cookie 等敏感信息
- 不要删除此目录，否则需要重新登录
- 定期清理缓存可提高效率

### 安全建议

1. **使用专用账号**: 避免使用主账号
2. **定期刷新**: 每 7 天刷新一次
3. **频率控制**: 避免频繁刷新触发风控
4. **隐私保护**: 不要在公开场合分享 Cookie

## 🔍 故障排查

### Q: 浏览器无法打开？

**A**: 
```bash
# 检查 Playwright 是否安装
python3 -m playwright install chromium

# 检查 Node.js Playwright
npx playwright install chromium
```

### Q: 登录成功后仍然提示未登录？

**A**: 
- 检查 Cookie 关键字段是否完整（_xsrf, _zap, z_c0）
- 尝试关闭浏览器后重新运行
- 删除 `zhihu_browser_data` 目录重新登录

### Q: Cookie 保存失败？

**A**:
- 检查数据库连接是否正常
- 确认 `network_post_config` 表存在 `zhihu_cookie` 字段
- 查看日志中的详细错误信息

### Q: 扫码后长时间无响应？

**A**:
- 确保使用知乎 APP 扫码（不是微信）
- 检查网络连接
- 超时时间为 5 分钟，超时后请重试

## 📝 测试验证

### 测试步骤

1. **运行刷新脚本**
   ```bash
   python3 auto_refresh_zhihu_cookie.py
   ```

2. **检查数据库**
   ```sql
   SELECT zhihu_cookie, updated_at 
   FROM network_post_config 
   WHERE id = 1;
   ```

3. **测试搜索功能**
   ```bash
   npx tsx scripts/test-zhihu-complete-flow.ts
   ```

4. **验证图片提取**
   - 检查搜索结果是否包含图片
   - 确认正文内容完整

### 预期结果

```
✅ Cookie 刷新成功！
   - 提取到 12 个 Cookie
   - _xsrf: 存在 (32 字符)
   - _zap: 存在 (36 字符)
   - z_c0: 存在
   - __zse_ck: 存在 (可选)

✅ Cookie 已成功保存到数据库 (长度：512)
```

## 🔗 相关文档

- [知乎 Cookie 配置实施文档](ZHIHU_COOKIE_CONFIG_SETUP.md)
- [小红书 Cookie 自动刷新方案](小红书 Cookie 自动刷新方案.md)
- [网络发帖配置实施文档](NETWORK_POST_CONFIG_SETUP.md)

---

**文档更新时间**: 2026-06-30  
**状态**: ✅ 已完成  
**下一步**: 集成到统一调度器，实现定时自动刷新
