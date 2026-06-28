#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试异步环境中的搜索问题
"""

import asyncio
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

# 测试 1: 直接在 async 函数中调用同步代码
async def test_direct_in_async():
    """直接在 async 函数中调用同步代码"""
    print("\n测试 1: 直接在 async 函数中调用")
    
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
        "x-t": str(int(time.time() * 1000)),
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
    
    print(f"  返回 {len(items)} 条结果")
    return len(items) > 0

# 测试 2: 使用 run_in_executor
async def test_with_executor():
    """使用 run_in_executor"""
    print("\n测试 2: 使用 run_in_executor")
    
    def sync_search():
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
            "x-t": str(int(time.time() * 1000)),
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
        return items
    
    loop = asyncio.get_event_loop()
    items = await loop.run_in_executor(None, sync_search)
    
    print(f"  返回 {len(items)} 条结果")
    return len(items) > 0

# 测试 3: 创建新的 Xhshow 实例
async def test_new_instance():
    """每次创建新的 Xhshow 实例"""
    print("\n测试 3: 每次创建新的 Xhshow 实例")
    
    def sync_search_new():
        client = Xhshow()  # 新实例
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
            "x-t": str(int(time.time() * 1000)),
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
        print(f"  [sync_search_new] 返回 {len(items)} 条结果")
        return items
    
    loop = asyncio.get_event_loop()
    items = await loop.run_in_executor(None, sync_search_new)
    
    print(f"  最终返回 {len(items)} 条结果")
    return len(items) > 0

async def main():
    print("="*60)
    print("调试异步环境中的搜索问题")
    print("="*60)
    
    # 测试 1
    result1 = await test_direct_in_async()
    print(f"结果 1: {'✅' if result1 else '❌'}")
    
    # 测试 2
    result2 = await test_with_executor()
    print(f"结果 2: {'✅' if result2 else '❌'}")
    
    # 测试 3
    result3 = await test_new_instance()
    print(f"结果 3: {'✅' if result3 else '❌'}")
    
    print("\n" + "="*60)
    print("总结：")
    print(f"  测试 1（直接在 async 中）: {'✅' if result1 else '❌'}")
    print(f"  测试 2（run_in_executor）: {'✅' if result2 else '❌'}")
    print(f"  测试 3（新实例）: {'✅' if result3 else '❌'}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
