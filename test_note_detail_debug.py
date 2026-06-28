#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试笔记详情页面结构
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154"
    
    NOTE_ID = "69635d04000000000b00996b"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        )
        
        stealth_js_path = '/Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/stealth.min.js'
        page = await context.new_page()
        await page.add_init_script(path=stealth_js_path)
        
        cookies = []
        for cookie_str in COOKIE.split(';'):
            if '=' in cookie_str:
                name, value = cookie_str.strip().split('=', 1)
                cookies.append({'name': name.strip(), 'value': value.strip(), 'domain': '.xiaohongshu.com', 'path': '/'})
        await context.add_cookies(cookies)
        
        url = f"https://www.xiaohongshu.com/explore/{NOTE_ID}"
        print(f"访问：{url}")
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        await asyncio.sleep(5)
        
        # 获取页面标题
        title = await page.title()
        print(f"页面标题：{title}")
        
        # 查找所有可能的内容选择器
        selectors = ['.note-content', '.title', '.desc', '.user-name', '#noteContainer', '[class*="note"]', '[class*="content"]']
        
        for selector in selectors:
            try:
                elem = await page.query_selector(selector)
                if elem:
                    text = await elem.text_content()
                    print(f"✅ {selector}: 找到 - {text[:100] if text else 'N/A'}")
                else:
                    print(f"❌ {selector}: 未找到")
            except Exception as e:
                print(f"⚠️ {selector}: 错误 - {e}")
        
        # 获取页面 HTML 的前 5000 字符
        html = await page.content()
        print(f"\n页面 HTML 长度：{len(html)}")
        print(f"前 5000 字符:\n{html[:5000]}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
