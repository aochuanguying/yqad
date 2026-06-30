# 小红书 API 完整指南

> 小红书数据抓取一站式完整指南  
> **最后更新**: 2026-06-29  
> **状态**: ✅ 所有功能已验证通过并投入生产使用  
> **技术方案**: xhshow + requests 纯 API 方案

---

## 📖 目录

- [快速开始](#快速开始)
- [核心要点](#核心要点)
- [环境准备](#环境准备)
- [API 详解](#api-详解)
- [完整代码](#完整代码)
- [高级功能](#高级功能)
- [Cookie 管理](#cookie-管理)
- [Docker 部署](#docker-部署)
- [常见问题](#常见问题)
- [最佳实践](#最佳实践)

---

## 🚀 快速开始

### 5 分钟上手

```bash
# 1. 安装依赖
pip install xhshow requests mysql-connector-python

# 2. 获取 Cookie (从浏览器开发者工具)
# 访问 https://www.xiaohongshu.com → F12 → Network → 复制 Cookie

# 3. 运行测试
python3 -c "
from xhshow import Xhshow
import requests

client = Xhshow()
cookies = {'a1': 'your_a1', 'web_session': 'your_session'}

# 搜索
payload = {
    'keyword': '奥迪 Q5L',
    'page': 1,
    'page_size': 20,
    'search_id': client.get_search_request_id(),
    'sort': 'general',
    'note_type': 0,
    'image_formats': ['jpg', 'webp', 'avif'],
    'geo': '',
    'message_id': '',
    'ext_flags': [],
    'filters': [
        {'tags': ['general'], 'type': 'sort_type'},
        {'tags': ['不限'], 'type': 'filter_note_type'}
    ]
}

headers = client.sign_headers(
    method='POST',
    uri='/api/sns/web/v2/search/notes',
    cookies=cookies,
    payload=payload,
    x_rap=False
)

response = requests.post(
    'https://so.xiaohongshu.com/api/sns/web/v2/search/notes',
    headers=headers,
    cookies=cookies,
    json=payload
)

print(response.json())
"
```

### 一键搜索并获取详情

```python
from xhshow import Xhshow
import requests

class XhsClient:
    def __init__(self, cookie: str):
        self.client = Xhshow()
        self.cookie_dict = {
            item.split('=')[0]: item.split('=')[1] 
            for item in cookie.split('; ')
        }
    
    def search_and_detail(self, keyword):
        """一键搜索并获取第一个笔记详情"""
        # 搜索
        payload = {
            'keyword': keyword,
            'page': 1,
            'page_size': 20,
            'search_id': self.client.get_search_request_id(),
            'sort': 'general',
            'note_type': 0,
            'image_formats': ['jpg', 'webp', 'avif'],
            'geo': '',
            'message_id': '',
            'ext_flags': [],
            'filters': [
                {'tags': ['general'], 'type': 'sort_type'},
                {'tags': ['不限'], 'type': 'filter_note_type'}
            ]
        }
        
        headers = self.client.sign_headers(
            method='POST',
            uri='/api/sns/web/v2/search/notes',
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=False
        )
        headers['Content-Type'] = 'application/json'
        
        response = requests.post(
            'https://so.xiaohongshu.com/api/sns/web/v2/search/notes',
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        result = response.json()
        note = result['data']['items'][0]
        
        # 获取详情
        detail_payload = {
            'source_note_id': note['id'],
            'image_formats': ['jpg', 'webp', 'avif'],
            'extra': {'need_body_topic': '1'},
            'xsec_source': 'pc_search',
            'xsec_token': note['xsec_token']
        }
        
        detail_headers = self.client.sign_headers(
            method='POST',
            uri='/api/sns/web/v1/feed',
            cookies=self.cookie_dict,
            payload=detail_payload,
            x_rap=True
        )
        detail_headers['Content-Type'] = 'application/json'
        
        response = requests.post(
            'https://edith.xiaohongshu.com/api/sns/web/v1/feed',
            headers=detail_headers,
            cookies=self.cookie_dict,
            json=detail_payload
        )
        
        return response.json()['data']['items'][0]

# 使用示例
client = XhsClient('你的 Cookie 字符串')
detail = client.search_and_detail('奥迪 Q5L')
print(f"标题：{detail['note_card']['title']}")
print(f"图片：{len(detail['note_card']['image_list'])} 张")
```

---

## 🎯 核心要点

### 技术架构

```
搜索 API → 获取 xsec_token → 详情 API → 完整数据
```

**⚠️ 没有 xsec_token 无法获取笔记详情！**

### API 端点速查

| API | Host | URI | 方法 | x_rap |
|-----|------|-----|------|-------|
| 搜索 | `so.xiaohongshu.com` | `/api/sns/web/v2/search/notes` | POST | ❌ |
| 详情 | `edith.xiaohongshu.com` | `/api/sns/web/v1/feed` | POST | ✅ |
| 推荐 | `edith.xiaohongshu.com` | `/api/sns/web/v1/search/recommend` | GET | ❌ |

### 关键参数

**搜索参数**:
- `keyword`: 搜索关键词
- `page`: 页码 (1-50)
- `page_size`: 每页数量 (最大 20)
- `sort`: `general` / `popularity` / `time`
- `note_type`: `0` 不限 / `1` 图文 / `2` 视频

**详情参数**:
- `source_note_id`: 笔记 ID
- `xsec_token`: 从搜索 API 获取 ⚠️
- `xsec_source`: 固定为 `pc_search`

### 常见错误

| 错误 | 原因 | 解决 |
|-----|------|------|
| HTTP 461 | 笔记无法访问 | 换其他笔记 |
| HTTP 500 | 缺少 xsec_token | 先调用搜索 API |
| HTTP 400 | 参数错误 | 检查必需参数 |
| HTTP 401 | Cookie 失效 | 重新登录获取 Cookie |

---

## 🛠️ 环境准备

### 1. 安装依赖

```bash
pip install xhshow requests mysql-connector-python
```

### 2. 获取 Cookie

**步骤**:
1. 打开小红书网页版 (www.xiaohongshu.com)
2. 登录账号
3. 按 F12 打开开发者工具
4. 在 Network 标签中找到任意请求
5. 复制 Request Headers 中的 Cookie 字段

**必需的 Cookie 字段**:
- `a1` - 设备标识
- `web_session` - 会话标识  
- `id_token` - 用户身份令牌
- `webId` - 用户 ID

**示例**:
```python
COOKIE = "abRequestId=xxx; a1=xxx; web_session=xxx; id_token=xxx; webId=xxx; ..."
```

### 3. 验证 Cookie

```python
def test_cookie(cookie: str) -> bool:
    """测试 Cookie 是否有效"""
    client = Xhshow()
    cookie_dict = {item.split('=')[0]: item.split('=')[1] for item in cookie.split('; ')}
    
    payload = {
        'keyword': 'test',
        'page': 1,
        'page_size': 1,
        'search_id': client.get_search_request_id(),
        'sort': 'general',
        'note_type': 0,
        'image_formats': ['jpg'],
        'geo': '',
        'message_id': '',
        'ext_flags': [],
        'filters': [
            {'tags': ['general'], 'type': 'sort_type'},
            {'tags': ['不限'], 'type': 'filter_note_type'}
        ]
    }
    
    headers = client.sign_headers(
        method='POST',
        uri='/api/sns/web/v2/search/notes',
        cookies=cookie_dict,
        payload=payload,
        x_rap=False
    )
    
    response = requests.post(
        'https://so.xiaohongshu.com/api/sns/web/v2/search/notes',
        headers=headers,
        cookies=cookie_dict,
        json=payload
    )
    
    data = response.json()
    return data.get('success') or data.get('code') == 0

# 使用
if test_cookie(COOKIE):
    print('✅ Cookie 有效')
else:
    print('❌ Cookie 已失效，请重新登录')
```

---

## 📡 API 详解

### 1. 搜索笔记 API

**端点**: `POST https://so.xiaohongshu.com/api/sns/web/v2/search/notes`

**请求参数**:
```json
{
  "keyword": "奥迪 Q5L",
  "page": 1,
  "page_size": 20,
  "search_id": "生成的唯一 ID",
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
```

**参数说明**:

| 参数 | 类型 | 必需 | 说明 | 示例 |
|-----|------|------|------|------|
| keyword | string | 是 | 搜索关键词 | "奥迪 Q5L" |
| page | integer | 是 | 页码 (从 1 开始) | 1 |
| page_size | integer | 是 | 每页数量 (最大 20) | 20 |
| search_id | string | 是 | 搜索请求 ID | `client.get_search_request_id()` |
| sort | string | 否 | 排序方式 | "general" |
| note_type | integer | 否 | 笔记类型 | 0 |
| image_formats | array | 否 | 图片格式 | ["jpg", "webp", "avif"] |

**排序方式**:
- `general` - 综合排序
- `popularity` - 热度排序
- `time` - 时间排序 (最新)

**笔记类型**:
- `0` - 不限
- `1` - 图文笔记
- `2` - 视频笔记

**响应示例**:
```json
{
  "msg": "成功",
  "data": {
    "has_more": true,
    "items": [
      {
        "id": "6a2639e9000000003503b94a",
        "xsec_token": "ABvUeJ1w98CTdDYu3QHtvcQApprp6MqC1nugn5cDgkcCU=",
        "note_card": {
          "display_title": "标题",
          "type": "normal",
          "user": {
            "user_id": "6a0136040000000002001001",
            "nickname": "用户名",
            "avatar": "https://..."
          },
          "interact_info": {
            "liked_count": "286",
            "collected_count": "378",
            "comment_count": "479"
          },
          "image_list": [...]
        }
      }
    ]
  }
}
```

### 2. 笔记详情 API

**端点**: `POST https://edith.xiaohongshu.com/api/sns/web/v1/feed`

**⚠️ 重要提示**: 必须先调用搜索 API 获取 `xsec_token`!

**请求参数**:
```json
{
  "source_note_id": "6a2639e9000000003503b94a",
  "image_formats": ["jpg", "webp", "avif"],
  "extra": {"need_body_topic": "1"},
  "xsec_source": "pc_search",
  "xsec_token": "ABvUeJ1w98CTdDYu3QHtvcQApprp6MqC1nugn5cDgkcCU="
}
```

**参数说明**:

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| source_note_id | string | 是 | 笔记 ID |
| image_formats | array | 否 | 图片格式 |
| extra | object | 否 | 额外参数 |
| xsec_source | string | 是 | 来源标识 (固定为 "pc_search") |
| xsec_token | string | 是 | 从搜索 API 获取的 token |

**响应示例**:
```json
{
  "code": 0,
  "success": true,
  "msg": "成功",
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

### 3. 搜索推荐 API

**端点**: `GET https://edith.xiaohongshu.com/api/sns/web/v1/search/recommend`

**请求参数**:
```python
from urllib.parse import quote

keyword = "奥迪 Q5L"
encoded_keyword = quote(keyword)
uri = f"/api/sns/web/v1/search/recommend?keyword={encoded_keyword}"
```

**响应示例**:
```json
{
  "code": 1000,
  "success": true,
  "msg": "成功",
  "data": {
    "sug_items": [
      {
        "text": "奥迪 q5l 落地价",
        "search_type": "notes"
      },
      {
        "text": "奥迪 q5l2026 全新换代",
        "search_type": "notes"
      }
    ]
  }
}
```

---

## 💻 完整代码

### 基础客户端

```python
from xhshow import Xhshow
import requests
from urllib.parse import quote

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
    
    def search_notes(self, keyword: str, page: int = 1, page_size: int = 20, sort: str = "general"):
        """
        搜索笔记
        
        Args:
            keyword: 搜索关键词
            page: 页码
            page_size: 每页数量 (最大 20)
            sort: 排序方式 (general/popularity/time)
            
        Returns:
            搜索结果字典
        """
        payload = {
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
            "search_id": self.client.get_search_request_id(),
            "sort": sort,
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
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/explore"
        
        response = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"搜索失败：HTTP {response.status_code}, {response.text}")
    
    def get_note_detail(self, note_id: str, xsec_token: str):
        """
        获取笔记详情
        
        Args:
            note_id: 笔记 ID
            xsec_token: 从搜索 API 获取的 token
            
        Returns:
            笔记详情字典
        """
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
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/"
        
        response = requests.post(
            "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"获取详情失败：HTTP {response.status_code}, {response.text}")
    
    def get_search_recommend(self, keyword: str):
        """
        获取搜索推荐
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            搜索推荐字典
        """
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
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"获取推荐失败：HTTP {response.status_code}, {response.text}")
    
    def search_and_get_detail(self, keyword: str, page: int = 1):
        """
        搜索并获取第一个笔记的详情
        
        Args:
            keyword: 搜索关键词
            page: 页码
            
        Returns:
            第一个笔记的详情字典
        """
        # 搜索
        search_result = self.search_notes(keyword, page)
        
        if not search_result.get('data') or not search_result['data'].get('items'):
            raise Exception("未搜索到笔记")
        
        # 获取第一个笔记的信息
        first_note = search_result['data']['items'][0]
        note_id = first_note['id']
        xsec_token = first_note.get('xsec_token')
        
        if not xsec_token:
            raise Exception("未获取到 xsec_token")
        
        # 获取详情
        detail_result = self.get_note_detail(note_id, xsec_token)
        
        if not detail_result.get('data') or not detail_result['data'].get('items'):
            raise Exception(f"获取详情失败：{detail_result.get('msg')}")
        
        return detail_result['data']['items'][0]
```

### 使用示例

```python
# 初始化客户端
COOKIE = "你的 Cookie 字符串"
client = XhsClient(COOKIE)

# 示例 1: 搜索笔记
print("=== 搜索笔记 ===")
search_result = client.search_notes("Python 编程", page=1, page_size=10)
for i, item in enumerate(search_result['data']['items'][:5], 1):
    note_card = item.get('note_card', {})
    print(f"{i}. {note_card.get('display_title', '无标题')} - {note_card.get('user', {}).get('nickname', '未知')}")

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
print(f"描述：{note_card['desc'][:100]}...")
print(f"用户：{note_card['user']['nickname']}")
print(f"点赞：{note_card['interact_info']['liked_count']}")
print(f"收藏：{note_card['interact_info']['collected_count']}")
print(f"评论：{note_card['interact_info']['comment_count']}")
```

### 批量搜索

```python
def batch_search(client, keyword, max_pages=5):
    """批量搜索多页笔记"""
    all_notes = []
    
    for page in range(1, max_pages + 1):
        try:
            result = client.search_notes(keyword, page=page, page_size=20)
            items = result.get('data', {}).get('items', [])
            
            if not items:
                print(f"第 {page} 页没有数据，停止")
                break
            
            all_notes.extend(items)
            print(f"第 {page} 页：获取到 {len(items)} 条笔记")
            
        except Exception as e:
            print(f"第 {page} 页失败：{e}")
            break
    
    return all_notes

# 使用示例
notes = batch_search(client, "奥迪 Q5L", max_pages=3)
print(f"\n总共获取到 {len(notes)} 条笔记")
```

---

## ⭐ 高级功能

### 1. 重试机制

使用装饰器实现自动重试，支持指数退避策略:

```python
import time
from functools import wraps

def retry_on_failure(max_retries: int = 3, delay: float = 2.0, backoff: float = 2.0):
    """
    重试装饰器 - 指数退避
    
    Args:
        max_retries: 最大重试次数
        delay: 初始延迟 (秒)
        backoff: 延迟倍数
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            current_delay = delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        print(f"    ⚠️  第 {attempt + 1} 次失败，{current_delay:.1f}秒后重试：{e}")
                        time.sleep(current_delay)
                        current_delay *= backoff  # 指数退避
                    else:
                        print(f"    ❌ 达到最大重试次数 ({max_retries})，放弃")
                        raise last_exception
            
            return None
        return wrapper
    return decorator

# 使用示例
@retry_on_failure(max_retries=3, delay=2, backoff=2)
def search_notes(self, keyword: str, page: int = 1):
    """搜索笔记 (带重试)"""
    # ...
```

### 2. 频率控制

随机延迟，模拟真实用户行为:

```python
import random

def random_delay(min_delay: float = 1.0, max_delay: float = 3.0):
    """随机延迟，避免触发风控"""
    delay = random.uniform(min_delay, max_delay)
    time.sleep(delay)
    return delay

# 使用示例
# 请求间延迟
random_delay(1, 3)  # 1-3 秒随机延迟

# 页面间延迟
random_delay(3, 5)  # 3-5 秒随机延迟
```

### 3. 配置管理

集中管理所有配置参数:

```python
class Config:
    """配置类"""
    
    # 数据库配置
    DB_HOST = '192.168.50.50'
    DB_PORT = 3306
    DB_USER = 'root'
    DB_PASSWORD = 'your_password'
    DB_NAME = 'yqad_prod_db'
    
    # 搜索配置
    KEYWORD = "奥迪 Q5L"
    MAX_PAGES = 2
    PAGE_SIZE = 20
    MAX_DETAILS = 5
    
    # 重试配置
    MAX_RETRIES = 3
    RETRY_DELAY = 2
    RETRY_BACKOFF = 2
    
    # 频率控制
    REQUEST_DELAY_MIN = 1
    REQUEST_DELAY_MAX = 3
    PAGE_DELAY_MIN = 3
    PAGE_DELAY_MAX = 5
    
    # 超时配置
    REQUEST_TIMEOUT = 30

# 使用示例
@retry_on_failure(max_retries=Config.MAX_RETRIES, delay=Config.RETRY_DELAY, backoff=Config.RETRY_BACKOFF)
def search_notes(self, keyword: str, page: int = 1):
    # ...
```

### 4. 智能错误处理

识别 Cookie 过期等严重错误:

```python
def search_notes(self, keyword: str, page: int = 1):
    """搜索笔记 (带智能错误处理)"""
    payload = {...}
    
    headers = self.client.sign_headers(...)
    
    response = requests.post(
        "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
        headers=headers,
        cookies=self.cookie_dict,
        json=payload,
        timeout=Config.REQUEST_TIMEOUT
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get('code') == 0 or data.get('success'):
            return data
        else:
            error_msg = data.get('msg', '未知错误')
            # 智能识别 Cookie 过期
            if '登录已过期' in error_msg or 'expired' in error_msg.lower():
                raise Exception(f"Cookie 已过期：{error_msg}")
            raise Exception(f"搜索失败：{error_msg}")
    else:
        raise Exception(f"搜索失败：HTTP {response.status_code}")
```

---

## 🔄 Cookie 管理

### Cookie 为什么容易过期？

小红书 Cookie 通常在 1-3 天内会过期，主要原因:

1. **关键字段时效性短**
   - `id_token`: 身份令牌，有效期几小时到几天
   - `web_session`: 会话标识，依赖服务器端状态
   - `acw_tc`: 反爬虫令牌，有效期很短

2. **风控机制**
   - 登录态活跃度不足会加速过期
   - 异地/异常登录检测
   - 请求频率触发风控

### 自动刷新方案

使用 Playwright 自动登录小红书，获取最新 Cookie:

```python
from playwright.sync_api import sync_playwright
import mysql.connector
import time

def refresh_cookie():
    """刷新小红书 Cookie 的主函数"""
    with sync_playwright() as p:
        # 启动浏览器 (持久化用户数据)
        user_data_dir = './xiaohongshu_browser_data'
        browser = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        page = browser.new_page()
        page.goto('https://www.xiaohongshu.com/login')
        
        # 等待登录成功 (最多 5 分钟)
        print('请扫码登录...')
        login_success = wait_for_login(page, timeout=300)
        
        if not login_success:
            print('❌ 登录超时')
            browser.close()
            return False
        
        # 获取 Cookie
        cookies = page.context.cookies()
        cookie_string = extract_cookie_string(cookies)
        
        # 保存到数据库
        save_cookie_to_db(cookie_string)
        
        browser.close()
        print('✅ Cookie 已成功保存')
        return True

def wait_for_login(page, timeout: int = 300) -> bool:
    """等待登录成功"""
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        cookies = page.context.cookies()
        cookie_dict = {c['name']: c['value'] for c in cookies}
        
        # 检查关键 Cookie
        has_id_token = 'id_token' in cookie_dict and len(cookie_dict['id_token']) > 50
        has_web_session = 'web_session' in cookie_dict and len(cookie_dict['web_session']) > 10
        
        if has_id_token and has_web_session:
            return True
        
        time.sleep(2)
    
    return False

def extract_cookie_string(cookies: list) -> str:
    """提取 Cookie 字符串"""
    return '; '.join([f"{c['name']}={c['value']}" for c in cookies])

def save_cookie_to_db(cookie_string: str):
    """保存到数据库"""
    conn = mysql.connector.connect(
        host='192.168.50.50',
        port=3306,
        user='root',
        password='your_password',
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

# 使用
refresh_cookie()
```

### 使用流程

**首次使用** (需要扫码一次):
```bash
python3 auto_refresh_xiaohongshu_cookie.py
# 打开浏览器 → 扫码登录 → 自动保存 Cookie
```

**后续使用** (无需扫码):
```bash
python3 auto_refresh_xiaohongshu_cookie.py
# 自动保持登录状态 → 直接获取新 Cookie
```

**设置定时任务** (可选):
```bash
# 每天凌晨 2 点自动刷新
0 2 * * * cd /path/to/scripts && python3 auto_refresh_xiaohongshu_cookie.py >> cookie_refresh.log 2>&1
```

---

## 🐳 Docker 部署

### 群晖 DS218+ 部署方案

**主要变化**:
- 浏览器模式：有界面 → headless 无界面
- 扫码方式：直接扫码 → 二维码图片
- 用户数据：本地目录 → 挂载卷
- 中文字体：系统自带 → 需要安装

### Dockerfile

```dockerfile
FROM python:3.10-slim

# 安装中文字体
RUN apt-get install -y --no-install-recommends \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    fonts-noto-cjk

# 安装依赖
RUN pip install playwright==1.60.0 mysql-connector-python==9.7.0

# 安装浏览器
RUN playwright install chromium

WORKDIR /app
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  xiaohongshu-cookie-refresh:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: xiaohongshu-cookie-refresh
    volumes:
      - ./browser_data:/tmp/xiaohongshu_browser_data
      - ./qr_codes:/tmp/qr_codes
      - ./logs:/var/log/xiaohongshu
    environment:
      - DB_HOST=192.168.50.50
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=your_password
      - DB_NAME=yqad_prod_db
      - TZ=Asia/Shanghai
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    restart: unless-stopped
    command: >
      sh -c "
      echo '0 2 * * * python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py >> /var/log/xiaohongshu/cookie_refresh.log 2>&1' | crontab -
      && crond -f -l 2
      "
```

### 部署步骤

```bash
# 1. 上传文件到群晖
/volume1/docker/xiaohongshu/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── scripts/
    └── auto_refresh_xiaohongshu_cookie_docker.py

# 2. 构建并启动
cd /volume1/docker/xiaohongshu/docker
docker-compose build
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 扫码登录 (从日志中找到二维码图片路径)
# 在文件管理器中打开二维码图片，用手机扫码

# 5. 验证
docker-compose logs | grep "Cookie 已成功保存"
```

---

## ❓ 常见问题

### Q1: HTTP 461 - 当前笔记暂时无法浏览

**错误信息**:
```json
{"code": 300031, "success": true, "msg": "当前笔记暂时无法浏览", "data": {}}
```

**原因**:
- 笔记被作者删除
- 笔记正在审核
- 笔记权限设置 (仅粉丝可见等)

**解决**:
- 尝试其他笔记 ID
- 使用搜索 API 获取最新笔记

### Q2: HTTP 500 - jarvis-gateway 错误

**错误信息**:
```
create invoker failed, service: jarvis-gateway-default
```

**原因**:
- 缺少 `xsec_token` 参数
- `xsec_token` 与笔记 ID 不匹配
- `xsec_token` 已过期

**解决**:
- 重新调用搜索 API 获取最新的 `xsec_token`
- 确保使用搜索返回的同一个笔记 ID

### Q3: HTTP 400 - 参数错误

**错误信息**:
```
required param check: source_note_id, name: source_note_id: param is required, but got none
```

**原因**:
- 参数格式不正确
- 必需参数缺失

**解决**:
- 检查请求参数，确保包含所有必需字段
- 使用 `xsec_source` 和 `xsec_token` 参数

### Q4: Cookie 失效

**症状**: 所有 API 返回 401 或认证失败

**解决**:
1. 重新登录小红书网页版
2. 从浏览器复制最新的 Cookie
3. 更新代码中的 Cookie 字符串
4. 或使用自动刷新脚本

### Q5: xsec_token 获取失败

**症状**: 搜索返回的数据中没有 `xsec_token`

**原因**:
- 搜索 API 调用不正确
- Cookie 权限不足

**解决**:
- 确保使用完整的请求参数
- 使用有效的登录 Cookie

### Q6: Docker 容器启动失败

**错误信息**:
```
exec /usr/bin/python3: exec format error
```

**解决**:
```bash
# 检查架构是否匹配
docker info | grep Architecture

# 重新构建镜像
docker-compose build --no-cache
```

### Q7: 二维码不显示 (Docker)

**解决**:
```bash
# 检查日志
docker-compose logs

# 手动进入容器查看
docker-compose exec xiaohongshu-cookie-refresh bash
ls -lh /tmp/qr_codes/

# 检查目录权限
chmod 755 /volume1/docker/xiaohongshu/qr_codes
```

---

## 🎯 最佳实践

### 1. 错误处理

```python
def safe_search(client, keyword):
    """安全的搜索函数"""
    try:
        result = client.search_notes(keyword)
        if not result.get('data') or not result['data'].get('items'):
            print("未搜索到笔记")
            return []
        return result['data']['items']
    except Exception as e:
        print(f"搜索失败：{e}")
        return []
```

### 2. 请求频率控制

```python
import time

def search_with_delay(client, keywords, delay=1):
    """带延迟的批量搜索"""
    results = {}
    for keyword in keywords:
        results[keyword] = safe_search(client, keyword)
        time.sleep(delay)  # 避免触发风控
    return results
```

### 3. 数据缓存

```python
import json
from datetime import datetime, timedelta

class CachedXhsClient(XhsClient):
    """带缓存的小红书客户端"""
    
    def __init__(self, cookie: str, cache_ttl_hours: int = 1):
        super().__init__(cookie)
        self.cache = {}
        self.cache_ttl = timedelta(hours=cache_ttl_hours)
    
    def search_notes(self, keyword: str, page: int = 1, page_size: int = 20):
        """带缓存的搜索"""
        cache_key = f"search:{keyword}:{page}:{page_size}"
        
        # 检查缓存
        if cache_key in self.cache:
            cached_time, cached_data = self.cache[cache_key]
            if datetime.now() - cached_time < self.cache_ttl:
                return cached_data
        
        # 调用 API
        result = super().search_notes(keyword, page, page_size)
        
        # 更新缓存
        self.cache[cache_key] = (datetime.now(), result)
        return result
```

### 4. 数据导出

```python
def export_to_json(data, filename):
    """导出数据到 JSON 文件"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"数据已导出到 {filename}")

# 使用示例
notes = client.search_notes("Python")
export_to_json(notes, "python_notes.json")
```

### 5. 配置管理

```python
# ✅ 推荐：使用配置类
class Config:
    KEYWORD = "奥迪 Q5L"
    MAX_PAGES = 2

# ❌ 不推荐：硬编码
keyword = "奥迪 Q5L"
max_pages = 2
```

### 6. 重试策略

```python
# ✅ 推荐：使用装饰器
@retry_on_failure(max_retries=3, delay=2, backoff=2)
def search_notes(self, keyword, page):
    # ...

# ❌ 不推荐：手动重试
for i in range(3):
    try:
        # ...
        break
    except:
        time.sleep(2)
```

### 7. 频率控制

```python
# ✅ 推荐：随机延迟
delay = self._random_delay(1, 3)
time.sleep(delay)

# ❌ 不推荐：固定延迟
time.sleep(2)
```

---

## ⚠️ 注意事项

1. **Cookie 时效性**: Cookie 会过期，建议定期更新 (通常 1-7 天)
2. **xsec_token 时效性**: 搜索后立即使用，不要长时间保存
3. **请求频率**: 避免短时间内大量请求，建议添加 1-2 秒延时
4. **笔记状态**: 部分笔记可能无法访问，需要错误处理
5. **分页限制**: 搜索结果有页数限制，通常最多 50 页
6. **合规使用**: 请遵守小红书平台规则，仅用于合法用途
7. **资源限制**: Docker 部署时注意 CPU 和内存限制
8. **持久化**: 浏览器用户数据目录不要删除，否则需要重新扫码

---

## 📚 相关文档

### 核心文档
- [小红书 API 技术文档.md](./小红书 API 技术文档.md) - 完整技术文档
- [小红书 API 快速参考.md](./小红书 API 快速参考.md) - 快速参考

### 实施文档
- [小红书逻辑重构总结.md](./小红书逻辑重构总结.md) - 重构总结
- [小红书高级功能实现.md](./小红书高级功能实现.md) - 高级功能

### 部署文档
- [小红书 Cookie 自动刷新方案.md](./小红书 Cookie 自动刷新方案.md) - Cookie 管理
- [群晖 Docker 部署指南.md](./群晖 Docker 部署指南.md) - Docker 部署

### 脚本文件
- [`scripts/export_xiaohongshu_audi.py`](../scripts/export_xiaohongshu_audi.py) - 生产导出脚本
- [`scripts/test_audi_export.py`](../scripts/test_audi_export.py) - 快速测试脚本
- [`scripts/auto_refresh_xiaohongshu_cookie.py`](../scripts/auto_refresh_xiaohongshu_cookie.py) - Cookie 自动刷新

---

## 🔗 相关链接

- xhshow 官方：https://github.com/PPPey/xhshow
- PyPI 包：https://pypi.org/project/xhshow/
- 小红书网页版：https://www.xiaohongshu.com

---

## 📊 更新记录

### 2026-06-29 - 最新
- ✅ 完成高级功能实现 (重试、频率控制、配置管理)
- ✅ 完成 Cookie 自动刷新方案
- ✅ 完成群晖 Docker 部署方案
- ✅ 清理过时文档和测试脚本
- ✅ 所有功能已验证通过并投入生产使用

### 2026-06-28
- ✅ 完成所有 API 测试
- ✅ 创建完整文档体系
- ✅ 验证所有功能可用性

---

**文档版本**: v2.0  
**最后更新**: 2026-06-29  
**维护状态**: ✅ 活跃维护  
**技术方案**: xhshow + requests 纯 API 方案
