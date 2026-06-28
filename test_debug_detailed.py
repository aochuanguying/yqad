#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
详细调试：为什么有些搜索失败
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

def search_notes_debug(keyword: str = "美食", page_size: int = 10, label: str = "") -> list:
    """带详细调试的搜索函数"""
    print(f"  [{label}] 开始搜索...")
    
    try:
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
            "user-agent": "Mozilla/5.0",
            "content-type": "application/json;charset=UTF-8",
        }
        
        cookie_dict = {}
        for item in COOKIE.split(';'):
            if '=' in item:
                k, v = item.split('=', 1)
                cookie_dict[k.strip()] = v.strip()
        
        print(f"  [{label}] 发送 POST 请求到 {url}")
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        print(f"  [{label}] 状态码：{response.status_code}")
        
        if response.status_code != 200:
            print(f"  [{label}] ❌ 非 200 状态码")
            return []
        
        result = response.json()
        success = result.get('success') or result.get('code') == 0
        items = result.get('data', {}).get('items', [])
        
        print(f"  [{label}] success={success}, code={result.get('code')}, items={len(items)}")
        
        if not success:
            print(f"  [{label}] 响应：{result.get('msg', 'Unknown')}")
        
        return items
        
    except Exception as e:
        print(f"  [{label}] 异常：{e}")
        import traceback
        traceback.print_exc()
        return []

async def test_sequence():
    """测试调用序列"""
    print("="*60)
    print("测试调用序列")
    print("="*60)
    
    # 第 1 次：直接调用
    print("\n1️⃣ 第 1 次搜索（直接调用）")
    loop = asyncio.get_event_loop()
    items1 = await loop.run_in_executor(None, search_notes_debug, "美食", 10, "test1")
    print(f"   结果：{'✅' if items1 else '❌'} - {len(items1)} 条\n")
    
    # 第 2 次：启动 Playwright 后
    print("2️⃣ 启动 Playwright...")
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    context = await browser.new_context()
    page = await context.new_page()
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
    print("   ✅ 浏览器已启动\n")
    
    print("3️⃣ 第 2 次搜索（浏览器启动后）")
    items2 = await loop.run_in_executor(None, search_notes_debug, "美食", 10, "test2")
    print(f"   结果：{'✅' if items2 else '❌'} - {len(items2)} 条\n")
    
    # 第 3 次：访问页面后
    print("4️⃣ 访问页面...")
    await page.goto('https://www.baidu.com', wait_until='domcontentloaded', timeout=10000)
    print(f"   页面标题：{await page.title()}\n")
    
    print("5️⃣ 第 3 次搜索（访问页面后）")
    items3 = await loop.run_in_executor(None, search_notes_debug, "美食", 10, "test3")
    print(f"   结果：{'✅' if items3 else '❌'} - {len(items3)} 条\n")
    
    # 第 4 次：关闭浏览器后
    print("6️⃣ 关闭浏览器...")
    await browser.close()
    print("   ✅ 浏览器已关闭\n")
    
    print("7️⃣ 第 4 次搜索（关闭浏览器后）")
    items4 = await loop.run_in_executor(None, search_notes_debug, "美食", 10, "test4")
    print(f"   结果：{'✅' if items4 else '❌'} - {len(items4)} 条\n")
    
    # 汇总
    print("="*60)
    print("汇总：")
    print(f"  测试 1（直接）: {'✅' if items1 else '❌'} - {len(items1)} 条")
    print(f"  测试 2（启动后）: {'✅' if items2 else '❌'} - {len(items2)} 条")
    print(f"  测试 3（访问后）: {'✅' if items3 else '❌'} - {len(items3)} 条")
    print(f"  测试 4（关闭后）: {'✅' if items4 else '❌'} - {len(items4)} 条")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_sequence())
