# 知乎 Cookie 配置实施文档

## 实施时间
2026-06-30

## 背景
之前知乎搜索仅使用 Access Secret 调用官方 API，但 API 返回的 `ContentText` 字段只有纯文本，不包含图片。为了获取正文和图片详情，需要使用 Playwright 访问知乎公开页面。而 Playwright 需要 Cookie 来绕过知乎的安全验证。

## 实施内容

### 1. 数据库迁移 ✅

**文件**: `src/db/migrations/033_add_zhihu_cookie_field.sql`

**变更**:
```sql
ALTER TABLE `network_post_config`
ADD COLUMN `zhihu_cookie` TEXT COMMENT '知乎 Cookie（用于 Playwright 访问公开页面）'
AFTER `zhihu_enabled`;
```

**说明**:
- 添加 `zhihu_cookie` TEXT 字段存储 Cookie
- 已有记录自动初始化为空字符串

### 2. 存储层更新 ✅

**文件**: `src/storage/mysql/network-post-config-storage.ts`

**变更**:
```typescript
export interface NetworkPostConfig {
  // 知乎配置
  zhihuAccessSecret?: string;
  zhihuCookie?: string; // 新增：知乎 Cookie（用于 Playwright）
  zhihuEnabled: boolean;
  // ...
}

// getConfig() 方法
const config = {
  zhihuAccessSecret: row.zhihu_access_secret || '',
  zhihuCookie: row.zhihu_cookie || '', // 新增
  // ...
};

// saveConfig() 方法
await this.conn.execute(
  `INSERT INTO network_post_config (
    id, zhihu_access_secret, zhihu_cookie, zhihu_enabled, 
    // ...
  ) VALUES (
    1, ?, ?, ?, ...
  ) ON DUPLICATE KEY UPDATE
    zhihu_access_secret = VALUES(zhihu_access_secret),
    zhihu_cookie = VALUES(zhihu_cookie), // 新增
    // ...
  `,
  [
    config.zhihuAccessSecret || '',
    config.zhihuCookie || '', // 新增
    // ...
  ]
);
```

### 3. 配置页面更新 ✅

**文件**: `src/web/public/index.html`

**变更**:
1. 修改标题：从"知乎 API 配置"改为"知乎配置"
2. 添加 Cookie 输入框（textarea）
3. 添加 Cookie 获取教程（可折叠）
4. 更新状态提示逻辑

**新增功能**:
- Cookie 输入框：支持多行输入，等宽字体
- 详细教程：F12 抓包获取 Cookie 的步骤说明
- 状态提示：
  - ✅ 已配置 Access Secret 和 Cookie，功能完整可用
  - ⚠️ 已配置 Access Secret，建议配置 Cookie 以获取正文和图片
  - ℹ️ 已配置 Cookie，可访问公开页面但未配置 API
  - ❌ 未配置任何凭证

**Cookie 获取教程**:
```
📝 如何获取知乎 Cookie
1. 打开浏览器（推荐 Chrome 或 Edge）
2. 访问 https://www.zhihu.com 并登录账号
3. 按 F12 打开开发者工具
4. 切换到 Network（网络）标签，勾选 Preserve log（保留日志）
5. 刷新页面（F5）
6. 在左侧请求列表中找到任意请求（如 zhihu.com 开头的）
7. 点击该请求 → 右侧 Headers（请求头）标签 → 找到 Cookie 字段
8. 复制整个 Cookie 值并粘贴到上方输入框

关键字段检查：
✅ _xsrf - 跨站请求伪造保护
✅ _zap - 用户会话标识
✅ z_c0 - 登录凭证
✅ __zse_ck - 安全验证参数

⚠️ 注意：Cookie 会过期，请定期检查并更新。建议每 1-2 周更新一次。
```

### 4. API 路由更新 ✅

**文件**: `src/web/routes/network-post-routes.ts`

**变更**:
```typescript
// 默认配置
const defaultConfig: NetworkPostConfig = {
  zhihuAccessSecret: '',
  zhihuCookie: '', // 新增
  zhihuEnabled: false,
  // ...
};

// 保存配置
const config: NetworkPostConfig = {
  zhihuAccessSecret: req.body.zhihuAccessSecret || '',
  zhihuCookie: req.body.zhihuCookie || '', // 新增
  // ...
};
```

### 5. 搜索服务更新 ✅

**文件**: `src/services/internet-search/zhihu-search.ts`

**核心变更**:

1. **新增配置加载函数**:
```typescript
let cachedConfig: {
  accessSecret: string;
  cookie: string;
  timestamp: number;
} | null = null;

async function loadZhihuConfig(): Promise<{ accessSecret: string; cookie: string } | null> {
  const now = Date.now();
  
  // 检查缓存是否有效（5 分钟内）
  if (cachedConfig && (now - cachedConfig.timestamp) < 5 * 60 * 1000) {
    logger.debug('使用缓存的知乎配置');
    return {
      accessSecret: cachedConfig.accessSecret,
      cookie: cachedConfig.cookie,
    };
  }
  
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const config = await storage.getConfig();
    
    if (!config) {
      logger.warn('未找到网络发帖配置');
      return null;
    }
    
    // 更新缓存
    cachedConfig = {
      accessSecret: config.zhihuAccessSecret || '',
      cookie: config.zhihuCookie || '',
      timestamp: now,
    };
    
    logger.info(`知乎配置已加载：Access Secret=${config.zhihuAccessSecret ? '已配置' : '未配置'}, Cookie=${config.zhihuCookie ? '已配置' : '未配置'}`);
    
    return {
      accessSecret: config.zhihuAccessSecret || '',
      cookie: config.zhihuCookie || '',
    };
  } catch (error) {
    logger.error('加载知乎配置失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

2. **更新 search() 方法**:
```typescript
async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
  try {
    logger.info(`开始搜索知乎，关键词：${keywords.join(', ')}, 最大结果数：${maxResults}`);
    
    // 从数据库加载配置
    const config = await loadZhihuConfig();
    
    if (!config || !config.accessSecret) {
      logger.warn('知乎 Access Secret 未配置，跳过搜索');
      return [];
    }
    
    // 设置环境变量（供 Python 脚本使用）
    process.env.ZHIHU_ACCESS_SECRET = config.accessSecret;
    if (config.cookie) {
      process.env.ZHIHU_COOKIE = config.cookie;
      logger.info('知乎 Cookie 已设置（用于 Playwright 绕过安全验证）');
    } else {
      logger.warn('知乎 Cookie 未配置，Playwright 可能遇到安全验证');
    }
    
    // 使用知乎官方 API + Playwright 正文提取
    const results = await this.searchViaApiWithContent(keywords, maxResults, config.accessSecret, config.cookie);
    return results;
    
  } catch (error) {
    logger.error('知乎搜索失败:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
```

3. **更新 searchViaApiWithContent() 方法签名**:
```typescript
private async searchViaApiWithContent(
  keywords: string[], 
  maxResults: number,
  accessSecret: string,
  cookie: string  // 新增参数
): Promise<SearchResult[]>
```

## 使用流程

### Step 1: 应用数据库迁移

```bash
# 方法 A：使用 Node.js 脚本
npx tsx scripts/apply-migration-033.ts

# 方法 B：手动执行 SQL
mysql -u root -p yqad_prod_db < src/db/migrations/033_add_zhihu_cookie_field.sql
```

### Step 2: 配置知乎 Cookie

1. 访问 Web 管理界面
2. 进入 **💬 论坛设置 → 🌐 网络发帖**
3. 在 **📚 知乎配置** 部分：
   - 填写 **Access Secret**（已有则保留）
   - 填写 **Cookie**（新增）
   - 勾选 **启用知乎搜索**
4. 点击 **💾 保存配置**

### Step 3: 测试配置

1. 点击 **🔌 测试连接** 按钮
2. 查看测试结果：
   - ✅ 测试成功！找到 X 条结果
   - ❌ 测试失败：错误信息

### Step 4: 使用搜索功能

配置完成后，系统会自动从数据库读取 Access Secret 和 Cookie，无需手动设置环境变量。

```typescript
import { InternetSearchManager } from './services/internet-search';

const searchManager = new InternetSearchManager();
const results = await searchManager.search(['奥迪 Q5L'], 5);

// 如果轮询到知乎平台，会自动：
// 1. 从数据库读取 Access Secret 和 Cookie
// 2. 调用知乎 API 获取搜索结果
// 3. 使用 Playwright 提取正文和图片
// 4. 返回包含图文详情的结果
```

## 技术架构

### 数据流

```
┌─────────────────┐
│  用户配置 Cookie  │
│  (Web 管理界面)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  network_post_  │
│  config 表       │
│  zhihu_cookie   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ZhihuSearch    │
│  loadZhihuConfig│
│  (5 分钟缓存)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  设置环境变量    │
│  ZHIHU_COOKIE   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Python 脚本     │
│  (Playwright)   │
│  使用 Cookie     │
│  绕过安全验证    │
└─────────────────┘
```

### 缓存机制

- **缓存时间**: 5 分钟
- **缓存内容**: Access Secret + Cookie
- **目的**: 避免频繁查询数据库
- **自动刷新**: 5 分钟后自动重新加载

### Cookie 作用

1. **绕过安全验证**: 防止 Playwright 被识别为自动化测试
2. **访问公开页面**: 无需登录即可获取正文和图片
3. **降低风险**: 使用 Cookie 比频繁登录更安全

## 注意事项

### Cookie 有效期

- Cookie 会过期，建议每 1-2 周更新一次
- 如果发现 Playwright 遇到安全验证页面，应立即更新 Cookie
- 可在配置页面查看 Cookie 状态

### 安全建议

1. **定期更新**: 每 1-2 周更新一次 Cookie
2. **账号安全**: 使用专用账号，避免主账号
3. **频率控制**: 合理使用搜索功能，避免触发风控
4. **隐私保护**: 不要在公开场合分享 Cookie

### 故障排查

**Q: Playwright 仍然遇到安全验证？**
- A: Cookie 可能已过期，请重新获取并配置

**Q: 配置页面加载失败？**
- A: 检查数据库迁移是否成功执行

**Q: 搜索结果为空？**
- A: 检查 Access Secret 和 Cookie 是否都正确配置

## 测试结果

### 测试场景
- 关键词：奥迪 Q5L
- 最大结果数：5

### 预期结果
- ✅ 成功从数据库读取 Access Secret 和 Cookie
- ✅ 成功调用知乎 API 获取搜索结果
- ✅ 成功使用 Playwright 提取正文和图片
- ✅ 返回包含图文详情的结果

### 实际测试（待验证）
```bash
# 运行测试脚本
npx tsx scripts/test-zhihu-complete-flow.ts
```

## 相关文件

### 修改的文件
- `src/db/migrations/033_add_zhihu_cookie_field.sql` - 数据库迁移
- `src/storage/mysql/network-post-config-storage.ts` - 存储层
- `src/web/public/index.html` - 配置页面
- `src/web/routes/network-post-routes.ts` - API 路由
- `src/services/internet-search/zhihu-search.ts` - 搜索服务

### 新增的文件
- `scripts/apply-migration-033.ts` - 迁移脚本
- `docs/ZHIHU_COOKIE_CONFIG_SETUP.md` - 本文档

## 后续优化

### 短期（1-2 周）
- [ ] 添加 Cookie 过期检测
- [ ] 添加 Cookie 自动刷新功能（参考小红书）
- [ ] 添加 Cookie 版本管理

### 中期（1 个月）
- [ ] 添加 Cookie 健康监控
- [ ] 实现多账号 Cookie 池
- [ ] 优化 Cookie 刷新策略

### 长期（3 个月）
- [ ] 探索知乎 API v4（如果开放）
- [ ] 实现更智能的内容提取策略
- [ ] 添加内容质量评分

---

**文档更新时间**: 2026-06-30  
**状态**: ✅ 已完成  
**下一步**: 测试配置页面和搜索功能
