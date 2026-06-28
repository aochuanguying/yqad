# 小红书搜索快速开始指南

5 分钟快速配置小红书搜索功能！

---

## ⚡ 快速步骤

### 1️⃣ 获取小红书 Cookie（2 分钟）

1. 打开浏览器，访问 https://www.xiaohongshu.com
2. 扫码登录你的小红书账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Network** 标签
5. 刷新页面（`F5`）
6. 点击任意请求（如 `explore` 或 `api` 开头）
7. 在 **Headers** 标签中找到 `Cookie` 字段
8. 复制整个 Cookie 值

**Cookie 示例：**
```
web_session=abcdef123456; a1=xyz789abc; ...
```

---

### 2️⃣ 运行数据库迁移（1 分钟）

```bash
mysql -u root -p
source /Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000\ Workspace/yqad/src/db/migrations/030_create_network_post_config_table.sql;
exit;
```

---

### 3️⃣ 重启服务（1 分钟）

```bash
npm run stop
npm run start
```

---

### 4️⃣ 配置小红书（1 分钟）

**方法 A：Web 界面（推荐）**

1. 访问 YQAD Web 管理界面
2. 进入 **💬 论坛设置 → 🌐 网络发帖**
3. 找到 **小红书配置** 卡片
4. 粘贴 Cookie
5. 勾选 **启用小红书搜索**
6. 点击 **🔍 测试连接** 验证
7. 点击 **💾 保存配置**

**方法 B：命令行**

```bash
mysql -u root -p -e "
UPDATE network_post_config 
SET xiaohongshu_cookie = '你的 Cookie 值',
    xiaohongshu_enabled = 1
WHERE id = 1;
"
```

---

### 5️⃣ 测试搜索（可选）

```bash
python3 /Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000\ Workspace/yqad/test_xiaohongshu.py
```

输入你的 Cookie，即可看到搜索结果！

---

## ✅ 验证成功

如果看到以下信息，说明配置成功：

- ✅ Web 界面测试连接显示"小红书 API 连接测试成功"
- ✅ 返回结果数量（如"找到 5 条结果"）
- ✅ 测试脚本显示"✅ 搜索成功！"

---

## 🆘 遇到问题？

### Cookie 失效
- **症状**: 测试连接失败，返回错误
- **解决**: 重新登录小红书，获取新的 Cookie

### 数据库表不存在
- **症状**: SQL 执行报错
- **解决**: 确认数据库迁移脚本已执行

### Python 找不到 xhs 库
- **症状**: `ModuleNotFoundError: No module named 'xhs'`
- **解决**: `pip3 install xhs`

### 搜索结果为空
- **症状**: 返回 0 条结果
- **解决**: 
  - 检查 Cookie 是否包含 `web_session` 和 `a1`
  - 尝试其他关键词
  - 检查网络连接

---

## 📚 详细文档

- [完整配置指南](./XIAOHONGSHU_SEARCH_SETUP.md)
- [技术实施文档](./XIAOHONGSHU_INTEGRATION.md)
- [网络发帖总览](./NETWORK_POST_CONFIG_SETUP.md)

---

## 🎯 下一步

配置完成后，小红书搜索将自动集成到发帖系统中：

1. 发帖时选择"从网络搜索素材"
2. 勾选"小红书"作为搜索源
3. 输入关键词（如"奥迪 Q5L"）
4. 系统自动搜索并返回相关笔记
5. 选择优质内容进行二次创作

---

**最后更新**: 2026-06-28  
**预计时间**: 5 分钟  
**难度**: ⭐⭐☆☆☆（简单）
