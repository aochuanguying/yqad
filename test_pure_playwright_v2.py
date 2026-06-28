#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试纯 Playwright 方案 - v2
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

async def test_pure_playwright_search():
    """测试纯 Playwright 搜索方案"""
    print("="*60)
    print("测试纯 Playwright 搜索方案 - v2")
    print("="*60)
    
    keyword = "美食"
    search_url = f"https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes"
    
    print(f"\n访问搜索页面：{search_url}")
    
    # 启动浏览器
    playwright = await async_playwright().start()
    
    browser = await playwright.chromium.launch(
        headless=True,
        args=['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
    )
    
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        locale='zh-CN',
        timezone_id='Asia/Shanghai',
    )
    
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
    
    await context.add_cookies(cookies)
    page = await context.new_page()
    
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
    
    # 访问搜索页面
    print("\n访问搜索页面...")
    await page.goto(search_url, wait_until='domcontentloaded', timeout=30000)
    
    print(f"页面标题：{await page.title()}")
    
    # 等待搜索结果加载
    print("等待搜索结果加载（5 秒）...")
    await asyncio.sleep(5)
    
    # 检查 __INITIAL_STATE__ 的所有顶层 keys
    print("\n检查 __INITIAL_STATE__ 结构...")
    top_keys = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__) {
                return Object.keys(window.__INITIAL_STATE__);
            }
            return null;
        }
    """)
    
    print(f"顶层 keys: {top_keys}")
    
    # 检查是否有 search 相关的数据
    if 'search' in top_keys:
        print("\n找到 search 对象，检查内容...")
        search_data = await page.evaluate("""
            () => {
                const s = window.__INITIAL_STATE__.search;
                return {
                    keys: Object.keys(s),
                    has_feeds: !!s.feeds,
                    feeds_count: s.feeds?.length || 0
                };
            }
        """)
        print(f"search 数据：{search_data}")
    else:
        print("\n❌ 未找到 search 对象")
    
    # 尝试从 feed 对象查找
    if 'feed' in top_keys:
        print("\n检查 feed 对象...")
        feed_data = await page.evaluate("""
            () => {
                const f = window.__INITIAL_STATE__.feed;
                return {
                    keys: Object.keys(f),
                    has_feeds: !!f.feeds,
                    feeds_count: f.feeds?.length || 0
                };
            }
        """)
        print(f"feed 数据：{feed_data}")
    
    # 检查页面元素
    print("\n检查页面元素...")
    page_check = await page.evaluate("""
        () => {
            // 查找所有可能的笔记卡片
            const selectors = [
                '[class*="note"]',
                '[class*="search"]',
                '[class*="feed"]',
                'article',
                'section'
            ];
            
            let total = 0;
            let sample = [];
            
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    total += els.length;
                    if (sample.length < 3) {
                        sample.push({
                            selector: sel,
                            count: els.length,
                            text: els[0]?.innerText?.substring(0, 50)
                        });
                    }
                }
            }
            
            return { total_elements: total, sample: sample };
        }
    """)
    
    print(f"页面元素：{json.dumps(page_check, ensure_ascii=False, indent=2)}")
    
    # 检查是否有错误信息
    error_check = await page.evaluate("""
        () => {
            const body = document.body.innerText;
            if (body.includes('登录') || body.includes('验证') || body.includes('安全验证')) {
                return '需要登录或验证';
            }
            return null;
        }
    """)
    
    if error_check:
        print(f"\n⚠️ 检测到：{error_check}")
    
    await browser.close()
    
    # 总结
    print("\n" + "="*60)
    print("测试结论")
    print("="*60)
    
    has_data = False
    
    if 'search' in top_keys:
        print("✅ 找到 search 对象")
        has_data = True
    if 'feed' in top_keys:
        print("✅ 找到 feed 对象")
        has_data = True
    if page_check['total_elements'] > 10:
        print(f"✅ 找到 {page_check['total_elements']} 个页面元素")
        has_data = True
    
    if error_check:
        print(f"❌ 存在问题：{error_check}")
    
    if has_data and not error_check:
        print("\n✅ 纯 Playwright 方案可行！")
        return True
    else:
        print("\n⚠️ 纯 Playwright 方案可能存在问题")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_pure_playwright_search())
    print(f"\n最终结果：{'✅' if result else '❌'}")
