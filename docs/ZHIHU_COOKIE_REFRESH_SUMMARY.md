# 知乎 Cookie 自动刷新功能 - 实施总结

## 📊 实施概览

**实施时间**: 2026-06-30  
**参考方案**: 小红书 Cookie 自动刷新  
**状态**: ✅ 已完成  

## 🎯 实施内容

### 1. Python 自动刷新脚本 ✅

**文件**: `scripts/auto_refresh_zhihu_cookie.py`

**功能**:
- ✅ 使用 Playwright 打开浏览器
- ✅ 持久化用户数据目录 (`zhihu_browser_data/`)
- ✅ 自动检测登录状态
- ✅ 提取关键 Cookie (_xsrf, _zap, z_c0, __zse_ck)
- ✅ 保存到数据库

**使用方法**:
```bash
python3 scripts/auto_refresh_zhihu_cookie.py
```

### 2. TypeScript Cookie 扫码服务 ✅

**文件**: `src/services/cookie-refresh/zhihu-cookie-scanner.ts`

**功能**:
- ✅ CookieScanner 类（单例模式）
- ✅ 状态更新回调接口
- ✅ 异步刷新 Cookie
- ✅ 反检测脚本注入
- ✅ 登录状态检测

**核心方法**:
```typescript
const scanner = ZhihuCookieScanner.getInstance();
const result = await scanner.refreshCookie();
```

### 3. API 路由接口 ✅

**文件**: `src/web/routes/network-post-routes.ts`

**新增接口**:
- `POST /api/network-post-config/zhihu/refresh` - 刷新 Cookie（异步）
- `GET /api/network-post-config/zhihu/status/:taskId` - 查询任务状态

**使用示例**:
```bash
# 触发刷新
curl -X POST http://localhost:3000/api/network-post-config/zhihu/refresh

# 查询状态
curl http://localhost:3000/api/network-post-config/zhihu/status/zhihu_refresh_1719734400000
```

### 4. 测试脚本 ✅

**文件**: `scripts/test-zhihu-cookie-refresh.ts`

**功能**:
- ✅ 完整的测试流程
- ✅ 实时状态输出
- ✅ 错误处理和日志

**使用方法**:
```bash
npx tsx scripts/test-zhihu-cookie-refresh.ts
```

### 5. 文档 ✅

**文件**:
- ✅ `ZHIHU_COOKIE_AUTO_REFRESH.md` - 完整功能文档
- ✅ `ZHIHU_COOKIE_REFRESH_SCHEDULER_INTEGRATION.md` - 调度器集成方案
- ✅ `ZHIHU_COOKIE_REFRESH_SUMMARY.md` - 本文档

## 📁 文件清单

### 新增文件

| 文件路径 | 说明 | 行数 |
|---------|------|------|
| `scripts/auto_refresh_zhihu_cookie.py` | Python 自动刷新脚本 | 261 |
| `scripts/test-zhihu-cookie-refresh.ts` | TypeScript 测试脚本 | 54 |
| `src/services/cookie-refresh/zhihu-cookie-scanner.ts` | Cookie 扫码服务 | 257 |
| `docs/ZHIHU_COOKIE_AUTO_REFRESH.md` | 功能文档 | 270+ |
| `docs/ZHIHU_COOKIE_REFRESH_SCHEDULER_INTEGRATION.md` | 调度器集成文档 | 269 |
| `docs/ZHIHU_COOKIE_REFRESH_SUMMARY.md` | 实施总结 | 本文档 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/web/routes/network-post-routes.ts` | 添加知乎 Cookie 刷新 API 接口 |

## 🔧 技术实现

### 核心流程

```
┌─────────────────┐
│  触发刷新        │
│  (脚本/API)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  打开浏览器      │
│  (持久化数据)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  访问登录页面    │
└────────┬────────┘
         │
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
└─────────────────┘
```

### 关键技术点

1. **持久化浏览器用户数据**
   ```typescript
   const userDataDir = path.join(__dirname, '../../../scripts/zhihu_browser_data');
   const browser = await chromium.launchPersistentContext(userDataDir, {...});
   ```

2. **反检测脚本注入**
   ```typescript
   await this.page.addInitScript(() => {
     Object.defineProperty(navigator, 'webdriver', {
       get: () => undefined,
     });
   });
   ```

3. **登录状态检测**
   ```typescript
   const hasXsrf = cookieDict['_xsrf'] && cookieDict['_xsrf'].length > 10;
   const hasZap = cookieDict['_zap'] && cookieDict['_zap'].length > 10;
   const hasZC0 = cookieDict['z_c0'];
   
   if (hasXsrf && hasZap && hasZC0) {
     // 登录成功
   }
   ```

4. **Cookie 过滤和提取**
   ```typescript
   const zhihuCookies = allCookies.filter((c) => 
     c.name.startsWith('_') || 
     ['z_c0', '__zse_ck', 'captcha_session_v2', 'captcha_ticket_v2'].includes(c.name)
   );
   ```

## 📊 对比小红书方案

| 特性 | 小红书 | 知乎 |
|------|--------|------|
| 持久化用户数据 | ✅ | ✅ |
| 反检测脚本 | ✅ | ✅ |
| 自动登录检测 | ✅ | ✅ |
| Cookie 关键字段 | a1, web_session, id_token | _xsrf, _zap, z_c0 |
| 登录方式 | 扫码 | 扫码/账号密码 |
| 超时时间 | 300 秒 | 300 秒 |
| 浏览器目录 | xiaohongshu_browser_data | zhihu_browser_data |

## 🚀 使用方法

### 手动刷新

```bash
# 方法 1: Python 脚本（推荐）
python3 scripts/auto_refresh_zhihu_cookie.py

# 方法 2: TypeScript 测试
npx tsx scripts/test-zhihu-cookie-refresh.ts

# 方法 3: API 接口
curl -X POST http://localhost:3000/api/network-post-config/zhihu/refresh
```

### 定时刷新

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点刷新
0 2 * * * python3 /Users/mac/Documents/workspace/krio/yqad/scripts/auto_refresh_zhihu_cookie.py

# 每 12 小时刷新
0 */12 * * * python3 /Users/mac/Documents/workspace/krio/yqad/scripts/auto_refresh_zhihu_cookie.py
```

### 查看状态

```bash
# 查看数据库
mysql -u root -p -e "SELECT zhihu_cookie, updated_at FROM network_post_config WHERE id=1;"

# 查看日志
tail -n 50 /var/log/zhihu_cookie_refresh.log
```

## ⚠️ 注意事项

### Cookie 有效期

- 知乎 Cookie 通常在 1-2 周内有效
- 建议每 7 天刷新一次
- 发现安全验证时应立即刷新

### 浏览器用户数据

- 数据目录：`scripts/zhihu_browser_data/`
- 包含登录状态，不要随意删除
- 首次使用需要扫码登录
- 后续使用自动保持登录

### 依赖安装

```bash
# Python 依赖
pip install playwright mysql-connector-python
playwright install chromium

# Node.js 依赖（项目中已包含）
npm install playwright mysql2
```

## 🔍 故障排查

### 常见问题

1. **浏览器无法打开**
   ```bash
   playwright install chromium
   ```

2. **登录成功后仍提示未登录**
   - 检查 Cookie 关键字段是否完整
   - 删除 `zhihu_browser_data` 重新登录

3. **Cookie 保存失败**
   - 检查数据库连接
   - 确认表结构包含 `zhihu_cookie` 字段

## 📈 后续优化

### 短期（1-2 周）

- [ ] 添加前端刷新按钮
- [ ] 实现 Cookie 过期提醒
- [ ] 添加刷新历史记录

### 中期（1 个月）

- [ ] 集��到统一调度器
- [ ] 实现多账号 Cookie 池
- [ ] 添加刷新成功率统计

### 长期（3 个月）

- [ ] 探索知乎 API v4
- [ ] 实现更智能的刷新策略
- [ ] 添加异常检测和告警

## 📚 相关文档

- [知乎 Cookie 配置实施文档](ZHIHU_COOKIE_CONFIG_SETUP.md)
- [知乎 Cookie 自动刷新功能](ZHIHU_COOKIE_AUTO_REFRESH.md)
- [调度器集成方案](ZHIHU_COOKIE_REFRESH_SCHEDULER_INTEGRATION.md)
- [小红书 Cookie 自动刷新方案](小红书 Cookie 自动刷新方案.md)

---

**实施完成时间**: 2026-06-30  
**状态**: ✅ 已完成  
**下一步**: 测试验证并部署到生产环境
