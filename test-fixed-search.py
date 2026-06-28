#!/usr/bin/env python3.10
"""
测试修复后的搜索脚本（page_size >= 10）
"""

import json
import sys
import time
import requests
from xhshow import Xhshow

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

def extract_a1(cookie: str) -> str:
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            if key.strip() == 'a1':
                return value.strip()
    return None

def search(keyword: str, max_results: int):
    a1_value = extract_a1(COOKIE)
    if not a1_value:
        print(json.dumps({"error": "no a1"}))
        sys.exit(1)
    
    client = Xhshow()
    search_id = client.get_search_id()
    
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    # 修复：page_size 必须 >= 10
    actual_page_size = max(max_results, 10)
    
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": actual_page_size,
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
    
    cookie_dict = {}
    for item in COOKIE.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    result = response.json()
    
    if not result.get('success'):
        print(json.dumps({"error": result.get('msg', 'failed')}))
        sys.exit(1)
    
    items = result.get('data', {}).get('items', [])
    print(f"API 返回：{len(items)} 条")
    
    # 取前 max_results 条
    notes = []
    for item in items[:max_results]:
        note_card = item.get('note_card', {})
        note_id = item.get('id', '')
        title = note_card.get('display_title', '')
        
        if note_id:
            notes.append({
                'id': note_id,
                'title': title,
                'url': f"https://www.xiaohongshu.com/explore/{note_id}"
            })
    
    print(f"提取笔记：{len(notes)} 条")
    for idx, note in enumerate(notes, 1):
        print(f"  {idx}. {note['title']}")
    
    print(json.dumps({"success": True, "notes": notes, "total": len(notes)}))

if __name__ == "__main__":
    search('美食', 3)
