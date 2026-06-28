#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试最小 Cookie 需求
只用 a1 Cookie 能否访问？
"""

import time
import requests
from xhshow import Xhshow

# 只用 a1 Cookie
A1_ONLY = "a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769"

# 完整 Cookie
FULL_COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

def test_search(cookie_str: str, label: str):
    """测试搜索 API"""
    print(f"\n{'='*60}")
    print(f"测试：{label}")
    print(f"{'='*60}")
    
    client = Xhshow()
    search_id = client.get_search_id()
    
    # 提取 a1
    a1_value = None
    for item in cookie_str.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            if k.strip() == 'a1':
                a1_value = v.strip()
                break
    
    if not a1_value:
        print("❌ 没有 a1 Cookie，无法生成签名")
        return False
    
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
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0",
        "content-type": "application/json;charset=UTF-8",
    }
    
    cookie_dict = {}
    for item in cookie_str.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            cookie_dict[k.strip()] = v.strip()
    
    print(f"使用 Cookie: {len(cookie_dict)} 个")
    print(f"a1: {a1_value[:30]}...")
    
    try:
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        print(f"状态码：{response.status_code}")
        
        result = response.json()
        items = result.get('data', {}).get('items', [])
        print(f"返回结果：{len(items)} 条")
        
        if len(items) > 0:
            print("✅ 成功！")
            return True
        else:
            print(f"❌ 返回空结果：{result.get('msg', 'Unknown')}")
            return False
            
    except Exception as e:
        print(f"❌ 异常：{e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("测试最小 Cookie 需求")
    print("="*60)
    
    # 测试 1: 只有 a1
    result1 = test_search(A1_ONLY, "只有 a1 Cookie")
    
    # 测试 2: 完整 Cookie
    result2 = test_search(FULL_COOKIE, "完整 Cookie")
    
    print("\n" + "="*60)
    print("总结")
    print("="*60)
    print(f"只有 a1: {'✅' if result1 else '❌'}")
    print(f"完整 Cookie: {'✅' if result2 else '❌'}")
    
    if result1:
        print("\n✅ 结论：只需要 a1 Cookie 就可以访问 API！")
    else:
        print("\n⚠️ 结论：需要更多 Cookie 才能稳定访问")
