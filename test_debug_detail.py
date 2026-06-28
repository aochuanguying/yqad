#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试详情页获取
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

async def test_detail_page():
    """测试详情页获取"""
    print("="*60)
    print("调试详情页获取")
    print("="*60)
    
    # 使用之前测试成功的笔记
    note_id = "6a1022db000000003502b1c7"
    xsec_token = "ABbJA4PPvAR4Lv7XeLIOGUKLU6YATKcS3bBMtC8KHDeZk="
    
    url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
    print(f"\n访问 URL: {url}")
    
    # 启动浏览器
    print("\n启动浏览器...")
    playwright = await async_playwright().start()
    
    browser = await playwright.chromium.launch(
        headless=True,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
        ]
    )
    
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        locale='zh-CN',
        timezone_id='Asia/Shanghai',
    )
    
    # 设置 Cookie
    cookies = []
    for item in COOKIE.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            cookies.append({
                'name': k.strip(),
                'value': v.strip(),
                'domain': '.xiaohongshu.com',
                'path': '/',
            })
    
    if cookies:
        await context.add_cookies(cookies)
        print(f"✅ 已设置 {len(cookies)} 个 Cookie")
    
    page = await context.new_page()
    
    # 注入 stealth
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
        print("✅ 已注入 stealth.min.js")
    
    # 访问页面
    print("\n访问页面...")
    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
    print(f"页面标题：{await page.title()}")
    
    # 等待
    print("等待 5 秒...")
    await asyncio.sleep(5)
    
    # 检查 __INITIAL_STATE__
    print("\n检查 __INITIAL_STATE__...")
    initial_state = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__) {
                return {
                    has_note: !!window.__INITIAL_STATE__.note,
                    has_current_note: !!window.__INITIAL_STATE__.note?.currentNote,
                    keys: Object.keys(window.__INITIAL_STATE__).slice(0, 10)
                };
            }
            return null;
        }
    """)
    
    print(f"__INITIAL_STATE__: {json.dumps(initial_state, ensure_ascii=False)}")
    
    # 尝试提取数据
    print("\n尝试提取数据...")
    note_data = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                const note = window.__INITIAL_STATE__.note;
                if (note.currentNote) {
                    const cn = note.currentNote;
                    return {
                        title: cn.title,
                        desc: cn.desc?.substring(0, 100),
                        user: cn.user?.nickname || '未知用户',
                        likes: cn.interact_info?.liked_count || 0
                    };
                }
            }
            return null;
        }
    """)
    
    if note_data:
        print(f"✅ 成功提取数据：")
        print(f"   标题：{note_data['title'][:50]}")
        print(f"   作者：{note_data['user']}")
        print(f"   点赞：{note_data['likes']}")
    else:
        print("❌ 未找到数据")
        
        # 检查页面内容
        content = await page.content()
        print(f"\n页面内容长度：{len(content)} 字符")
        
        # 检查是否有错误信息
        error_text = await page.evaluate("""
            () => {
                const body = document.body.innerText;
                if (body.includes('登录') || body.includes('错误') || body.includes('异常')) {
                    return body.substring(0, 500);
                }
                return null;
            }
        """)
        
        if error_text:
            print(f"⚠️ 页面包含错误信息：{error_text[:200]}")
    
    await browser.close()

if __name__ == "__main__":
    asyncio.run(test_detail_page())
