#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 Playwright 启动后是否影响搜索 API
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

def sync_search():
    """同步搜索函数"""
    print("  [sync_search] 开始执行")
    
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
    
    print(f"  [sync_search] 发送请求...")
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    result = response.json()
    items = result.get('data', {}).get('items', [])
    print(f"  [sync_search] 返回 {len(items)} 条结果")
    
    return items

async def test_search_before_browser():
    """启动浏览器前搜索"""
    print("\n测试 1: 启动浏览器前搜索")
    loop = asyncio.get_event_loop()
    items = await loop.run_in_executor(None, sync_search)
    print(f"结果：{'✅' if len(items) > 0 else '❌'}")
    return len(items) > 0

async def test_search_after_browser():
    """启动浏览器后搜索"""
    print("\n测试 2: 启动浏览器后搜索")
    
    # 先启动浏览器
    print("  启动浏览器...")
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    context = await browser.new_context()
    page = await context.new_page()
    
    # 注入 stealth
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
    
    print("  浏览器已启动")
    await asyncio.sleep(1)
    
    # 然后搜索
    loop = asyncio.get_event_loop()
    items = await loop.run_in_executor(None, sync_search)
    print(f"结果：{'✅' if len(items) > 0 else '❌'}")
    
    # 关闭浏览器
    await browser.close()
    print("  浏览器已关闭")
    
    return len(items) > 0

async def test_search_with_page_open():
    """浏览器页面打开时搜索"""
    print("\n测试 3: 浏览器页面打开时搜索")
    
    # 启动浏览器
    print("  启动浏览器...")
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    context = await browser.new_context()
    page = await context.new_page()
    
    # 注入 stealth
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
    
    # 访问一个页面
    print("  访问页面...")
    await page.goto('https://www.baidu.com', wait_until='domcontentloaded', timeout=10000)
    print(f"  页面标题：{await page.title()}")
    
    # 然后搜索
    print("  执行搜索...")
    loop = asyncio.get_event_loop()
    items = await loop.run_in_executor(None, sync_search)
    print(f"结果：{'✅' if len(items) > 0 else '❌'}")
    
    # 关闭浏览器
    await browser.close()
    
    return len(items) > 0

async def main():
    print("="*60)
    print("测试 Playwright 对搜索 API 的影响")
    print("="*60)
    
    result1 = await test_search_before_browser()
    result2 = await test_search_after_browser()
    result3 = await test_search_with_page_open()
    
    print("\n" + "="*60)
    print("总结：")
    print(f"  测试 1（启动前）: {'✅' if result1 else '❌'}")
    print(f"  测试 2（启动后）: {'✅' if result2 else '❌'}")
    print(f"  测试 3（页面打开时）: {'✅' if result3 else '❌'}")
    print("="*60)
    
    if result1 and result2 and result3:
        print("✅ 所有测试通过！Playwright 不影响搜索 API")
    else:
        print("⚠️ 存在失败的测试")

if __name__ == "__main__":
    asyncio.run(main())
