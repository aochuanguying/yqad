#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 Playwright 直接访问小红书笔记页面
不使用复杂的 stealth，只测试基本访问
"""

import asyncio
from playwright.async_api import async_playwright

# Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"


async def test_note_detail():
    """使用 Playwright 获取笔记详情"""
    print("=" * 80)
    print("📝 使用 Playwright 测试小红书笔记详情 API")
    print("=" * 80)
    print()
    
    note_id = "69635d04000000000b00996b"
    xsec_token = "ABsx0ZpbDH4yyYBkR95YLx6jOuRXRa0RnwWLSX7E1Rkyw="
    
    print(f"📋 note_id: {note_id}")
    print(f"🔐 xsec_token: {xsec_token}")
    print()
    
    async with async_playwright() as p:
        # 启动浏览器（有头模式，方便调试）
        print("🚀 启动浏览器...")
        browser = await p.chromium.launch(
            headless=False,  # 有头模式
        )
        
        # 创建浏览器上下文
        print("📋 创建浏览器上下文...")
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        # 创建页面
        page = await context.new_page()
        
        # 注入脚本覆盖 navigator.webdriver
        print("🔧 注入伪装脚本...")
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
            });
        """)
        
        # 设置 Cookie
        print("🍪 设置 Cookie...")
        await context.add_cookies([
            {'name': name, 'value': value, 'domain': '.xiaohongshu.com', 'path': '/'}
            for cookie in COOKIE.split(';')
            if '=' in cookie
            for name, value in [cookie.strip().split('=', 1)]
        ])
        
        # 访问笔记页面
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
        print(f"🔗 访问：{url}")
        
        try:
            await page.goto(url, wait_until='networkidle', timeout=30000)
            print("✅ 页面加载完成")
            
            # 等待 5 秒让页面完全加载
            await asyncio.sleep(5)
            
            # 截图
            screenshot_path = f'/tmp/xhs_note_{note_id}.png'
            await page.screenshot(path=screenshot_path)
            print(f"💾 截图已保存到：{screenshot_path}")
            
            # 获取页面标题
            title = await page.title()
            print(f"📋 页面标题：{title}")
            
            # 检查是否有笔记内容
            note_content = await page.query_selector('.note-content')
            if note_content:
                print("✅ 找到笔记内容")
            else:
                print("❌ 未找到笔记内容")
            
            # 获取 URL
            current_url = page.url
            print(f"🔗 当前 URL: {current_url}")
            
            print("\n✅ 测试完成！")
            
        except Exception as e:
            print(f"❌ 加载失败：{str(e)}")
            
            # 截图调试
            screenshot_path = f'/tmp/xhs_error_{note_id}.png'
            await page.screenshot(path=screenshot_path)
            print(f"💾 错误截图已保存到：{screenshot_path}")
        
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(test_note_detail())
