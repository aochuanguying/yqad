#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试 xhshow API
"""

import time
import random
import requests
import json
from xhshow import Xhshow

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

client = Xhshow()

url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
uri = "/api/sns/web/v2/search/notes"

search_id = client.get_search_id()

payload = {
    "keyword": "美食",
    "page": 1,
    "page_size": 10,
    "search_id": search_id,
    "sort": "general",
    "note_type": 0
}

# 提取 a1
a1_value = None
for item in COOKIE.split(';'):
    if '=' in item:
        key, value = item.split('=', 1)
        if key.strip() == 'a1':
            a1_value = value.strip()
            break

print(f"a1: {a1_value}")
print(f"search_id: {search_id}")

signature = client.sign_xs_post(
    uri=uri,
    a1_value=a1_value,
    payload=payload
)

print(f"signature: {signature}")

headers = {
    "x-s": signature,
    "x-t": str(int(time.time() * 1000)),
    "user-agent": USER_AGENT,
    "content-type": "application/json;charset=UTF-8",
    "accept": "application/json, text/plain, */*",
}

cookie_dict = {}
for item in COOKIE.split(';'):
    if '=' in item:
        key, value = item.split('=', 1)
        cookie_dict[key.strip()] = value.strip()

print(f"\n发送请求...")
response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)

print(f"状态码：{response.status_code}")
print(f"响应头：{dict(response.headers)}")
print(f"\n响应内容:")
try:
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
except:
    print(response.text)
