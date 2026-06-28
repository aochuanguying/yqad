#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试笔记详情页面结构 - 找到所有可能的元素
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
        
        # 从 JavaScript 中提取笔记数据
        note_data = await page.evaluate("""
            () => {
                const result = {};
                if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                    const note = window.__INITIAL_STATE__.note;
                    
                    // currentNote
                    if (note.currentNote) {
                        result.currentNote = {
                            id: note.currentNote.id,
                            title: note.currentNote.title,
                            desc: note.currentNote.desc,
                            xsec_token: note.currentNote.xsec_token,
                            user: note.currentNote.user ? {
                                nickname: note.currentNote.user.nickname,
                                userid: note.currentNote.user.userid
                            } : null
                        };
                    }
                    
                    // noteDetailMap
                    if (note.noteDetailMap) {
                        const keys = Object.keys(note.noteDetailMap);
                        result.noteDetailMapKeys = keys;
                        
                        if (keys.length > 0) {
                            const firstKey = keys.find(k => k !== 'undefined' && k !== '');
                            if (firstKey && note.noteDetailMap[firstKey]) {
                                const detail = note.noteDetailMap[firstKey];
                                if (detail.note) {
                                    result.noteFromMap = {
                                        id: detail.note.id,
                                        title: detail.note.title,
                                        desc: detail.note.desc,
                                        xsec_token: detail.note.xsec_token,
                                        user: detail.note.user ? {
                                            nickname: detail.note.user.nickname,
                                            userid: detail.note.user.userid
                                        } : null
                                    };
                                }
                            }
                        }
                    }
                }
                return result;
            }
        """)
        
        import json
        print("\n从 __INITIAL_STATE__ 提取的数据:")
        print(json.dumps(note_data, indent=2, ensure_ascii=False))
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
