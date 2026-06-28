# 小红书 API 快速参考

> 快速查阅版 - 关键信息速查

## 🔑 核心要点

```
搜索 API → 获取 xsec_token → 详情 API
```

**没有 xsec_token 无法获取笔记详情！**

---

## 📋 API 端点速查

| API | Host | URI | 方法 | x_rap |
|-----|------|-----|------|-------|
| 搜索 | `so.xiaohongshu.com` | `/api/sns/web/v2/search/notes` | POST | ❌ |
| 详情 | `edith.xiaohongshu.com` | `/api/sns/web/v1/feed` | POST | ✅ |
| 推荐 | `edith.xiaohongshu.com` | `/api/sns/web/v1/search/recommend` | GET | ❌ |

---

## 💻 最小可用代码

### 搜索笔记

```python
from xhshow import Xhshow
import requests

client = Xhshow()
cookies = {"a1": "...", "web_session": "..."}

payload = {
    "keyword": "奥迪 Q5L",
    "page": 1,
    "page_size": 20,
    "search_id": client.get_search_request_id(),
    "sort": "general",
    "note_type": 0,
    "image_formats": ["jpg", "webp", "avif"],
    "geo": "",
    "message_id": "",
    "ext_flags": [],
    "filters": [
        {"tags": ["general"], "type": "sort_type"},
        {"tags": ["不限"], "type": "filter_note_type"}
    ]
}

headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v2/search/notes",
    cookies=cookies,
    payload=payload,
    x_rap=False
)

response = requests.post(
    "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
    headers=headers,
    cookies=cookies,
    json=payload
)
```

### 获取详情

```python
# 从搜索结果获取
note_id = "6a2639e9000000003503b94a"
xsec_token = "ABvUeJ1w98CTdDYu3QHtvcQApprp6MqC1nugn5cDgkcCU="

detail_payload = {
    "source_note_id": note_id,
    "image_formats": ["jpg", "webp", "avif"],
    "extra": {"need_body_topic": "1"},
    "xsec_source": "pc_search",  # 必需
    "xsec_token": xsec_token      # 必需
}

detail_headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v1/feed",
    cookies=cookies,
    payload=detail_payload,
    x_rap=True
)

response = requests.post(
    "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
    headers=detail_headers,
    cookies=cookies,
    json=detail_payload
)
```

---

## 🎯 关键参数

### 搜索参数
- `keyword`: 搜索词
- `page`: 页码（1-50）
- `page_size`: 每页数量（最大 20）
- `sort`: `general` / `popularity` / `time`
- `note_type`: `0` 不限 / `1` 图文 / `2` 视频

### 详情参数
- `source_note_id`: 笔记 ID
- `xsec_token`: 从搜索获取 ⚠️
- `xsec_source`: 固定为 `pc_search`

---

## ❌ 常见错误

| 错误 | 原因 | 解决 |
|-----|------|------|
| HTTP 461 | 笔记无法访问 | 换其他笔记 |
| HTTP 500 | 缺少 xsec_token | 先调用搜索 API |
| HTTP 400 | 参数错误 | 检查必需参数 |
| HTTP 401 | Cookie 失效 | 重新登录获取 Cookie |

---

## 📦 工具类（复制即用）

```python
from xhshow import Xhshow
import requests

class XhsClient:
    def __init__(self, cookie: str):
        self.client = Xhshow()
        self.cookie_dict = {
            item.split("=")[0]: item.split("=")[1] 
            for item in cookie.split("; ")
        }
    
    def search(self, keyword, page=1, page_size=20):
        payload = {
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
            "search_id": self.client.get_search_request_id(),
            "sort": "general",
            "note_type": 0,
            "image_formats": ["jpg", "webp", "avif"],
            "geo": "",
            "message_id": "",
            "ext_flags": [],
            "filters": [
                {"tags": ["general"], "type": "sort_type"},
                {"tags": ["不限"], "type": "filter_note_type"}
            ]
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v2/search/notes",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=False
        )
        headers["Content-Type"] = "application/json"
        
        r = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        return r.json()
    
    def get_detail(self, note_id, xsec_token):
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"],
            "extra": {"need_body_topic": "1"},
            "xsec_source": "pc_search",
            "xsec_token": xsec_token
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v1/feed",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=True
        )
        headers["Content-Type"] = "application/json"
        
        r = requests.post(
            "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        return r.json()
    
    def search_and_detail(self, keyword):
        """一键搜索并获取第一个笔记详情"""
        result = self.search(keyword)
        note = result['data']['items'][0]
        return self.get_detail(note['id'], note['xsec_token'])
```

---

## 🚀 使用示例

```python
client = XhsClient("你的 Cookie")

# 搜索
result = client.search("Python 编程")

# 获取详情
detail = client.search_and_detail("Python 编程")
print(detail['data']['items'][0]['note_card']['title'])
```

---

## 📝 Cookie 获取步骤

1. 打开 www.xiaohongshu.com
2. 登录账号
3. F12 开发者工具
4. Network 标签
5. 复制任意请求的 Cookie

**必需字段**：`a1`, `web_session`, `id_token`, `webId`

---

## ⚠️ 注意事项

- Cookie 有效期：1-7 天
- 请求间隔：建议 1-2 秒
- 分页限制：最多 50 页
- 合规使用：遵守平台规则

---

## 📚 完整文档

详细文档：`小红书 API 技术文档.md`
