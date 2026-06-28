#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试搜索页面结构，找到 xsec_token 的位置
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        )
        
        # 加载 stealth
        stealth_js_path = '/Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/stealth.min.js'
        page = await context.new_page()
        await page.add_init_script(path=stealth_js_path)
        
        # 设置 Cookie
        cookies = []
        for cookie_str in COOKIE.split(';'):
            if '=' in cookie_str:
                name, value = cookie_str.strip().split('=', 1)
                cookies.append({
                    'name': name.strip(),
                    'value': value.strip(),
                    'domain': '.xiaohongshu.com',
                    'path': '/',
                })
        await context.add_cookies(cookies)
        
        # 访问搜索页面
        url = "https://www.xiaohongshu.com/search_result?keyword=美食&source=web_search_result_notes"
        print(f"访问：{url}")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(5)
        
        # 查找所有包�� xsec_token 的 JavaScript 变量
        print("\n查找页面中的 xsec_token...")
        
        tokens = await page.evaluate("""
            () => {
                const results = [];
                
                // 查找所有全局变量
                for (let key in window) {
                    try {
                        if (key.toLowerCase().includes('xsec') || key.toLowerCase().includes('token')) {
                            const val = window[key];
                            if (typeof val === 'string' && val.length > 10) {
                                results.push({ key, value: val.substring(0, 100) });
                            }
                        }
                    } catch (e) {}
                }
                
                // 查找 __INITIAL_STATE__
                if (window.__INITIAL_STATE__) {
                    try {
                        const state = window.__INITIAL_STATE__;
                        results.push({
                            key: '__INITIAL_STATE__ keys',
                            value: Object.keys(state).join(', ')
                        });
                        
                        // 搜索结果 - 正确的 key 是 search.feeds
                        if (state.search) {
                            const sr = state.search;
                            results.push({
                                key: 'search keys',
                                value: Object.keys(sr).join(', ')
                            });
                            
                            if (sr.feeds && Array.isArray(sr.feeds)) {
                                results.push({
                                    key: 'feeds length',
                                    value: sr.feeds.length.toString()
                                });
                                
                                // 查看第一个笔记
                                if (sr.feeds[0]) {
                                    const first = sr.feeds[0];
                                    results.push({
                                        key: 'first note keys',
                                        value: Object.keys(first).join(', ')
                                    });
                                    
                                    if (first.xsec_token) {
                                        results.push({
                                            key: 'first xsec_token',
                                            value: first.xsec_token
                                        });
                                    }
                                    
                                    if (first.id || first.note_id) {
                                        results.push({
                                            key: 'first id',
                                            value: first.id || first.note_id
                                        });
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        results.push({ key: 'error', value: e.message });
                    }
                }
                
                return results;
            }
        """)
        
        print(f"\n找到 {len(tokens)} 个相关变量:")
        for item in tokens:
            print(f"  {item['key']}: {item['value'][:200]}")
        
        # 保存 HTML
        html = await page.content()
        with open('/tmp/search_debug.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"\n💾 HTML 已保存：/tmp/search_debug.html")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
