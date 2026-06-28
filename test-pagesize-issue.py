#!/usr/bin/env python3.10
"""
测试 page_size 问题
"""

import json
import time
import requests
from xhshow import Xhshow

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769"

def extract_a1(cookie: str) -> str:
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            if key.strip() == 'a1':
                return value.strip()
    return None

def test_page_size(page_size: int):
    a1_value = extract_a1(COOKIE)
    client = Xhshow()
    search_id = client.get_search_id()
    
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    payload = {
        "keyword": "美食",
        "page": 1,
        "page_size": page_size,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0
    }
    
    signature = client.sign_xs_post(uri=uri, a1_value=a1_value, payload=payload)
    
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "content-type": "application/json;charset=UTF-8",
    }
    
    cookie_dict = {'a1': a1_value}
    
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    result = response.json()
    items = result.get('data', {}).get('items', [])
    
    print(f"page_size={page_size:2d} -> items={len(items)}")
    return len(items)

print("=== 测试 page_size 问题 ===\n")

# 测试不同的 page_size
for ps in [1, 2, 3, 5, 10, 20]:
    test_page_size(ps)

print("\n结论：page_size 必须 >= 10")
