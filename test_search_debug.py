#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
深度测试搜索页面结构
"""

import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154"
    
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
        
        url = "https://www.xiaohongshu.com/search_result?keyword=美食&source=web_search_result_notes"
        print(f"访问：{url}")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(5)
        
        # 提取 search.feeds 中的第一个笔记的完整结构
        first_note = await page.evaluate("""
            () => {
                if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.search) {
                    const search = window.__INITIAL_STATE__.search;
                    if (search.feeds && Array.isArray(search.feeds) && search.feeds.length > 0) {
                        return search.feeds[0];
                    }
                }
                return null;
            }
        """)
        
        if first_note:
            print("\n✅ 找到第一个笔记:")
            print(json.dumps(first_note, indent=2, ensure_ascii=False)[:3000])
        else:
            print("\n❌ 未找到笔记数据")
            
            # 尝试查找所有可能的数据源
            all_data = await page.evaluate("""
                () => {
                    const results = {};
                    if (window.__INITIAL_STATE__) {
                        const state = window.__INITIAL_STATE__;
                        
                        // 检查 search
                        if (state.search) {
                            results.search = {
                                keys: Object.keys(state.search),
                                hasFeeds: !!state.search.feeds,
                                feedsLength: Array.isArray(state.search.feeds) ? state.search.feeds.length : 0
                            };
                        }
                        
                        // 检查 searchResult
                        if (state.searchResult) {
                            results.searchResult = {
                                keys: Object.keys(state.searchResult),
                                hasData: !!state.searchResult.data,
                                dataLength: Array.isArray(state.searchResult.data) ? state.searchResult.data.length : 0
                            };
                        }
                        
                        // 检查 note
                        if (state.note) {
                            results.note = {
                                keys: Object.keys(state.note)
                            };
                        }
                    }
                    return results;
                }
            """)
            print("\n所有可能的数据源:")
            print(json.dumps(all_data, indent=2, ensure_ascii=False))
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
