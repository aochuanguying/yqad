# 小红书 Cookie 自动刷新工具

## 📋 功能说明

自动刷新小红书 Cookie 并更新到数据库，解决 Cookie 快速过期的问题。

## 🎯 为什么需要自动刷新

小红书 Cookie 通常在 1-3 天内会过期，原因包括:
- 登录态活跃度不足
- 异地/异常登录检测
- 请求频率触发风控
- 关键令牌 (id_token, web_session) 有效期短

## 🚀 快速开始

### 1. 首次使用 (手动测试)

```bash
# 运行测试脚本 (会打开浏览器，需要扫码登录)
cd /Users/mac/Documents/workspace/krio/yqad/scripts
python3 test_cookie_refresh.py
```

**流程说明:**
1. 脚本会打开 Chromium 浏览器
2. 访问小红书登录页 (https://www.xiaohongshu.com/login)
3. 使用手机小红书 APP 扫码登录
4. 登录成功后自动提取 Cookie 并保存到数据库
5. 关闭浏览器

### 2. 设置定时任务 (推荐)

```bash
# 设置每天凌晨 2 点自动刷新
cd /Users/mac/Documents/workspace/krio/yqad/scripts
bash setup_cookie_refresh_cron.sh
```

**定时任务说明:**
- 执行时间：每天凌晨 2:00
- 日志文件：`cookie_refresh.log`
- 查看日志：`tail -f cookie_refresh.log`

### 3. 验证 Cookie 是否可用

```bash
# 运行导出测试
python3 test_audi_export.py
```

## 📁 文件说明

| 文件名 | 说明 |
|--------|------|
| `auto_refresh_xiaohongshu_cookie.py` | 核心刷新脚本 |
| `test_cookie_refresh.py` | 测试脚本 |
| `setup_cookie_refresh_cron.sh` | 定时任务设置脚本 |
| `update-cookie-db.js` | Cookie 数据库更新工具 (Node.js) |

## 🔧 依赖安装

脚本会自动检查并安装以下依赖:
- Python 3.10+
- Playwright
- mysql-connector-python
- Chromium 浏览器

如需手动安装:

```bash
# 安装 Python 依赖
python3.10 -m pip install playwright mysql-connector-python

# 安装浏览器
python3.10 -m playwright install chromium
```

## ⚙️ 高级配置

### 修改刷新时间

编辑 `setup_cookie_refresh_cron.sh`,修改定时任务时间:

```bash
# 默认：每天凌晨 2 点
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"

# 改为：每天早上 8 点
CRON_JOB="0 8 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"

# 改为：每 12 小时刷新一次
CRON_JOB="0 */12 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"
```

### 手动运行刷新

```bash
python3 auto_refresh_xiaohongshu_cookie.py
```

### 查看定时任务状态

```bash
# 查看当前用户的定时任务
crontab -l

# 编辑定时任务
crontab -e

# 删除所有定时任务 (谨慎使用)
crontab -r
```

## 🐛 常见问题

### Q1: 扫码后提示登录超时
**解决:** 重新运行脚本，确保在 300 秒 (5 分钟) 内完成扫码登录

### Q2: Cookie 仍然快速过期
**解决:** 
- 增加刷新频率 (如每 12 小时一次)
- 检查账号是否被风控
- 考虑使用多账号轮换

### Q3: 定时任务未执行
**解决:**
```bash
# 检查 cron 服务状态
sudo systemctl status cron  # Linux
sudo launchctl list | grep cron  # macOS

# 查看系统日志
grep CRON /var/log/system.log  # macOS
```

### Q4: 数据库连接失败
**解决:** 检查数据库配置，确保网络可达

## 📊 最佳实践

1. **定期刷新**: 建议每 1-2 天刷新一次
2. **监控日志**: 定期��查 `cookie_refresh.log`
3. **备份 Cookie**: 重要时期可手动备份 Cookie
4. **降低频率**: 非高峰期减少请求频率
5. **多账号准备**: 准备备用账号应对突发情况

## 📝 注意事项

- ⚠️ 首次运行需要手动扫码登录
- ⚠️ 确保数据库连接正常
- ⚠️ 避免在短时间内频繁刷新 Cookie
- ⚠️ 扫码登录时确保使用真实的小红书账号

## 🆘 获取帮助

如果遇到问题:
1. 查看日志文件：`tail -f cookie_refresh.log`
2. 手动运行测试：`python3 test_cookie_refresh.py`
3. 检查数据库 Cookie: `node get_xiaohongshu_cookie_from_db.ts`
