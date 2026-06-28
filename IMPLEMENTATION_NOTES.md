# 小红书爬虫 - Docker 部署实现要点

## 项目背景
为群晖 NAS 18+ Docker 环境开发小红书爬虫，需要支持无头模式且不被检测到。

## 最终方案：混合架构

### 架构设计
```
搜索层（同步 API）：
  xhshow 生成签名 → requests 调用 API → 获取笔记列表（含 xsec_token）
  
详情层（异步浏览器）：
  Playwright 无头模式 → stealth.min.js 反检测 → 访问详情页 → 提取数据
```

### 核心文件

1. **xiaohongshu_final.py** - 主爬虫文件
2. **stealth.min.js** - 反检测脚本
3. **test_hybrid_search.py** - API 测试（已验证成功）
4. **test_playwright_simple.py** - 详情页测试（已验证成功）

## 核心技术点

### 1. Cookie 要求
Cookie 必须包含以下关键字段：
- `a1` - 签名必需（最重要！）
- `web_session` - 会话标识
- `id_token` - 身份令牌
- `acw_tc` - 反爬虫令牌

**获取方法**：
1. 浏览器打开小红书网页版
2. F12 开发者工具 → Application → Cookies
3. 复制完整 Cookie 字符串

### 2. xhshow 签名生成

```python
from xhshow import Xhshow

client = Xhshow()

# 生成 search_id
search_id = client.get_search_id()

# 生成签名
signature = client.sign_xs_post(
    uri="/api/sns/web/v2/search/notes",
    a1_value="从 Cookie 提取的 a1 值",
    payload={
        "keyword": "美食",
        "page": 1,
        "page_size": 10,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0
    }
)
```

### 3. 搜索 API 请求头

```python
headers = {
    "x-s": signature,  # 签名
    "x-t": str(int(time.time() * 1000)),  # 毫秒时间戳
    "user-agent": "Mozilla/5.0...",
    "content-type": "application/json;charset=UTF-8",
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "zh-CN,zh;q=0.9",
    "origin": "https://www.xiaohongshu.com",
    "referer": "https://www.xiaohongshu.com/",
    "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}
```

### 4. xsec_token 提取

xsec_token 可能出现在三个位置（按优先级）：
1. `item.xsec_token` - 笔记项级别
2. `note_card.xsec_token` - 笔记卡片级别
3. `note_card.user.xsec_token` - 用户信息级别

```python
xsec_token = item.get('xsec_token')
if not xsec_token:
    xsec_token = note_card.get('xsec_token')
if not xsec_token:
    xsec_token = note_card.get('user', {}).get('xsec_token')
```

### 5. Playwright 无头模式配置

```python
browser = await playwright.chromium.launch(
    headless=True,  # Docker 必须使用无头模式
    args=[
        '--disable-blink-features=AutomationControlled',  # 移除自动化标志
        '--disable-dev-shm-usage',  # 避免 /dev/shm 空间不足
        '--no-sandbox',  # Docker 必需
        '--window-size=1920,1080',
    ]
)

context = await browser.new_context(
    viewport={'width': 1920, 'height': 1080},
    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    locale='zh-CN',
    timezone_id='Asia/Shanghai',
)
```

### 6. stealth.min.js 注入

```python
# 下载 stealth.min.js
# curl -O https://cdn.jsdelivr.net/gh/requireCool/stealth.min.js/stealth.min.js

# 注入脚本
await page.add_init_script(path='stealth.min.js')
```

**stealth.min.js 作用**：
- 覆盖 `navigator.webdriver` 为 `false`
- 伪装 `window.chrome` 对象
- 覆盖 permissions API
- 移除 CDP 痕迹
- 伪装 Canvas/WebGL 指纹

### 7. 从 __INITIAL_STATE__ 提取数据

```javascript
const note_data = await page.evaluate(() => {
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
        const note = window.__INITIAL_STATE__.note;
        if (note.currentNote) {
            return {
                title: note.currentNote.title,
                desc: note.currentNote.desc,
                user: note.currentNote.user?.nickname,
                likes: note.currentNote.interact_info?.liked_count,
                collects: note.currentNote.interact_info?.collected_count,
                comments: note.currentNote.interact_info?.comment_count
            };
        }
    }
    return null;
});
```

### 8. 反检测策略

#### 浏览器层面
- 使用 stealth.min.js
- 设置正确的 viewport 和 user-agent
- 设置 locale 和 timezone

#### 行为层面
- 随机休眠（1-5 秒）
- 使用 `domcontentloaded` 而非 `networkidle`
- 设置合理的超时时间（30 秒）

#### 请求层面
- 完整的请求头
- 正确的 Cookie
- 毫秒级时间戳

## 已知问题

### 问题 1：异步环境中搜索 API 返回 0 条
**现象**：test_hybrid_search.py 成功，但在类方法中失败
**可能原因**：
- xhshow 库的状态管理问题
- Cookie 在异步环境中被修改
- 事件循环影响签名生成

**临时解决方案**：
使用独立的同步函数进行搜索，而不是在异步类中调用。

### 问题 2：无头模式检测
**现象**：无头模式下页面加载不完整
**解决方法**：
- 必须使用 stealth.min.js
- Cookie 必须包含完整的认证信息
- 访问详情页时必须携带 xsec_token

## Docker 部署建议

### Dockerfile 示例

```dockerfile
FROM python:3.10-slim

# 安装依赖
RUN pip install playwright xhshow requests
RUN playwright install chromium

# 复制代码
COPY xiaohongshu_final.py /app/
COPY stealth.min.js /app/

WORKDIR /app

# 运行
CMD ["python", "xiaohongshu_final.py"]
```

### 环境变量
```bash
# Cookie（建议从 Docker secrets 或环境变量读取）
export XHS_COOKIE="abRequestId=...; a1=...; web_session=...; id_token=..."

# 调试模式
export DEBUG_MODE=true  # 启用截图和 HTML 保存
```

### 资源限制
- CPU: 1-2 核心
- 内存：512MB-1GB
- 存储：100MB（不含缓存）

## 性能优化

### 1. 浏览器实例复用
不要每次请求都创建新浏览器，而是复用同一个实例。

### 2. 请求限流
- 搜索间隔：5-10 秒
- 详情间隔：1-3 秒
- 每日总量：< 200 次

### 3. Cookie 轮换
实现 Cookie 池，多个账号轮换使用。

## 测试方法

### 1. 测试搜索 API
```bash
python3.10 test_hybrid_search.py
```
应返回 10 条笔记结果。

### 2. 测试详情页
```bash
python3.10 test_playwright_simple.py
```
应成功获取笔记标题和互动数据。

### 3. 测试完整流程
```bash
python3.10 xiaohongshu_final.py
```
应完成搜索 + 详情获取全流程。

## 参考资料

1. [xhshow 库源码](https://github.com/...)
2. [Playwright 文档](https://playwright.dev/python/)
3. [stealth.min.js 项目](https://github.com/requireCool/stealth.min.js)
4. [小红书 API 抓包分析](./test_xhshow_search.py)

## 更新日志

- 2026-06-28: 创建混合架构，整合 xhshow + Playwright
- 2026-06-28: 完成 stealth.min.js 集成
- 2026-06-28: 验证搜索 API 和详情页 API

---

**注意**：本项目仅供学习研究使用，请勿用于商业爬取或违反小红书用户协议的行为。
