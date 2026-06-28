# 小红书 API 完整使用指南

基于 xhshow 库的小红书 API 调用完整指南。

## 目录

- [API 列表](#api-列表)
- [环境准备](#环境准备)
- [API 调用示例](#api-调用示例)
- [常见问题](#常见问题)

## API 列表

| API 名称 | 端点 | 方法 | 状态 | 说明 |
|---------|------|------|------|------|
| 搜索笔记 | `/api/sns/web/v2/search/notes` | POST | ✅ 可用 | 搜索笔记列表 |
| 笔记详情 | `/api/sns/web/v1/feed` | POST | ✅ 可用 | 获取单个笔记详情 |
| 搜索推荐 | `/api/sns/web/v1/search/recommend` | GET | ✅ 可用 | 获取搜索建议词 |

## 环境准备

### 1. 安装依赖

```bash
pip install xhshow requests
```

### 2. 准备 Cookie

从浏览器开发者工具中复制完整的 Cookie 字符串，需要包含：
- `a1` - 设备标识
- `web_session` - 会话标识
- `id_token` - 用户身份令牌

示例：
```python
COOKIE = "abRequestId=xxx; a1=xxx; web_session=xxx; id_token=xxx; ..."
```

## API 调用示例

### 1. 搜索笔记

```python
from xhshow import Xhshow
import requests

client = Xhshow()
cookie_dict = {"a1": "...", "web_session": "...", ...}  # 解析 Cookie

# 搜索参数
payload = {
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
headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v2/search/notes",
    cookies=cookie_dict,
    payload=payload,
    x_rap=False
)
headers["Content-Type"] = "application/json"

# 发送请求
response = requests.post(
    "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
    headers=headers,
    cookies=cookie_dict,
    json=payload
)

result = response.json()
print(f"搜索到 {len(result['data']['items'])} 条笔记")
```

**返回数据结构**：
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

### 2. 获取笔记详情

**重要**：必须先调用搜索 API 获取 `xsec_token`！

```python
# 从搜索结果中获取
note_id = "6a2639e9000000003503b94a"
xsec_token = "ABvUeJ1w98CTdDYu3QHtvcQApprp6MqC1nugn5cDgkcCU="

# 详情参数
detail_payload = {
    "source_note_id": note_id,
    "image_formats": ["jpg", "webp", "avif"],
    "extra": {"need_body_topic": "1"},
    "xsec_source": "pc_search",  # 必需
    "xsec_token": xsec_token      # 必需
}

# 生成签名 headers
detail_headers = client.sign_headers(
    method="POST",
    uri="/api/sns/web/v1/feed",
    cookies=cookie_dict,
    payload=detail_payload,
    x_rap=True  # feed 端点需要 x-rap-param
)
detail_headers["Content-Type"] = "application/json"

# 发送请求
detail_response = requests.post(
    "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
    headers=detail_headers,
    cookies=cookie_dict,
    json=detail_payload
)

detail_result = detail_response.json()
note = detail_result['data']['items'][0]['note_card']
print(f"标题：{note['title']}")
print(f"描述：{note['desc']}")
```

**返回数据结构**：
```json
{
  "data": {
    "items": [
      {
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

### 3. 搜索推荐

```python
from urllib.parse import quote

keyword = "奥迪 Q5L"
encoded_keyword = quote(keyword)
uri = f"/api/sns/web/v1/search/recommend?keyword={encoded_keyword}"

# 生成签名 headers
headers = client.sign_headers(
    method="GET",
    uri=uri,
    cookies=cookie_dict,
    params={"keyword": keyword},
    x_rap=False
)

# 发送请求
response = requests.get(
    f"https://edith.xiaohongshu.com{uri}",
    headers=headers,
    cookies=cookie_dict,
    params={"keyword": keyword}
)

result = response.json()
print(f"推荐词：{[item['text'] for item in result['data']['sug_items']]}")
```

**返回示例**：
```json
{
  "data": {
    "sug_items": [
      {
        "text": "奥迪 q5l 落地价",
        "search_type": "notes",
        "type": "top_note"
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

## 完整工具类

```python
from xhshow import Xhshow
import requests

class XhsClient:
    """小红书客户端"""
    
    def __init__(self, cookie: str):
        self.client = Xhshow()
        self.cookie_dict = self._parse_cookie(cookie)
    
    def _parse_cookie(self, cookie: str) -> dict:
        """解析 Cookie 字符串为字典"""
        cookie_dict = {}
        for item in cookie.split("; "):
            if "=" in item:
                key, value = item.split("=", 1)
                cookie_dict[key] = value
        return cookie_dict
    
    def search_notes(self, keyword: str, page: int = 1, page_size: int = 10):
        """搜索笔记"""
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
        
        response = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        return response.json()
    
    def get_note_detail(self, note_id: str, xsec_token: str):
        """获取笔记详情"""
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
        
        response = requests.post(
            "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        return response.json()
    
    def get_search_recommend(self, keyword: str):
        """获取搜索推荐"""
        from urllib.parse import quote
        
        encoded_keyword = quote(keyword)
        uri = f"/api/sns/web/v1/search/recommend?keyword={encoded_keyword}"
        
        headers = self.client.sign_headers(
            method="GET",
            uri=uri,
            cookies=self.cookie_dict,
            params={"keyword": keyword},
            x_rap=False
        )
        
        response = requests.get(
            f"https://edith.xiaohongshu.com{uri}",
            headers=headers,
            cookies=self.cookie_dict,
            params={"keyword": keyword}
        )
        
        return response.json()
    
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
# 初始化客户端
COOKIE = "你的 Cookie 字符串"
client = XhsClient(COOKIE)

# 示例 1: 搜索笔记
print("=== 搜索笔记 ===")
search_result = client.search_notes("Python 编程")
for i, item in enumerate(search_result['data']['items'][:3], 1):
    print(f"{i}. {item['note_card'].get('display_title', '无标题')}")

# 示例 2: 获取搜索推荐
print("\n=== 搜索推荐 ===")
recommend = client.get_search_recommend("奥迪")
for item in recommend['data']['sug_items']:
    print(f"- {item['text']}")

# 示例 3: 一键获取详情
print("\n=== 笔记详情 ===")
detail = client.search_and_get_detail("Python 编程")
note_card = detail['note_card']
print(f"标题：{note_card['title']}")
print(f"描述：{note_card['desc'][:50]}...")
print(f"用户：{note_card['user']['nickname']}")
print(f"点赞：{note_card['interact_info']['liked_count']}")
```

## 常见问题

### 1. HTTP 461 - 当前笔记暂时无法浏览

**原因**：
- 笔记被作者删除
- 笔记正在审核
- 笔记权限设置（仅粉丝可见等）

**解决方案**：尝试其他笔记 ID

### 2. HTTP 500 - jarvis-gateway 错误

**原因**：
- 缺少 `xsec_token` 参数
- `xsec_token` 与笔记 ID 不匹配
- `xsec_token` 已过期

**解决方案**：重新调用搜索 API 获取最新的 `xsec_token`

### 3. HTTP 400 - 参数错误

**原因**：
- 参数格式不正确
- 必需参数缺失

**解决方案**：检查请求参数，确保包含所有必需字段

### 4. Cookie 失效

**症状**：所有 API 返回 401 或认证失败

**解决方案**：
1. 重新登录小红书网页版
2. 从浏览器复制最新的 Cookie
3. 更新代码中的 Cookie 字符串

## 注意事项

1. **Cookie 时效性**：Cookie 会过期，建议定期更新
2. **xsec_token 时效性**：搜索后立即使用，不要长时间保存
3. **请求频率**：避免短时间内大量请求，建议添加延时
4. **笔记状态**：部分笔记可能无法访问，需要错误处理

## 总结

✅ **搜索 API**：完全可用，推荐使用  
✅ **详情 API**：需要配合搜索获取的 `xsec_token` 使用  
✅ **搜索推荐**：可用，用于获取搜索建议  
✅ **最佳实践**：使用工具类封装，统一错误处理
