# 小红书 API 技术文档

> 基于 xhshow 库的小红书数据抓取完整技术方案  
> 最后更新：2026-06-28

## 📖 目录

- [概述](#概述)
- [环境准备](#环境准备)
- [API 列表](#api-列表)
- [详细使用说明](#详细使用说明)
- [完整代码示例](#完整代码示例)
- [常见问题](#常见问题)
- [最佳实践](#最佳实践)

---

## 概述

本文档详细说明了如何使用 xhshow 库调用小红书官方 API，实现笔记搜索、详情获取、搜索推荐等功能。

### 核心发现

**关键点**：获取笔记详情必须使用 `xsec_token`，该 token 需要从搜索 API 中获取。不能直接调用详情 API。

### 技术架构

```
搜索 API → 获取笔记列表 + xsec_token → 详情 API → 获取完整笔记内容
```

---

## 环境准备

### 1. 安装依赖

```bash
pip install xhshow requests
```

### 2. 获取 Cookie

从浏览器开发者工具中复制完整的 Cookie 字符串：

1. 打开小红书网页版 (www.xiaohongshu.com)
2. 登录账号
3. 按 F12 打开开发者工具
4. 在 Network 标签中找到任意请求
5. 复制 Request Headers 中的 Cookie 字段

**必需的 Cookie 字段**：
- `a1` - 设备标识
- `web_session` - 会话标识  
- `id_token` - 用户身份令牌
- `webId` - 用户 ID

示例：
```python
COOKIE = "abRequestId=xxx; a1=xxx; web_session=xxx; id_token=xxx; webId=xxx; ..."
```

---

## API 列表

| API 名称 | 端点 | 方法 | 状态 | 说明 |
|---------|------|------|------|------|
| 搜索笔记 | `/api/sns/web/v2/search/notes` | POST | ✅ 可用 | 搜索笔记列表 |
| 笔记详情 | `/api/sns/web/v1/feed` | POST | ✅ 可用 | 获取单个笔记详情 |
| 搜索推荐 | `/api/sns/web/v1/search/recommend` | GET | ✅ 可用 | 获取搜索建议词 |

### API 基础信息

**搜索笔记**
- Host: `so.xiaohongshu.com`
- URI: `/api/sns/web/v2/search/notes`
- 需要签名：是
- x_rap: False

**笔记详情**
- Host: `edith.xiaohongshu.com`
- URI: `/api/sns/web/v1/feed`
- 需要签名：是
- x_rap: True

**搜索推荐**
- Host: `edith.xiaohongshu.com`
- URI: `/api/sns/web/v1/search/recommend`
- 需要签名：是
- x_rap: False

---

## 详细使用说明

### 1. 搜索笔记 API

#### 请求参数

```json
{
  "keyword": "奥迪 Q5L",
  "page": 6,
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

#### 参数说明

| 参数 | 类型 | 必需 | 说明 | 示例 |
|-----|------|------|------|------|
| keyword | string | 是 | 搜索关键词 | "奥迪 Q5L" |
| page | integer | 是 | 页码（从 1 开始） | 6 |
| page_size | integer | 是 | 每页数量（最大 20） | 20 |
| search_id | string | 是 | 搜索请求 ID | "2gk6k6cal17y7nkgyfqh0" |
| sort | string | 否 | 排序方式 | "general" |
| note_type | integer | 否 | 笔记类型 | 0 |
| image_formats | array | 否 | 图片格式 | ["jpg", "webp", "avif"] |
| geo | string | 否 | 地理位置信息 | "" |
| message_id | string | 否 | 消息 ID | "" |
| ext_flags | array | 否 | 扩展标志 | [] |
| filters | array | 否 | 筛选条件 | [...] |

#### sort 参数可选值

- `general` - 综合排序
- `popularity` - 热度排序
- `time` - 时间排序（最新）

#### note_type 参数可选值

- `0` - 不限
- `1` - 图文笔记
- `2` - 视频笔记

#### 响应示例

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
            "nickname": "做啥子",
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

#### 重要提示

⚠️ **必须先调用搜索 API 获取 `xsec_token`！**

#### 请求参数

```json
{
  "source_note_id": "6a2639e9000000003503b94a",
  "image_formats": ["jpg", "webp", "avif"],
  "extra": {"need_body_topic": "1"},
  "xsec_source": "pc_search",
  "xsec_token": "ABvUeJ1w98CTdDYu3QHtvcQApprp6MqC1nugn5cDgkcCU="
}
```

#### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| source_note_id | string | 是 | 笔记 ID |
| image_formats | array | 否 | 图片格式 |
| extra | object | 否 | 额外参数 |
| xsec_source | string | 是 | 来源标识（固定为 "pc_search"） |
| xsec_token | string | 是 | 从搜索 API 获取的 token |

#### 响应示例

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

#### 请求参数

```python
keyword = "奥迪 Q5L"
uri = f"/api/sns/web/v1/search/recommend?keyword={quote(keyword)}"
```

#### 响应示例

```json
{
  "code": 1000,
  "success": true,
  "msg": "成功",
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

---

## 完整代码示例

### 示例 1: 基础工具类

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
            page_size: 每页数量（最大 20）
            sort: 排序方式（general/popularity/time）
            
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
            cookies=cookie_dict,
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

### 示例 2: 使用示例

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

### 示例 3: 批量搜索

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

## 常见问题

### 1. HTTP 461 - 当前笔记暂时无法浏览

**错误信息**：
```json
{"code": 300031, "success": true, "msg": "当前笔记暂时无法浏览", "data": {}}
```

**原因**：
- 笔记被作者删除
- 笔记正在审核
- 笔记权限设置（仅粉丝可见等）

**解决方案**：
- 尝试其他笔记 ID
- 使用搜索 API 获取最新笔记

### 2. HTTP 500 - jarvis-gateway 错误

**错误信息**：
```
create invoker failed, service: jarvis-gateway-default
```

**原因**：
- 缺少 `xsec_token` 参数
- `xsec_token` 与笔记 ID 不匹配
- `xsec_token` 已过期

**解决方案**：
- 重新调用搜索 API 获取最新的 `xsec_token`
- 确保使用搜索返回的同一个笔记 ID

### 3. HTTP 400 - 参数错误

**错误信息**：
```
required param check: source_note_id, name: source_note_id: param is required, but got none
```

**原因**：
- 参数格式不正确
- 必需参数缺失

**解决方案**：
- 检查请求参数，确保包含所有必需字段
- 使用 `xsec_source` 和 `xsec_token` 参数

### 4. Cookie 失效

**症状**：所有 API 返回 401 或认证失败

**解决方案**：
1. 重新登录小红书网页版
2. 从浏览器复制最新的 Cookie
3. 更新代码中的 Cookie 字符串

### 5. xsec_token 获取失败

**症状**：搜索返回的数据中没有 `xsec_token`

**原因**：
- 搜索 API 调用不正确
- Cookie 权限不足

**解决方案**：
- 确保使用完整的请求参数
- 使用有效的登录 Cookie

---

## 最佳实践

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

---

## 注意事项

1. **Cookie 时效性**：Cookie 会过期，建议定期更新（通常 1-7 天）
2. **xsec_token 时效性**：搜索后立即使用，不要长时间保存
3. **请求频率**：避免短时间内大量请求，建议添加 1-2 秒延时
4. **笔记状态**：部分笔记可能无法访问，需要错误处理
5. **分页限制**：搜索结果有页数限制，通常最多 50 页
6. **合规使用**：请遵守小红书平台规则，仅用于合法用途

---

## 附录

### A. 测试脚本

以下测试脚本已创建：

- `test_xhshow_search_full.py` - 完整参数搜索测试
- `test_xhshow_feed_with_token.py` - 详情获取测试
- `test_xhshow_search_recommend.py` - 搜索推荐测试
- `xhshow_utils.py` - 工具类封装

### B. 相关文档

- `xhshow 获取详情 API 完整解析.md` - 详情 API 专项说明
- `小红书 API 完整使用指南.md` - 使用指南

### C. 参考资料

- xhshow 官方文档：https://github.com/PPPey/xhshow
- Python 包：https://pypi.org/project/xhshow/

---

## 更新日志

### 2026-06-28
- ✅ 完成搜索 API 完整参数测试
- ✅ 完成详情 API 完整流程测试
- ✅ 完成搜索推荐 API 测试
- ✅ 创建完整工具类和文档
- ✅ 验证所有 API 可用性
