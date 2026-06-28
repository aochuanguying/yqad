# 汽车之家配置页面实现文档

## 实现概述

已完成汽车之家配置页面的前端实现，包括配置表单、Cookie 获取教程、测试连接功能。

## 修改的文件

### 1. 前端页面 (`src/web/public/index.html`)

#### 新增内容

1. **汽车之家配置卡片**（第 5931-6008 行）
   - Cookie 输入框（多行文本域，4 行）
   - F12 抓包指南（默认隐藏，点击展开）
   - 启用开关复选框
   - 状态显示区域
   - 测试连接按钮

2. **切换教程函数** `toggleAutohomeGuide()`（第 6057-6065 行）
   - 控制汽车之家抓包指南的显示/隐藏

3. **测试连接函数** `testAutohomeConnection()`（第 6105-6133 行）
   - 调用后端 API `/api/network-post-config/test-autohome`
   - 显示测试结果和找到的结果数量

4. **保存配置更新**（第 1431-1432 行）
   - 在 `saveConfig()` 函数中添加 `autohomeCookie` 和 `autohomeEnabled` 字段

#### 配置字段

```javascript
{
  autohomeCookie: string,      // 汽车之家 Cookie
  autohomeEnabled: boolean,    // 是否启用汽车之家搜索
}
```

## 功能特性

### 1. Cookie 获取教程

提供详细的 F12 抓包指南，包括：
- 步骤说明（8 步）
- 关键字段检查（autohome_ci、sessionID、deviceid）
- 特别说明（Python 爬虫爬取论坛帖子）

### 2. 状态提示

根据配置状态显示不同提示：
- 已配置 Cookie：显示"已配置 Cookie，可以点击"测试连接"验证"
- 未配置 Cookie：显示"未配置 Cookie"

### 3. 测试连接

点击"🔍 测试连接"按钮后：
- 调用后端 API 测试汽车之家连接
- 显示测试结果（成功/失败）
- 显示找到的帖子数量

### 4. 保存配置

点击"保存配置"按钮后：
- 收集汽车之家配置字段（Cookie、启用状态）
- 与其他平台配置一起发送到后端
- 显示保存结果

## 后端 API

### 测试连接端点

```
POST /api/network-post-config/test-autohome
Content-Type: application/json

{
  "cookie": "autohome_ci=xxx; sessionID=xxx; ..."
}
```

**响应示例：**

成功：
```json
{
  "success": true,
  "message": "汽车之家连接测试成功",
  "resultCount": 5
}
```

失败：
```json
{
  "success": false,
  "error": "测试超时（15 秒）"
}
```

### 保存配置端点

```
POST /api/network-post-config
Content-Type: application/json

{
  "autohomeCookie": "autohome_ci=xxx; sessionID=xxx; ...",
  "autohomeEnabled": true,
  ...
}
```

## 使用说明

### 1. 获取汽车之家 Cookie

1. 打开浏览器（推荐 Chrome 或 Edge）
2. 访问 [汽车之家](https://www.autohome.com.cn) 并登录账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Network（网络）** 标签，勾选 **Preserve log（保留日志）**
5. 刷新页面（`F5`）
6. 在左侧请求列表中找到任意 API 请求（如包含 `api` 或 `ajax` 的）
7. 点击该请求 → 右侧 **Headers（请求头）** 标签 → 找到 `Cookie` 字段
8. 复制整个 Cookie 值并粘贴到配置输入框

### 2. 配置汽车之家

1. 进入"论坛设置" → "网络发帖"
2. 在"🚗 汽车之家配置"卡片中粘贴 Cookie
3. 勾选"启用汽车之家搜索"
4. 点击"测试连接"验证配置是否有效
5. 点击"保存配置"保存设置

### 3. 测试连接

- 测试会爬取奥迪相关论坛（A4L、Q5L、A6L、A3、Q3、Q7、A8）
- 默认搜索关键词"奥迪"，最多返回 5 条结果
- 测试成功会显示找到的帖��数量

## 技术实现

### 前端

- 配置表单渲染：`renderNetworkPostConfigContent()`
- 配置保存：`saveConfig()`
- 测试连接：`testAutohomeConnection()`
- 教程切换：`toggleAutohomeGuide()`

### 后端

- 路由：`src/web/routes/network-post-routes.ts`
  - `POST /api/network-post-config/test-autohome`
- 存储：`src/storage/mysql/network-post-config-storage.ts`
  - `testAutohomeConnection()` 方法
- Python 脚本：`scripts/test_autohome.py`
  - 爬取奥迪相关论坛帖子列表页
  - 按关键词过滤标题

## 注意事项

1. **Cookie 有效期**：汽车之家 Cookie 有效期不固定，过期后需重新获取
2. **访问频率**：建议控制搜索频率，避免被反爬
3. **论坛范围**：目前仅爬取奥迪相关 7 个论坛（A4L、Q5L、A6L、A3、Q3、Q7、A8）
4. **Python 依赖**：需要安装 `requests` 和 `beautifulsoup4`

## 相关文件

- 前端页面：`src/web/public/index.html`
- 后端路由：`src/web/routes/network-post-routes.ts`
- 存储层：`src/storage/mysql/network-post-config-storage.ts`
- Python 脚本：`scripts/test_autohome.py`
- TypeScript 服务：`src/services/internet-search/autohome-search.ts`
- 数据库迁移：`src/db/migrations/031_add_autohome_to_network_post_config.sql`
