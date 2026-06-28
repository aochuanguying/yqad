#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对比成功和失败的搜索签名
"""

import time
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

def search_with_params(keyword: str, page_size: int, label: str):
    """带标签的搜索"""
    print(f"\n{'='*60}")
    print(f"测试：{label}")
    print(f"{'='*60}")
    
    client = Xhshow()
    search_id = client.get_search_id()
    a1_value = extract_cookie_value('a1')
    
    print(f"a1_value: {a1_value}")
    print(f"search_id: {search_id}")
    print(f"keyword: {keyword}")
    print(f"page_size: {page_size}")
    
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": page_size,
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
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "content-type": "application/json;charset=UTF-8",
    }
    
    cookie_dict = {}
    for item in COOKIE.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            cookie_dict[k.strip()] = v.strip()
    
    print(f"\n发送请求...")
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    
    print(f"状态码：{response.status_code}")
    result = response.json()
    items = result.get('data', {}).get('items', [])
    print(f"items 数量：{len(items)}")
    
    if items:
        print(f"✅ 成功！第 1 条：{items[0].get('note_card', {}).get('display_title', 'N/A')[:30]}")
    else:
        print(f"❌ 失败！响应：{result.get('msg', 'Unknown')}")
    
    return len(items) > 0

if __name__ == "__main__":
    # 测试 1: page_size=10（应该成功）
    result1 = search_with_params("美食", 10, "page_size=10")
    
    # 测试 2: page_size=1（可能失败？）
    result2 = search_with_params("美食", 1, "page_size=1")
    
    # 测试 3: page_size=3（可能失败？）
    result3 = search_with_params("美食", 3, "page_size=3")
    
    # 测试 4: 再次 page_size=10
    result4 = search_with_params("美食", 10, "page_size=10 (第二次)")
    
    print("\n" + "="*60)
    print("汇总：")
    print(f"  测试 1 (page_size=10): {'✅' if result1 else '❌'}")
    print(f"  测试 2 (page_size=1): {'✅' if result2 else '❌'}")
    print(f"  测试 3 (page_size=3): {'✅' if result3 else '❌'}")
    print(f"  测试 4 (page_size=10): {'✅' if result4 else '❌'}")
    print("="*60)
