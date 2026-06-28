#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试 test_final_comprehensive.py 中的失败
"""

import asyncio
import time
import requests
from pathlib import Path
from playwright.async_api import async_playwright
from xhshow import Xhshow

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

def extract_cookie_value(key: str):
    for item in COOKIE.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            if k.strip() == key:
                return v.strip()
    return None

# 完全复制 test_final_comprehensive.py 中的 search_notes 函数
def search_notes(keyword: str = "美食", page_size: int = 10) -> list:
    """同步搜索笔记（模块级函数）"""
    print(f"  [search_notes] 开始执行，keyword={keyword}, page_size={page_size}")
    
    client = Xhshow()
    search_id = client.get_search_id()
    a1_value = extract_cookie_value('a1')
    
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
    
    print(f"  [search_notes] 发送请求...")
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    print(f"  [search_notes] 状态码：{response.status_code}")
    
    result = response.json()
    success = result.get('success') or result.get('code') == 0
    items = result.get('data', {}).get('items', [])
    
    print(f"  [search_notes] success={success}, items={len(items)}")
    
    return items

async def test_playwright_detail():
    """完全复制 test_final_comprehensive.py 中的测试 4"""
    print("\n" + "="*60)
    print("测试：Playwright 详情页（调试版）")
    print("="*60)
    
    # 先获取真实的笔记
    print("📝 获取测试笔记...")
    try:
        loop = asyncio.get_event_loop()
        print("🔄 准备调用 run_in_executor...")
        items = await loop.run_in_executor(None, search_notes, "美食", 1)
        print(f"📦 run_in_executor 返回：{len(items)} 条")
        
        if not items:
            print("❌ 搜索结果为空")
            return False
        
        item = items[0]
        note_card = item.get('note_card', {})
        note_id = note_card.get('id')
        
        xsec_token = item.get('xsec_token')
        if not xsec_token:
            xsec_token = note_card.get('xsec_token')
        if not xsec_token:
            user = note_card.get('user', {})
            xsec_token = user.get('xsec_token')
        
        if not note_id or not xsec_token:
            print(f"❌ 无法提取笔记 ID 或 token")
            print(f"   note_id: {note_id}")
            print(f"   xsec_token: {xsec_token}")
            return False
        
        print(f"✅ 获取到笔记：{note_id}")
        
    except Exception as e:
        print(f"❌ 获取测试笔记失败：{e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_playwright_detail())
    print(f"\n最终结果：{'✅' if result else '❌'}")
