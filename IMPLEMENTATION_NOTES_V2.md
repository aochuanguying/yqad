# 小红书爬虫 - 最终实现要点

## 项目背景
为群晖 NAS 18+ Docker 环境开发小红书爬虫，需要支持无头模式且不被检测到。

## 最终方案：混合架构

### 架构设计
```
搜索层（同步 API）：
  xhshow 生成签名 → requests 调用 API → 获取笔记列表（含 xsec_token）
  
详情层（异步浏览器）：
  Playwright 无头模式 → stealth.min.js 反检测 → 访问详情页 → 从 noteDetailMap 提取数据
```

### 核心文件

1. **xiaohongshu_final.py** - 主爬虫文件（最终版本）
2. **stealth.min.js** - 反检测脚本
3. **test_end_to_end.py** - 端到端完整测试
4. **test_hybrid_search.py** - API 测试（已验证成功）
5. **test_playwright_simple.py** - 详情页测试（已验证成功）

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
        "page_size": 10,  # ⚠️ 必须 >= 10，否则 API 返回空结果
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

### 4. 搜索结果数据提取

**关键发现：数据结构**
```python
# 笔记 ID 在顶层
note_id = item.get('id')  # ✅ 正确
note_id = note_card.get('id')  # ❌ None

# xsec_token 提取逻辑（三个位置）
xsec_token = item.get('xsec_token')  # 优先从顶层
if not xsec_token:
    xsec_token = note_card.get('xsec_token')
if not xsec_token:
    xsec_token = note_card.get('user', {}).get('xsec_token')
```

**⚠️ page_size 重要提示**
- `page_size` 必须 >= 10，否则 API 返回空结果
- 建议：始终使用 `page_size=10`，然后从结果中取前 N 条

### 5. Playwright 无头模式配置

```python
from playwright.async_api import async_playwright

browser = await playwright.chromium.launch(
    headless=True,  # Docker 环境必须使用无头模式
    args=[
        '--disable-blink-features=AutomationControlled',  # 禁用自动化标志
        '--disable-dev-shm-usage',  # 避免共享内存问题
        '--no-sandbox',  # Docker 环境需要
        '--window-size=1920,1080',  # 设置窗口大小
    ]
)

context = await browser.new_context(
    viewport={'width': 1920, 'height': 1080},
    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    locale='zh-CN',
    timezone_id='Asia/Shanghai',  # 设置时区
)
```

### 6. stealth.min.js 注入

```python
from pathlib import Path

stealth_path = Path(__file__).parent / 'stealth.min.js'

if stealth_path.exists():
    await page.add_init_script(path=str(stealth_path))
    print("✅ 已加载 stealth.min.js")
```

**stealth.min.js 作用**：
- 覆盖 `navigator.webdriver` 为 `false`
- 伪装 `window.chrome` 对象
- 覆盖 permissions API
- 移除 CDP 痕迹
- 伪装 Canvas/WebGL 指纹

### 7. 详情页数据提取

**⚠️ 关键发现：数据结构变化**

小红书页面数据结构已更新，**不再使用 `currentNote`**，而是使用 `noteDetailMap`：

```javascript
// ❌ 旧方法（已失效）
window.__INITIAL_STATE__.note.currentNote

// ✅ 新方法（正确）
window.__INITIAL_STATE__.note.noteDetailMap
```

**正确的数据提取代码**：
```javascript
() => {
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
        const note = window.__INITIAL_STATE__.note;
        
        // 从 noteDetailMap 中提取
        if (note.noteDetailMap) {
            const map = note.noteDetailMap;
            const keys = Object.keys(map);
            
            if (keys.length > 0) {
                const noteDetail = map[keys[0]];
                const noteItem = noteDetail?.note || noteDetail;
                
                if (noteItem) {
                    return {
                        title: noteItem.title,
                        desc: noteItem.desc,
                        user: noteItem.user?.nickname || '未知用户',
                        likes: noteItem.interact_info?.liked_count || 0,
                        collects: noteItem.interact_info?.collected_count || 0,
                        comments: noteItem.interact_info?.comment_count || 0
                    };
                }
            }
        }
    }
    return null;
}
```

### 8. Cookie 设置

```python
cookies = []
for cookie_str in COOKIE.split(';'):
    if '=' in cookie_str:
        name, value = cookie_str.strip().split('=', 1)
        cookies.append({
            'name': name.strip(),
            'value': value.strip(),
            'domain': '.xiaohongshu.com',
            'path': '/',
        })

if cookies:
    await context.add_cookies(cookies)
    print(f"✅ 已设置 {len(cookies)} 个 Cookie")
```

### 9. 页面加载等待

```python
# 访问详情页
await page.goto(url, wait_until='domcontentloaded', timeout=30000)

# 等待页面完全加载
await asyncio.sleep(5)  # 建议 3-5 秒
```

## Docker 部署建议

### Dockerfile 示例

```dockerfile
FROM python:3.10-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# 安装 Playwright 浏览器依赖
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY xiaohongshu_final.py .
COPY stealth.min.js .

# 安装 Playwright 浏览器
RUN playwright install chromium
RUN playwright install-deps chromium

CMD ["python", "xiaohongshu_final.py"]
```

### requirements.txt

```
playwright>=1.40.0
requests>=2.31.0
xhshow>=0.1.0  # 或从 GitHub 安装
```

### 环境变量

```bash
# Cookie（建议通过环境变量传递）
XIAOHONGSHU_COOKIE="abRequestId=...; a1=...; web_session=...; id_token=..."

# 运行模式
HEADLESS=true  # Docker 环境设为 true
```

## 已知问题和解决方案

### 问题 1: 搜索 API 返回 0 条
**现象**：API 返回成功但 items 为空

**原因**：`page_size` 参数 < 10

**解决**：始终使用 `page_size >= 10`

### 问题 2: 详情页返回"未找到数据"
**现象**：页面加载成功但提取不到数据

**原因**：数据结构变化，`currentNote` 已废弃

**解决**：从 `note.noteDetailMap` 中提取数据

### 问题 3: 无头模式被检测
**现象**：返回错误码 300015（浏览器环境异常）

**原因**：缺少 stealth.min.js 或 Cookie 不完整

**解决**：
1. 确保注入 stealth.min.js
2. Cookie 包含 a1, web_session, id_token
3. 访问详情页时携带 xsec_token

### 问题 4: navigator.webdriver 未被覆盖
**现象**：stealth 检测失败

**原因**：playwright-stealth 库 API 变化

**解决**：直接使用 stealth.min.js 脚本，不依赖 playwright-stealth 插件

## 测试验证

### 运行端到端测试

```bash
python3.10 test_end_to_end.py
```

**期望输出**：
```
✅ 搜索返回 10 条结果
✅ 成功获取详情：10/10 条
🎉 所有测试通过！可以安全部署！
```

### 测试检查清单

- [x] xhshow 签名生成成功
- [x] 搜索 API 返回正确数量的笔记
- [x] Cookie 完整性检查通过
- [x] stealth.min.js 注入成功
- [x] navigator.webdriver 被正确覆盖
- [x] 详情页数据提取成功
- [x] 完整流程（搜索 + 详情）通过

## 性能优化建议

1. **浏览器实例复用**：避免频繁启动/关闭浏览器
2. **请求限流**：在搜索和详情请求之间添加随机休眠（1-3 秒）
3. **错误重试**：为网络请求添加重试机制（建议 3 次）
4. **并发控制**：同时打开的页面不超过 5 个

## 安全建议

1. **Cookie 保护**：不要将 Cookie 提交到版本控制
2. **IP 限流**：避免短时间内大量请求
3. **User-Agent 轮换**：准备多个 User-Agent 字符串
4. **Cookie 轮换**：实现 Cookie 池管理（高级功能）

## 总结

本项目成功实现了：
- ✅ 混合架构：搜索（API）+ 详情（浏览器）
- ✅ 无头模式支持：适合 Docker 部署
- ✅ 反检测：stealth.min.js + 正确的 Cookie
- ✅ 数据提取：从 noteDetailMap 提取完整数据
- ✅ 完整测试：端到端测试验证所有功能

可以直接部署到群晖 NAS Docker 环境！
