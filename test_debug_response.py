#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试搜索响应的数据结构
"""

import json
import requests
from xhshow import Xhshow

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

def extract_cookie_value(key: str):
    for item in COOKIE.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            if k.strip() == key:
                return v.strip()
    return None

# 搜索
client = Xhshow()
search_id = client.get_search_id()
a1_value = extract_cookie_value('a1')

url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
payload = {
    "keyword": "美食",
    "page": 1,
    "page_size": 10,
    "search_id": search_id,
    "sort": "general",
    "note_type": 0
}

signature = client.sign_xs_post(
    uri="/api/sns/web/v2/search/notes",
    a1_value=a1_value,
    payload=payload
)

headers = {
    "x-s": signature,
    "x-t": str(int(1000 * 1000)),  # 固定时间
    "user-agent": "Mozilla/5.0",
    "content-type": "application/json;charset=UTF-8",
}

cookie_dict = {}
for item in COOKIE.split(';'):
    if '=' in item:
        k, v = item.split('=', 1)
        cookie_dict[k.strip()] = v.strip()

response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
result = response.json()
items = result.get('data', {}).get('items', [])

print(f"返回 {len(items)} 条结果\n")

# 检查前 3 条的结构
for idx, item in enumerate(items[:3], 1):
    print(f"{'='*60}")
    print(f"第 {idx} 条结果:")
    print(f"{'='*60}")
    
    # 检查顶层字段
    print(f"\n顶层字段：")
    print(f"  id: {item.get('id')}")
    print(f"  xsec_token: {item.get('xsec_token')}")
    print(f"  model_type: {item.get('model_type')}")
    
    # 检查 note_card
    note_card = item.get('note_card', {})
    print(f"\nnote_card 字段：")
    print(f"  id: {note_card.get('id')}")
    print(f"  xsec_token: {note_card.get('xsec_token')}")
    print(f"  display_title: {note_card.get('display_title', 'N/A')[:50]}")
    
    # 检查 user
    user = note_card.get('user', {})
    print(f"\nuser 字段：")
    print(f"  id: {user.get('id')}")
    print(f"  xsec_token: {user.get('xsec_token')}")
    print(f"  nickname: {user.get('nickname', 'N/A')}")
    
    # 提取逻辑
    print(f"\n提取逻辑：")
    xsec_token = item.get('xsec_token')
    note_id = item.get('id')
    
    if not xsec_token:
        xsec_token = note_card.get('xsec_token')
        print(f"  从 note_card 获取 token: {xsec_token[:20] if xsec_token else 'None'}...")
    
    if not xsec_token:
        xsec_token = user.get('xsec_token')
        print(f"  从 user 获取 token: {xsec_token[:20] if xsec_token else 'None'}...")
    
    if not note_id:
        note_id = note_card.get('id')
        print(f"  从 note_card 获取 id: {note_id}")
    
    print(f"\n最终提取结果：")
    print(f"  note_id: {note_id}")
    print(f"  xsec_token: {xsec_token[:20] if xsec_token else 'None'}...")
    
    if note_id and xsec_token:
        print(f"  ✅ 可以访问详情页")
    else:
        print(f"  ❌ 缺少必要参数")
    
    print()
