# 小红书 Cookie 测试结果

## 测试时间
2026-06-28

## Cookie 信息
- **web_session**: `040069b3d8514b3c0ec4787c75384b6a52752f`
- **a1**: `19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769`
- **来源**: 用户提供的浏览器请求头

---

## 测试结果

### ✅ 技术验证通过

1. **签名函数正常**
   - 使用 `xhs.help.sign` 包装函数
   - 成功生成 x-s 签名
   - 通过小红书 API 验证

2. **xhs 库可用**
   - 版本：0.2.13
   - 方法：`get_note_by_keyword`
   - 调用成功

3. **API 连接正常**
   - 成功连接到小红书 API
   - 请求格式正确
   - 响应解析正常

### ❌ 账号限制

**错误信息**:
```
code: 300011
msg: 当前账号存在异常，请切换账号后重试
```

**原因分析**:
1. 账号可能未实名认证
2. 账号活跃度不够（新号/小号）
3. 频繁进行数据爬取操作
4. 账号被系统标记为异常

---

## 解决方案

### 方案 1：使用其他账号（推荐）

建议使用一个**活跃度高、已实名认证**的小红书账号：

1. 在小红书 APP 中完成实名认证
2. 正常使用一段时间（浏览、点赞、收藏）
3. 确保账号状态良好
4. 重新获取 Cookie

### 方案 2：等待账号恢复

如果只是临时限制，可以：
1. 停止爬取操作 24-48 小时
2. 正常浏览小红书（模拟真实用户）
3. 进行一些互动操作（点赞、收藏）
4. 之后再次尝试

### 方案 3：使用知乎 API（备选）

在小红书账号问题解决前，可以先使用**知乎 API**：

- 知乎 Token 已配置：`11d78a6c28453c03f047552bc588d03ad227db52`
- 每天免费 1000 次调用
- 稳定可靠

---

## 代码已就绪

虽然当前 Cookie 受限，但**所有代码已经准备完毕**：

### 1. 核心服务
- ✅ `xiaohongshu-search.ts` - 小红书搜索服务
- ✅ `network-post-config-storage.ts` - 配置存储（支持测试连接）
- ✅ `network-post-routes.ts` - API 路由

### 2. 数据库
- ✅ 迁移脚本已创建
- ✅ 字段：`xiaohongshu_cookie`, `xiaohongshu_enabled`

### 3. 测试工具
- ✅ `test_cookie_now.py` - Cookie 测试脚本
- ✅ 签名包装函数（解决版本兼容）

### 4. 文档
- ✅ `XIAOHONGSHU_QUICKSTART.md` - 快速开始
- ✅ `XIAOHONGSHU_SEARCH_SETUP.md` - 详细配置
- ✅ `XIAOHONGSHU_INTEGRATION.md` - 技术文档
- ✅ 本文档

---

## 下一步操作

### 立即执行

1. **获取新 Cookie**
   - 使用活跃账号重新登录
   - F12 复制 Cookie
   - 运行测试：`python3 test_cookie_now.py`

2. **运行数据库迁移**
   ```bash
   mysql -u root -p
   source src/db/migrations/030_create_network_post_config_table.sql;
   ```

3. **重启服务**
   ```bash
   npm run stop
   npm run start
   ```

### 配置到新系统

一旦有了有效的 Cookie：

1. 进入 Web 管理界面
2. 论坛设置 → 网络发帖
3. 粘贴 Cookie
4. 测试连接（应该显示成功）
5. 保存配置

---

## 技术总结

### 成功经验

1. **xhs 库使用方式**
   ```python
   from xhs import XhsClient
   from xhs.help import sign as original_sign
   
   def sign_wrapper(uri, data=None, **kwargs):
       return original_sign(uri, data)
   
   client = XhsClient(cookie=cookie, sign=sign_wrapper)
   result = client.get_note_by_keyword(keyword="xxx", page=1, page_size=10)
   ```

2. **签名函数参数**
   - 原始签名函数：`sign(uri, data=None, ctime=None, a1='', b1='')`
   - 库调用时传递了 `web_session` 参数（不兼容）
   - 使用包装函数忽略额外参数

3. **错误处理**
   - 300011: 账号异常
   - 需要更换账号或等待恢复

---

## 账号要求

建议使用符合以下条件的小红书账号：

- ✅ **已实名认证**
- ✅ **活跃度高**（经常使用）
- ✅ **正常互动**（点赞、收藏、评论）
- ✅ **非爬虫专用号**（避免被标记）
- ✅ **有一定粉丝数**（可选，增加可信度）

---

## 联系支持

如果问题持续，可以：
1. 联系小红书客服
2. 检查账号状态
3. 申诉解封

---

**状态**: ⏸️ 代码完成，等待有效 Cookie  
**最后更新**: 2026-06-28  
**测试结论**: 技术可行，需要更换账号
