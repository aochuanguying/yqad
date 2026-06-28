# xhshow 使用说明与限制

**日期**: 2026-06-28  
**xhshow 版本**: 0.2.0

---

## ✅ 一、xhshow 支持的 API

### 1. 搜索 API（已验证可用）⭐

**端点**: `POST https://so.xiaohongshu.com/api/sns/web/v2/search/notes`

**使用方法**:
```python
from xhshow import Xhshow
import requests

client = Xhshow()
cookie_dict = {"a1": "...", "web_session": "..."}

# 生成 search_id
search_id = client.get_search_id()

# 请求参数
payload = {
    "keyword": "汽车评测",
    "page": 1,
    "page_size": 10,
    "search_id": search_id,
    "sort": "general",
    "note_type": 0
}

# 生成 headers
headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v2/search/notes",
    cookies=cookie_dict,
    payload=payload,
    x_rap=False
)

# 发送请求
response = requests.post(
    "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
    headers=headers,
    json=payload,
    cookies=cookie_dict
)
```

**测试结果**: ✅ 完全可用，返回 10 条笔记

---

### 2. 详情 API（需要高权限）⚠️

**端点**: `POST https://www.xiaohongshu.com/api/sns/web/v2/feed`

**使用方法**:
```python
from xhshow import Xhshow
import requests

client = Xhshow()
cookie_dict = {"a1": "...", "web_session": "...", "id_token": "..."}

# 请求参数
payload = {
    "source_note_id": note_id,
    "image_formats": ["jpg", "webp", "avif"]
}

# 生成 headers（关键：x_rap=True）
headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v2/feed",
    cookies=cookie_dict,
    payload=payload,
    x_rap=True  # feed 端点需要 x-rap-param
)

# 发送请求
response = requests.post(
    "https://www.xiaohongshu.com/api/sns/web/v2/feed",
    headers=headers,
    json=payload,
    cookies=cookie_dict
)
```

**测试结果**: ❌ HTTP 500 - "create invoker failed, service: jarvis-gateway-default"

**失败原因**:
1. Cookie 权限不足
2. 需要企业账号或特殊权限
3. jarvis-gateway 服务需要额外认证

---

## 🔧 二、xhshow 核心方法

### 2.1 签名方法

```python
# 通用签名方法
client.sign_xs(
    method="POST",        # GET 或 POST
    uri="/api/...",       # API 端点
    a1_value="...",       # Cookie 中的 a1 值
    xsec_appid="xhs-pc-web",
    payload={},           # POST 数据或 GET 参数
    timestamp=None        # 可选，默认当前时间
)

# 生成完整 headers（推荐）
headers = client.sign_headers(
    method="POST",
    uri="/api/...",
    cookies=cookie_dict,  # Cookie 字典
    payload={},
    x_rap=False,          # 是否需要 x-rap-param（feed/search 端点需要）
    sign_format="xys",    # xys 或 xyw
    user_id=None          # 用于分片
)
```

### 2.2 辅助方法

```python
# 生成 search_id
search_id = client.get_search_id()

# 生成时间戳
x_t = client.get_x_t(timestamp)

# 生成 trace ID
x_b3_traceid = client.get_b3_trace_id()
x_xray_traceid = client.get_xray_trace_id(timestamp)

# 构建 URL
url = client.build_url("https://example.com", params={"key": "value"})

# 构建 JSON body
json_body = client.build_json_body(payload)
```

---

## ⚠️ 三、API 限制与权限

### 3.1 搜索 API

**权限要求**: ⭐⭐ (低)
- 普通登录账号即可
- Cookie 包含 a1 和 web_session
- 无特殊权限要求

**调用限制**:
- page_size 必须 >= 10
- 需要控制频率（建议间隔 1-3 秒）

---

### 3.2 详情 API

**权限要求**: ⭐⭐⭐⭐⭐ (高)
- 需要完整登录态
- 可能需要企业账号
- jarvis-gateway 服务需要额外认证

**错误信息**:
```
HTTP 500: create invoker failed, service: jarvis-gateway-default
```

**可能需要的额外条件**:
1. 更完整的 Cookie（包含 jarvis 相关 token）
2. 企业账号认证
3. 先在浏览器中访问过目标笔记
4. 使用移动端 API 而非 Web API

---

## 💡 四、替代方案

### 4.1 使用搜索 API 代替详情 API

**搜索返回的数据已包含**:
```json
{
  "id": "笔记 ID",
  "title": "标题",
  "desc": "描述",
  "user": {
    "nickname": "作者",
    "user_id": "用户 ID"
  },
  "interact_info": {
    "liked_count": "点赞数",
    "collected_count": "收藏数",
    "comment_count": "评论数"
  },
  "cover": {
    "url": "封面图 URL"
  },
  "url": "笔记链接"
}
```

**对于发帖场景已经足够**:
- ✅ 标题 → 参考选题
- ✅ 描述 → 参考内容
- ✅ 互动数据 → 判断热度
- ✅ 封面图 → 参考图片

---

### 4.2 使用 Playwright 获取详情

**如果确实需要详情**:
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # 使用有头模式
    context = browser.new_context()
    context.add_cookies([...])  # 设置完整 Cookie
    
    page = context.new_page()
    page.goto(f"https://www.xiaohongshu.com/explore/{note_id}")
    page.wait_for_timeout(5000)
    
    # 提取数据
    detail = page.evaluate('''() => {
        return {
            title: document.querySelector('h1.title')?.textContent,
            desc: document.querySelector('.desc')?.textContent,
            // ...
        };
    }''')
    
    browser.close()
```

**缺点**:
- 速度慢（5-10 秒）
- 需要浏览器依赖
- 可能触发反爬

---

## 📋 五、完整示例

### 5.1 搜索笔记

```python
#!/usr/bin/env python3
from xhshow import Xhshow
import requests

# 配置
COOKIE = "a1=...; web_session=..."
KEYWORD = "汽车评测"
LIMIT = 10

# Cookie 处理
cookie_dict = {}
for item in COOKIE.split(';'):
    if '=' in item:
        key, value = item.split('=', 1)
        cookie_dict[key.strip()] = value.strip()

# 初始化
client = Xhshow()
search_id = client.get_search_id()

# 请求参数
payload = {
    "keyword": KEYWORD,
    "page": 1,
    "page_size": max(LIMIT, 10),
    "search_id": search_id,
    "sort": "general",
    "note_type": 0
}

# 生成 headers
headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v2/search/notes",
    cookies=cookie_dict,
    payload=payload,
    x_rap=False
)

headers.update({
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "content-type": "application/json;charset=UTF-8",
})

# 发送请求
response = requests.post(
    "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
    headers=headers,
    json=payload,
    cookies=cookie_dict,
    timeout=30
)

if response.status_code == 200:
    result = response.json()
    if result.get('success'):
        items = result.get('data', {}).get('items', [])
        print(f"找到 {len(items)} 条笔记")
        
        for item in items:
            note_data = item.get('note_card', {}) or item.get('model', {})
            title = note_data.get('display_title', '')
            user = note_data.get('user', {}).get('nickname', '')
            liked = note_data.get('interact_info', {}).get('liked_count', 0)
            print(f"- {title} by {user} (点赞：{liked})")
```

---

## 🎯 六、总结与建议

### 6.1 当前可用方案

| API | 状态 | 权限要求 | 推荐度 |
|-----|------|----------|--------|
| 搜索笔记 | ✅ 可用 | 低 | ⭐⭐⭐⭐⭐ |
| 获取详情 | ❌ 需要高权限 | 高 | ⭐ |
| 发布笔记 | ⚠️ 未测试 | 未知 | - |

### 6.2 对于发帖需求

**强烈建议仅使用搜索 API**:
1. ✅ 数据已足够（标题、描述、互动数据、封面图）
2. ✅ 技术成熟稳定
3. ✅ 无需高权限 Cookie
4. ✅ 性能优秀（2-5 秒）

**详情获取的额外价值有限**:
- 主要是更详细的描述和更多图片
- 对于 AI 生成内容来说，搜索数据已足够
- 实现复杂度高，需要特殊权限

### 6.3 下一步

**立即可用**:
- 使用搜索 API 获取笔记列表
- 从搜索结果中提取需要的信息
- 集成到发帖流程

**后续优化**（如确实需要详情）:
- 研究 jarvis-gateway 认证机制
- 获取更完整的 Cookie
- 考虑使用移动端 API
- 或使用 Playwright 网页抓取

---

**文档生成时间**: 2026-06-28  
**维护者**: YQAD Team
