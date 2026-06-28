# xhshow 获取详情 API 完整解析

## 核心发现

**关键参数**：获取笔记详情必须使用 `xsec_token`，该 token 需要从搜索 API 中获取。

## 完整流程

### 步骤 1: 搜索笔记获取 xsec_token

```python
from xhshow import Xhshow
import requests

client = Xhshow()
cookie_dict = {"a1": "...", "web_session": "...", ...}

# 搜索参数
search_payload = {
    "keyword": "Python 编程",
    "page": 1,
    "page_size": 10,
    "search_id": client.get_search_request_id(),
    "extend": {
        "title_encoding": 1,
        "desc_encoding": 1
    }
}

# 生成签名 headers
search_headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v2/search/notes",
    cookies=cookie_dict,
    payload=search_payload,
    x_rap=False  # 搜索端点不需要 x-rap-param
)

# 发送请求
search_response = requests.post(
    "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
    headers=search_headers,
    cookies=cookie_dict,
    json=search_payload
)

# 提取笔记信息
first_note = search_response.json()['data']['items'][0]
note_id = first_note['id']
xsec_token = first_note['xsec_token']  # 关键！
```

### 步骤 2: 使用 xsec_token 获取详情

```python
# 详情参数 - 必须包含 xsec_source 和 xsec_token
detail_payload = {
    "source_note_id": note_id,
    "image_formats": ["jpg", "webp", "avif"],
    "extra": {"need_body_topic": "1"},
    "xsec_source": "pc_search",  # 必需
    "xsec_token": xsec_token      # 必需，从搜索获取
}

# 生成签名 headers
detail_headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v1/feed",
    cookies=cookie_dict,
    payload=detail_payload,
    x_rap=True  # feed 端点需要 x-rap-param
)

# 发送请求
detail_response = requests.post(
    "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
    headers=detail_headers,
    cookies=cookie_dict,
    json=detail_payload
)
```

## 关键要点

### 1. 必需的参数组合
- `xsec_source`: 标识来源，通常为 `pc_search`
- `xsec_token`: 从搜索 API 返回的笔记数据中获取

### 2. API 端点选择
- **搜索**: `https://so.xiaohongshu.com/api/sns/web/v2/search/notes`
- **详情**: `https://edith.xiaohongshu.com/api/sns/web/v1/feed`

### 3. x_rap 参数设置
- 搜索端点：`x_rap=False`
- 详情端点：`x_rap=True`

### 4. 错误处理

常见错误：
- **HTTP 461** - 笔记无法访问（笔记被删除或权限不足）
- **HTTP 500** - jarvis-gateway 错误（缺少 xsec_token 或 token 不匹配）
- **HTTP 400** - 参数错误（检查参数格式）

## 返回数据结构

### 搜索返回结构
```json
{
  "data": {
    "items": [
      {
        "id": "6a2639e9000000003503b94a",
        "xsec_token": "ABvUeJ1w98CTdDYu3QHtvcQApprp6MqC1nugn5cDgkcCU=",
        "note_card": {
          "display_title": "标题",
          "type": "normal",
          "image_list": [...],
          "user": {...},
          "interact_info": {...}
        }
      }
    ]
  }
}
```

### 详情返回结构
```json
{
  "data": {
    "items": [
      {
        "id": "6a2639e9000000003503b94a",
        "note_card": {
          "title": "完整标题",
          "desc": "#标签# 内容描述",
          "user": {
            "user_id": "...",
            "nickname": "...",
            "avatar": "..."
          },
          "image_list": [
            {
              "info_list": [{"url": "图片 URL"}]
            }
          ],
          "tag_list": [...],
          "time": 1780890089000,
          "interact_info": {
            "liked_count": "286",
            "collected_count": "378",
            "comment_count": "479"
          }
        }
      }
    ]
  }
}
```

## 完整工具类

```python
from xhshow import Xhshow
import requests

class XhsClient:
    def __init__(self, cookie: str):
        self.client = Xhshow()
        self.cookie_dict = self._parse_cookie(cookie)
    
    def _parse_cookie(self, cookie: str) -> dict:
        cookie_dict = {}
        for item in cookie.split("; "):
            if "=" in item:
                key, value = item.split("=", 1)
                cookie_dict[key] = value
        return cookie_dict
    
    def search_notes(self, keyword: str, page: int = 1, page_size: int = 10):
        payload = {
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
            "search_id": self.client.get_search_request_id(),
            "extend": {"title_encoding": 1, "desc_encoding": 1}
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v2/search/notes",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=False
        )
        headers["Content-Type"] = "application/json"
        
        return requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        ).json()
    
    def get_note_detail(self, note_id: str, xsec_token: str):
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
        
        return requests.post(
            "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        ).json()
    
    def search_and_get_detail(self, keyword: str):
        """搜索并获取第一个笔记的详情"""
        search_result = self.search_notes(keyword)
        
        if not search_result.get('data') or not search_result['data'].get('items'):
            raise Exception("搜索失败")
        
        first_note = search_result['data']['items'][0]
        note_id = first_note['id']
        xsec_token = first_note.get('xsec_token')
        
        if not xsec_token:
            raise Exception("未获取到 xsec_token")
        
        detail_result = self.get_note_detail(note_id, xsec_token)
        
        if not detail_result.get('data') or not detail_result['data'].get('items'):
            raise Exception(f"获取详情失败：{detail_result.get('msg')}")
        
        return detail_result['data']['items'][0]
```

## 使用示例

```python
COOKIE = "你的 Cookie 字符串"
client = XhsClient(COOKIE)

# 方法 1: 分步执行
search_result = client.search_notes("Python 编程")
note = search_result['data']['items'][0]
detail = client.get_note_detail(note['id'], note['xsec_token'])

# 方法 2: 一键获取
detail = client.search_and_get_detail("Python 编程")
print(f"标题：{detail['note_card']['title']}")
print(f"描述：{detail['note_card']['desc']}")
print(f"用户：{detail['note_card']['user']['nickname']}")
```

## 注意事项

1. **Cookie 要求**：需要有效的登录 Cookie，包含 `a1`, `web_session`, `id_token` 等关键字段
2. **xsec_token 时效性**：token 有时效限制，建议搜索后立即使用
3. **笔记状态**：某些笔记可能因作者设置或平台审核无法访问
4. **API 限制**：频繁调用可能触发风控，建议添加请求间隔

## 其他相关 API

### 搜索推荐 API

获取搜索建议/推荐词列表。

**请求示例**：

```python
def get_search_recommend(keyword: str):
    """获取搜索推荐"""
    from urllib.parse import quote
    
    encoded_keyword = quote(keyword)
    uri = f"/api/sns/web/v1/search/recommend?keyword={encoded_keyword}"
    
    headers = client.sign_headers(
        method="GET",
        uri=uri,
        cookies=cookie_dict,
        params={"keyword": keyword},
        x_rap=False
    )
    
    response = requests.get(
        f"https://edith.xiaohongshu.com{uri}",
        headers=headers,
        cookies=cookie_dict,
        params={"keyword": keyword}
    )
    
    return response.json()
```

**返回示例**：

```json
{
  "data": {
    "search_cpl_id": "8794dc9b87ca3d93e0f33d366a413a7a",
    "word_request_id": "1173cda8-c799-498d-8375-3fa2185d915c#1782659706176",
    "sug_items": [
      {
        "search_type": "notes",
        "type": "top_note",
        "text": "奥迪 q5l 落地价",
        "highlight_flags": [true, true, true, true, true, false, false, false]
      },
      {
        "text": "奥迪 q5l2026 全新换代",
        "search_type": "notes",
        "type": "top_note"
      }
    ]
  }
}
```

## 总结

✅ **搜索 API** (`/api/sns/web/v2/search/notes`)：完全可用，返回笔记列表和基础信息  
✅ **详情 API** (`/api/sns/web/v1/feed`)：需要配合搜索获取的 `xsec_token` 使用  
✅ **搜索推荐 API** (`/api/sns/web/v1/search/recommend`)：可用，返回搜索建议词列表  
✅ **数据完整性**：详情 API 返回完整的笔记内容、图片、标签、互动数据等  
✅ **推荐方案**：使用 `搜索 + 详情` 的组合方式获取笔记信息
