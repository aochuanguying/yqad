# Auto.js6 发帖客户端使用指南

## 概述

这是一个运行在 Android 手机上的 Auto.js6 脚本，用于：
1. 调用服务端 API 获取发帖内容（标题、正文、图片）
2. 自动下载图片到手机
3. 自动打开奥迪 APP 并发布帖子

**适用环境**：
- Android 15（已 root）
- Auto.js6
- 奥迪 APP 已安装

---

## 快速开始

### 1. 服务端配置

在电脑上启动发帖服务：

```bash
# 1. 配置 API 模式
# 编辑 config/default.yaml
post:
  mode: 'api'

web:
  enabled: true
  port: 3000
  baseUrl: "http://你的电脑 IP:3000"  # 重要：手机需要能访问

# 2. 启动服务
npm run build
node dist/index.js
```

### 2. 获取 Token

从服务端的 `data/token.json` 文件中获取 Token：

```bash
cat data/token.json
```

### 3. 脚本配置

编辑 `autojs6-post-client.js` 文件，修改以下配置：

```javascript
// 服务端地址（替换为你的电脑 IP）
const SERVER_URL = 'http://192.168.1.100:3000/api';

// 认证 Token（从 data/token.json 获取）
const AUTH_TOKEN = 'your-token-here';

// 奥迪 APP 包名（如果不同请修改）
const APP_PACKAGE = 'com.faw.audi';

// 图片保存路径
const IMAGE_SAVE_PATH = '/sdcard/Pictures/AudiPosts/';

// 发帖模式：'featured'（精华）或 'normal'（普通）
const POST_MODE = 'featured';

// 是否使用主题
const USE_TOPIC = true;
```

---

## 安装和运行

### 安装 Auto.js6

1. 下载 Auto.js6 APK
2. 安装到手机
3. 授予 root 权限
4. 开启无障碍服务

### 导入脚本

1. 将 `autojs6-post-client.js` 传到手机
2. 在 Auto.js6 中导入脚本
3. 给脚本授权（文件读写、网络访问等）

### 运行脚本

1. 在 Auto.js6 中点击运行
2. 查看配置对话框
3. 点击"确定"开始发帖

---

## 脚本功能说明

### 核心流程

```
开始
  ↓
获取发帖内容（调用 API）
  ↓
下载所有图片
  ↓
打开奥迪 APP
  ↓
进入发帖页面
  ↓
输入标题
  ↓
输入正文
  ↓
上传图片
  ↓
选择话题
  ↓
点击发布
  ↓
完成
```

### API 调用

脚本会调用以下 API：

**1. 获取发帖内容**
```
POST {SERVER_URL}/posts/generate
Headers: Authorization: Bearer {TOKEN}
Body: {
  "useTopic": true,
  "mode": "featured"
}
```

**2. 下载图片**
```
GET {图片 URL}
Headers: Authorization: Bearer {TOKEN}
```

### 自动化操作

脚本会自动执行以下操作：

1. **打开 APP**：`launch(APP_PACKAGE)`
2. **查找控件**：使用 `className()`, `text()`, `desc()` 等选择器
3. **输入文本**：`setText()`
4. **点击按钮**：`click()`
5. **等待加载**：`sleep()`

---

## 自定义调整

### 修改控件选择器

由于不同版本的奥迪 APP 界面可能不同，需要调整控件选择器：

```javascript
// 示例：查找发布按钮
const publishButton = className('android.widget.Button')
    .text('发布')
    .findOne(5000);

// 如果找不到，可以尝试其他选择器：
// 1. 使用 desc() 代替 text()
const publishButton = desc('发布按钮').findOne(5000);

// 2. 使用 id()
const publishButton = id('btn_publish').findOne(5000);

// 3. 使用文本包含
const publishButton = textContains('发').findOne(5000);
```

### 使用 UiSelector 辅助工具

Auto.js6 提供了布局分析工具：

1. 打开 Auto.js6
2. 进入"布局分析"
3. 选择奥迪 APP 的发帖页面
4. 查看控件的 className、text、desc、id 等属性
5. 根据属性编写选择器

### 调整等待时间

如果网络慢或 APP 卡顿，可以增加等待时间：

```javascript
// 默认等待 3 秒
sleep(3000);

// 改为 5 秒
sleep(5000);
```

---

## 日志查看

脚本运行时会输出详细日志：

```
=== 奥迪社区自动发帖 ===
时间：2026-06-11 15:30
模式：featured
使用主题：true

正在获取发帖内容...
✓ 发帖内容获取成功
  标题：奥迪 Q5L 保养全攻略
  字数：315
  图片：5 张
  模式：featured
  话题：#奥迪 Q5L#, #保养攻略#

开始下载 5 张图片...
图片下载成功：/sdcard/Pictures/AudiPosts/post_1718078400000_0.jpg
...
图片下载完成：成功 5/5 张

开始自动发布帖子...
打开奥迪 APP...
进入发帖页面...
输入标题...
输入正文内容...
上传图片...
选择话题...
点击发布...
✓ 帖子发布成功！
```

日志位置：Auto.js6 控制台 或 `/sdcard/脚本/日志/`

---

## 常见问题

### 1. "HTTP 错误：401"

**原因**：Token 无效或过期

**解决**：
- 检查 `AUTH_TOKEN` 配置是否正确
- 重新登录获取新 token

### 2. "请求异常：timeout"

**原因**：网络连接超时

**解决**：
- 确保手机和电脑在同一局域网
- 检查防火墙设置
- 增加 `REQUEST_TIMEOUT` 值

### 3. "未找到发布按钮"

**原因**：APP 版本不同，UI 结构变化

**解决**：
- 使用布局分析工具查看实际控件
- 修改对应的选择器
- 或手动进入发帖页面后运行脚本

### 4. "图片下载失败"

**原因**：图片 URL 无法访问

**解决**：
- 检查 `SERVER_URL` 配置
- 确保 `baseUrl` 配置正确
- 检查网络连通性

### 5. "发帖失败：内容获取失败"

**原因**：服务端 API 调用失败

**解决**：
- 检查服务端是否正常运行
- 查看服务端日志
- 确认有可用的主题或互联网参考

---

## 高级功能

### 定时发帖

可以结合 Auto.js6 的定时任务功能：

```javascript
// 每天早上 10 点自动发帖
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 10 && now.getMinutes() === 0) {
        runAutoPost();
    }
}, 60000);  // 每分钟检查一次
```

### 批量发帖

修改脚本支持批量生成：

```javascript
function batchPost(count) {
    for (let i = 0; i < count; i++) {
        log(`开始第 ${i + 1} 篇帖子`);
        runAutoPost();
        sleep(5000);  // 间隔 5 秒
    }
}

// 调用：batchPost(3);
```

### 错误重试

添加错误重试机制：

```javascript
function runWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        if (runAutoPost()) {
            return true;
        }
        log(`第 ${i + 1} 次尝试失败，重试中...`);
        sleep(5000);
    }
    return false;
}
```

---

## 注意事项

1. **root 权限**：脚本需要 root 权限才能执行某些操作
2. **网络环境**：确保手机能访问服务端（同一 WiFi 或配置公网 IP）
3. **APP 版本**：不同版本的奥迪 APP 可能需要调整选择器
4. **频率限制**：API 每小时最多 10 次请求，避免频繁调用
5. **图片清理**：定期清理 `/sdcard/Pictures/AudiPosts/` 目录

---

## 技术支持

遇到问题可以查看：
- Auto.js6 官方文档：https://doc.autojs6.com/
- 服务端 API 文档：`REMOTE_POST_API.md`
- 脚本日志：详细的错误信息

---

## 更新日志

### v1.0.0 (2026-06-11)
- 初始版本
- 支持调用远程 API 获取发帖内容
- 自动下载图片
- 自动发布到奥迪社区
- 支持精华帖和普通帖模式
- 支持主题发帖
