# 网络发帖配置实施文档

## 实施时间
2026-06-28

## 实施内容

### 1. 新增"网络发帖"子菜单 ✅

**位置**：论坛设置 → 网络发帖

**文件**：`src/web/public/index.html`

**修改内容**：
- 在论坛设置左侧子菜单中添加"🌐 网络发帖"选项
- 实现 `renderNetworkPostConfig()` 函数
- 实现配置加载、保存和测试连接功能

---

### 2. 创建配置存储模块 ✅

**文件**：`src/storage/mysql/network-post-config-storage.ts`

**功能**：
- 管理互联网搜索平台配置（知乎、小红书、微博等）
- 提供配置加载和保存方法
- 实现知乎 API 连接测试功能

**配置项**：
```typescript
interface NetworkPostConfig {
  // 知乎配置
  zhihuAccessSecret?: string;
  zhihuEnabled: boolean;
  
  // 小红书配置（预留）
  xiaohongshuCookie?: string;
  xiaohongshuEnabled: boolean;
  
  // 微博配置（预留）
  weiboAccessToken?: string;
  weiboEnabled: boolean;
  
  // 通用配置
  maxResults: number;
  enabled: boolean;
}
```

---

### 3. 创建数据库迁移 ✅

**文件**：`src/db/migrations/030_create_network_post_config_table.sql`

**表结构**：
```sql
CREATE TABLE `network_post_config` (
  `id` INT PRIMARY KEY DEFAULT 1,
  `zhihu_access_secret` VARCHAR(255) DEFAULT '' COMMENT '知乎 Access Secret',
  `zhihu_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用知乎',
  `xiaohongshu_cookie` TEXT DEFAULT '' COMMENT '小红书 Cookie',
  `xiaohongshu_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用小红书',
  `weibo_access_token` VARCHAR(255) DEFAULT '' COMMENT '微博 Access Token',
  `weibo_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用微博',
  `max_results` INT DEFAULT 10 COMMENT '最大搜索结果数',
  `enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用网络发帖功能',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 4. 创建 API 路由 ✅

**文件**：`src/web/routes/network-post-routes.ts`

**接口**：
1. `GET /api/network-post-config` - 获取配置
2. `POST /api/network-post-config` - 保存配置
3. `POST /api/network-post-config/test-zhihu` - 测试知乎连接

---

### 5. 注册路由 ✅

**文件**：`src/web/server.ts`

**修改**：
```typescript
const networkPostRoutes = require('./routes/network-post-routes').default;
app.use('/api', authMiddleware, networkPostRoutes);
```

---

## 使用指南

### Step 1: 运行数据库迁移

```bash
# 连接到 MySQL
mysql -u root -p

# 执行迁移脚本
source src/db/migrations/030_create_network_post_config_table.sql;

# 验证表创建
DESCRIBE network_post_config;
```

### Step 2: 重启服务

```bash
# 停止服务
npm run stop

# 启动服务
npm run start
```

### Step 3: 配置知乎 API

1. 访问 Web 管理界面
2. 进入 **💬 论坛设置 → 🌐 网络发帖**
3. 填写 **知乎 Access Secret**
4. 勾选 **启用知乎搜索**
5. 点击 **🔌 测试连接** 验证
6. 点击 **💾 保存配置**

---

## 配置页面功能

### 知乎 API 配置

**字段**：
- **Access Secret**：知乎开放平台提供的访问令牌
- **启用知乎搜索**：是否启用知乎搜索功能
- **测试连接**：验证 Access Secret 是否有效
- **状态显示**：当前配置状态

**测试连接**：
- 调用知乎 API 搜索"测试"关键词
- 返回找到的结果数量
- 成功：✅ 测试成功！找到 X 条结果
- 失败：❌ 测试失败：错误信息

### 小红书配置（待实现）

**状态**：功能开发中

**需要**：
- 实现小红书 Cookie 获取
- 实现签名算法

### 微博配置（待实现）

**状态**：功能开发中

**需要**：
- 申请微博开发者账号
- 获取 OAuth Access Token

---

## 代码示例

### 获取配置

```typescript
import { NetworkPostConfigStorage } from './storage/mysql/network-post-config-storage';
import { getDb } from './db/mysql';

const db = getDb();
const storage = NetworkPostConfigStorage.getInstance(db);
const config = await storage.getConfig();

console.log(config);
// 输出：
// {
//   zhihuAccessSecret: '11d78a6c28453c03f047552bc588d03ad227db52',
//   zhihuEnabled: true,
//   xiaohongshuCookie: '',
//   xiaohongshuEnabled: false,
//   weiboAccessToken: '',
//   weiboEnabled: false,
//   maxResults: 10,
//   enabled: true
// }
```

### 保存配置

```typescript
const config: NetworkPostConfig = {
  zhihuAccessSecret: 'your_access_secret',
  zhihuEnabled: true,
  xiaohongshuCookie: '',
  xiaohongshuEnabled: false,
  weiboAccessToken: '',
  weiboEnabled: false,
  maxResults: 10,
  enabled: true,
};

const success = await storage.saveConfig(config);
console.log(success); // true
```

### 测试知乎连接

```typescript
const result = await storage.testZhihuConnection('your_access_secret');

if (result.success) {
  console.log(`✅ 测试成功！找到 ${result.resultCount} 条结果`);
} else {
  console.log(`❌ 测试失败：${result.error}`);
}
```

---

## 集成到发帖系统

### 在 auto-post.ts 中使用

```typescript
import { NetworkPostConfigStorage } from './storage/mysql/network-post-config-storage';
import { InternetSearchManager } from './services/internet-search';

// 获取配置
const db = getDb();
const configStorage = NetworkPostConfigStorage.getInstance(db);
const config = await configStorage.getConfig();

// 检查是否启用网络发帖
if (!config?.enabled) {
  logger.info('网络发帖功能未启用');
  return;
}

// 使用搜索管理器查询
const searchManager = new InternetSearchManager();

// 如果启用了知乎，添加知乎搜索服务
if (config.zhihuEnabled && config.zhihuAccessSecret) {
  // 知乎搜索服务会自动使用配置的 Access Secret
  const results = await searchManager.search(['奥迪 Q5L'], config.maxResults);
  
  // 处理搜索结果
  for (const result of results) {
    logger.info(`[${result.source}] ${result.title}`);
  }
}
```

---

## 安全注意事项

### 1. Token 保护

- ✅ 使用环境变量或数据库加密存储
- ✅ 不要提交到版本控制
- ✅ 定期更新 Token

### 2. 频率控制

- 知乎 API：每天免费 1000 次
- 建议实现请求限流
- 避免触发 API 频率限制

### 3. 内容使用

- ✅ 遵守平台使用协议
- ✅ 注明内容来源
- ⚠️ 不要直接复制粘贴（版权问题）
- ✅ 建议结合 AI 改写生成原创内容

---

## 故障排查

### Q: 配置页面加载失败？

**A**: 
1. 检查数据库表是否创建
2. 查看浏览器控制台错误
3. 检查 API 路由是否正确注册

### Q: 测试连接失败？

**A**:
1. 检查 Access Secret 是否正确
2. 检查网络连接
3. 查看服务器日志中的详细错误

### Q: 配置保存失败？

**A**:
1. 检查数据库连接
2. 查看 `network_post_config` 表是否存在
3. 检查权限是否足够

---

## 后续优化

### 短期（1-2 周）

- [ ] 实现小红书搜索配置
- [ ] 实现微博搜索配置
- [ ] 添加配置加密存储
- [ ] 实现请求频率监控

### 中期（1 个月）

- [ ] 添加更多平台（豆瓣、B 站等）
- [ ] 实现智能平台选择
- [ ] 优化搜索结果质量
- [ ] 添加搜索结果缓存

### 长期（3 个月��

- [ ] 实现搜索结果 AI 评分
- [ ] 自动选择最佳素材
- [ ] 多平台内容对比分析
- [ ] 生成内容趋势报告

---

**文档更新时间**: 2026-06-28  
**状态**: ✅ 已完成（知乎配置）  
**下一步**: 运行数据库迁移并测试
