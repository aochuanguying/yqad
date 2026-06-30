# 小红书 Cookie 自动刷新方案

## 📋 问题背景

### Cookie 过期问题
小红书 Cookie 通常在 1-3 天内会过期，导致 API 调用失败。主要原因:

1. **关键字段时效性短**
   - `id_token`: 身份令牌，有效期几小时到几天
   - `web_session`: 会话标识，依赖服务器端状态
   - `acw_tc`: 反爬虫令牌，有效期很短

2. **风控机制**
   - 登录态活跃度不足会加速过期
   - 异地/异常登录检测
   - 请求频率触发风控
   - 设备指纹变化 (`webId`, `gid`)

3. **手动提取的局限**
   - 浏览器中正常使用会自动续期
   - 提取出来后用于脚本，无法自动续期
   - 缺少正常用户行为，服务器可能主动使 Cookie 失效

## 🎯 解决方案

### 自动化 Cookie 刷新
使用 Playwright 自动登录小红书，获取最新 Cookie 并保存到数据库。

**核心思路:**
1. 首次运行：扫码登录 → 保存 Cookie + 持久化浏览器用户数据
2. 后续运行：自动保持登录状态 → 直接获取新 Cookie

## 🚀 使用方法

### 首次使用 (需要扫码一次)

```bash
cd /Users/mac/Documents/workspace/krio/yqad/scripts
python3 auto_refresh_xiaohongshu_cookie.py
```

**流程:**
1. 脚本打开 Chromium 浏览器
2. 访问小红书登录页 (https://www.xiaohongshu.com/login)
3. 使用手机小红书 APP 扫码登录
4. 登录成功后自动提取 Cookie
5. 保存到生产数据库 `network_post_config` 表
6. 关闭浏览器

### 后续使用 (无需扫码)

```bash
python3 auto_refresh_xiaohongshu_cookie.py
```

**流程:**
1. 脚本打开浏览器 (加载已保存的用户数据)
2. **自动保持登录状态** (无需扫码!)
3. 直接获取最新 Cookie
4. 更新到数据库

### 设置定时任务 (可选)

```bash
bash setup_cookie_refresh_cron.sh
```

这会设置每天凌晨 2 点自动刷新 Cookie。

## 📁 文件说明

| 文件名 | 说明 |
|--------|------|
| `auto_refresh_xiaohongshu_cookie.py` | 核心刷新脚本 |
| `test_cookie_refresh.py` | 快速测试脚本 |
| `setup_cookie_refresh_cron.sh` | 定时任务设置脚本 |
| `COOKIE_REFRESH_README.md` | 详细使用文档 |
| `xiaohongshu_browser_data/` | 浏览器用户数据目录 (自动生成) |

## 🔧 技术实现

### 持久化浏览器用户数据

```python
# 用户数据目录
user_data_dir = os.path.join(os.path.dirname(__file__), 'xiaohongshu_browser_data')

# 启动持久化浏览器
browser = p.chromium.launch_persistent_context(
    user_data_dir=user_data_dir,
    headless=False,
    args=[
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
    ]
)
```

### 自动检测登录状态

```python
def wait_for_login(page: Page, timeout: int = 300) -> bool:
    """等待用户登录成功"""
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        cookies = page.context.cookies()
        cookie_dict = {c['name']: c['value'] for c in cookies}
        
        # 检查关键 Cookie 是否存在
        has_id_token = 'id_token' in cookie_dict and len(cookie_dict['id_token']) > 50
        has_web_session = 'web_session' in cookie_dict and len(cookie_dict['web_session']) > 10
        
        if has_id_token and has_web_session:
            return True
        
        time.sleep(2)
    
    return False
```

### Cookie 保存到数据库

```python
def save_cookie_to_db(cookie_string: str) -> bool:
    conn = mysql.connector.connect(
        host='192.168.50.50',
        port=3306,
        user='root',
        password='Wfw7539148@',
        database='yqad_prod_db'
    )
    cursor = conn.cursor()
    sql = """
        UPDATE network_post_config 
        SET xiaohongshu_cookie = %s,
            xiaohongshu_enabled = 1,
            updated_at = NOW()
        WHERE id = 1
    """
    cursor.execute(sql, (cookie_string,))
    conn.commit()
    cursor.close()
    conn.close()
    return True
```

## 📊 测试结果

### 实际运行数据

| 运行次数 | 等待时间 | 需要扫码 | Cookie 长度 | 状态 |
|---------|---------|---------|-----------|------|
| 第 1 次 | 12 秒 | ✅ 需要 | 998 | ✅ 成功 |
| 第 2 次 | <1 秒 | ❌ 不需要 | 821 | ✅ 成功 |
| 第 3 次 | <1 秒 | ❌ 不需要 | 998 | ✅ 成功 |

### Cookie 关键组件验证

```
✓ id_token: VjEAAE2zuirbfuiMf9gW0FchMH1NYC...
✓ web_session: 040069b6d9aed466dced062177384b...
✓ a1: 19f136b935e6sovmr753m5hfcaqhla...
✓ webId: d153def15c22d185c6afe027a24037...
✓ acw_tc: 0ad5875f17827372671227415e6c6e...
```

### API 调用验证

```bash
python3 test_audi_export.py
```

**结果:**
- ✅ 搜索"奥迪 Q5L"成功，获取 10 条笔记
- ✅ 获取笔记详情成功
- ✅ 提取图片链接成功 (26 张图片)
- ✅ 数据导出成功 (JSON 文件)

## 🔍 依赖安装

### 自动安装 (推荐)

```bash
# 脚本会自动检查并安装
bash setup_cookie_refresh_cron.sh
```

### 手动安装

```bash
# 安装 Python 依赖
python3.10 -m pip install playwright mysql-connector-python

# 安装浏览器
python3.10 -m playwright install chromium
```

## ⚙️ 高级配置

### 修改刷新频率

编辑 `setup_cookie_refresh_cron.sh`:

```bash
# 每天凌晨 2 点 (默认)
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"

# 每 12 小时刷新
CRON_JOB="0 */12 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"

# 每天早上 8 点
CRON_JOB="0 8 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"
```

### 查看和管理定时任务

```bash
# 查看当前定时任务
crontab -l

# 编辑定时任务
crontab -e

# 删除所有定时任务 (谨慎使用)
crontab -r

# 查看日志
tail -f scripts/cookie_refresh.log
```

### 手动运行

```bash
# 随时手动刷新 Cookie
python3 auto_refresh_xiaohongshu_cookie.py

# 测试 Cookie 是否可用
python3 test_audi_export.py
```

## 🐛 常见问题

### Q1: 扫码后提示登录超时

**解决:** 
- 重新运行脚本
- 确保在 300 秒 (5 分钟) 内完成扫码登录
- 检查网络连接

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

**解决:**
- 检查数据库配置 (host, port, user, password)
- 确保网络可达生产数据库 (192.168.50.50:3306)
- 检查数据库用户权限

### Q5: 浏览器窗口无法打开

**解决:**
```bash
# 删除用户数据目录，重新创建
rm -rf scripts/xiaohongshu_browser_data

# 重新运行脚本
python3 auto_refresh_xiaohongshu_cookie.py
```

## 📊 最佳实践

1. **定期刷新**: 建议每 1-2 天刷新一次
2. **监控日志**: 定期检查 `cookie_refresh.log`
3. **备份 Cookie**: 重要时期可手动备份 Cookie
4. **降低频率**: 非高峰期减少请求频率
5. **多账号准备**: 准备备用账号应对突发情况
6. **首次登录后不要关闭浏览器窗口**: 让脚本自动关闭

## 🎯 工作流程图

```
┌─────────────────────────────────────────────────┐
│           首次运行 (需要扫码)                    │
└─────────────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  打开浏览器 (全新会话)          │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  访问登录页                    │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  用户扫码登录 (人工干预)        │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  检测登录成功 ✓                │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  提取 Cookie                   │
    │  保存到数据库 ✓                │
    │  保存浏览器用户数据 ✓          │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
│         后续运行 (无需扫码)          │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  打开浏览器 (加载用户数据)      │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  自动保持登录状态 ✓            │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │  直接获取最新 Cookie           │
    │  更新到数据库 ✓                │
    └───────────────────────────────┘
```

## 📝 注意事项

- ⚠️ 首次运行需要手动扫码登录
- ⚠️ 确保数据库连接正常
- ⚠️ 避免在短时间内频繁刷新 Cookie
- ⚠️ 扫码登录时确保使用真实的小红书账号
- ⚠️ 不要手动删除 `xiaohongshu_browser_data` 目录，否则需要重新扫码

## 🆘 获取帮助

如果遇到问题:

1. 查看日志文件：`tail -f cookie_refresh.log`
2. 手动运行测试：`python3 test_cookie_refresh.py`
3. 检查数据库 Cookie: `node get_xiaohongshu_cookie_from_db.ts`
4. 验证 Cookie 可用性：`python3 test_audi_export.py`

## 🐳 Docker 部署 (群晖)

### 快速部署

```bash
# 上传文件到群晖后，运行部署脚本
cd /volume1/docker/xiaohongshu/docker
bash deploy.sh
```

### 主要变化

| 特性 | 本地环境 | Docker 环境 |
|------|---------|-----------|
| 浏览器模式 | 有界面 | headless 无界面 |
| 扫码方式 | 直接扫码 | 二维码图片 |
| 用户数据 | 本地目录 | 挂载卷 |
| 中文字体 | 系统自带 | 需要安装 |

### 部署文档

详细说明请参考：[群晖 Docker 部署指南.md](群晖 Docker 部署指南.md)

### 文件列表

- `docker/Dockerfile` - Docker 镜像配置
- `docker/docker-compose.yml` - Docker Compose 配置
- `docker/deploy.sh` - 快速部署脚本
- `scripts/auto_refresh_xiaohongshu_cookie_docker.py` - Docker 版本脚本

## 📚 相关文档

- [小红书 API 技术文档.md](小红书 API 技术文档.md)
- [小红书 API 快速参考.md](小红书 API 快速参考.md)
- [xhshow 获取详情 API 完整解析.md](xhshow 获取详情 API 完整解析.md)
- [COOKIE_REFRESH_README.md](../scripts/COOKIE_REFRESH_README.md)
- [群晖 Docker 部署指南.md](群晖 Docker 部署指南.md)

---

**最后更新:** 2026-06-29  
**状态:** ✅ 已验证通过
