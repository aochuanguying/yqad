#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试从 note 对象中提取数据
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
        
        # 检查 note.noteDetailMap
        note_data = await page.evaluate("""
            () => {
                const results = {};
                if (window.__INITIAL_STATE__) {
                    const state = window.__INITIAL_STATE__;
                    
                    // 检查 noteDetailMap
                    if (state.note && state.note.noteDetailMap) {
                        const map = state.note.noteDetailMap;
                        results.noteDetailMapKeys = Object.keys(map);
                        results.noteDetailMapLength = Object.keys(map).length;
                        
                        // 获取第一个笔记
                        if (Object.keys(map).length > 0) {
                            const firstKey = Object.keys(map)[0];
                            const firstNote = map[firstKey];
                            results.firstNote = {
                                keys: Object.keys(firstNote),
                                id: firstNote.id,
                                xsec_token: firstNote.xsec_token
                            };
                        }
                    }
                    
                    // 检查所有包含 note 的 key
                    if (state.note) {
                        results.noteAllKeys = Object.keys(state.note);
                    }
                }
                return results;
            }
        """)
        
        print("\nnote 对象数据:")
        print(json.dumps(note_data, indent=2, ensure_ascii=False))
        
        # 直接查找所有包含 xsec_token 的对象
        all_xsec_tokens = await page.evaluate("""
            () => {
                const tokens = [];
                
                function searchObject(obj, path = '') {
                    if (typeof obj !== 'object' || obj === null) return;
                    
                    for (const key in obj) {
                        const currentPath = path ? `${path}.${key}` : key;
                        
                        if (key.toLowerCase().includes('xsec_token') || key === 'xsecToken') {
                            tokens.push({
                                path: currentPath,
                                value: obj[key]
                            });
                        }
                        
                        if (typeof obj[key] === 'object' && obj[key] !== null && key !== 'noteDetailMap') {
                            searchObject(obj[key], currentPath);
                        }
                    }
                }
                
                if (window.__INITIAL_STATE__) {
                    searchObject(window.__INITIAL_STATE__);
                }
                
                return tokens.slice(0, 20); // 只返回前 20 个
            }
        """)
        
        print(f"\n找到 {len(all_xsec_tokens)} 个 xsec_token:")
        for item in all_xsec_tokens:
            print(f"  {item['path']}: {item['value'][:50]}...")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
