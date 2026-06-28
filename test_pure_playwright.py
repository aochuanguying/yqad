#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试纯 Playwright 方案
访问小红书搜索页面，从页面中提取搜索结果
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

async def test_pure_playwright_search():
    """测试纯 Playwright 搜索方案"""
    print("="*60)
    print("测试纯 Playwright 搜索方案")
    print("="*60)
    
    keyword = "美食"
    search_url = f"https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes"
    
    print(f"\n访问搜索页面：{search_url}")
    
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
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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
    
    # 访问搜索页面
    print("\n访问搜索页面...")
    await page.goto(search_url, wait_until='domcontentloaded', timeout=30000)
    
    print(f"页面标题：{await page.title()}")
    
    # 等待搜索结果加载
    print("等待搜索结果加载...")
    await asyncio.sleep(5)
    
    # 尝试从 __INITIAL_STATE__ 提取数据
    print("\n尝试从 __INITIAL_STATE__ 提取数据...")
    search_results = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.search) {
                const search = window.__INITIAL_STATE__.search;
                
                // 尝试从不同位置提取
                const results = {
                    has_search: true,
                    state: search.state,
                    has_feeds: !!search.feeds,
                    has_feedsWrapper: !!search.feedsWrapper,
                    feeds_count: search.feeds?.length || 0,
                };
                
                // 提取前几条笔记
                if (search.feeds && search.feeds.length > 0) {
                    results.sample_notes = search.feeds.slice(0, 3).map(feed => ({
                        id: feed.id,
                        title: feed.display_title || feed.title,
                        note_id: feed.note_id || feed.id
                    }));
                }
                
                return results;
            }
            return null;
        }
    """)
    
    print(f"搜索结果：{json.dumps(search_results, ensure_ascii=False, indent=2)}")
    
    # 尝试从页面元素提取
    print("\n尝试从页面元素提取...")
    note_elements = await page.evaluate("""
        () => {
            // 查找笔记卡片
            const cards = document.querySelectorAll('[class*="note-item"], [class*="search-result"]');
            return {
                count: cards.length,
                sample: Array.from(cards.slice(0, 3)).map(card => ({
                    title: card.innerText?.substring(0, 50),
                    has_image: !!card.querySelector('img')
                }))
            };
        }
    """)
    
    print(f"页面元素：{json.dumps(note_elements, ensure_ascii=False, indent=2)}")
    
    # 检查是否有错误
    error_check = await page.evaluate("""
        () => {
            const body = document.body.innerText;
            if (body.includes('登录') || body.includes('验证')) {
                return '需要登录或验证';
            }
            return null;
        }
    """)
    
    if error_check:
        print(f"⚠️ 检测到：{error_check}")
    
    await browser.close()
    
    # 总结
    print("\n" + "="*60)
    print("测试总结")
    print("="*60)
    
    if search_results and search_results.get('feeds_count', 0) > 0:
        print(f"✅ 成功获取搜索结果：{search_results['feeds_count']} 条")
        if search_results.get('sample_notes'):
            for idx, note in enumerate(search_results['sample_notes'], 1):
                print(f"   {idx}. {note['title'][:50]}")
        return True
    else:
        print("❌ 未获取到搜索结果")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_pure_playwright_search())
    print(f"\n最终结果：{'✅' if result else '❌'}")
