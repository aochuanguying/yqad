#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试 note 对象的结构
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

async def test_note_structure():
    """测试 note 对象结构"""
    print("="*60)
    print("调试 note 对象结构")
    print("="*60)
    
    note_id = "6a1022db000000003502b1c7"
    xsec_token = "ABbJA4PPvAR4Lv7XeLIOGUKLU6YATKcS3bBMtC8KHDeZk="
    url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
    
    # 启动浏览器
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
    
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
    
    await context.add_cookies(cookies)
    page = await context.new_page()
    
    # 注入 stealth
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
    
    # 访问页面
    print(f"访问页面...")
    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
    await asyncio.sleep(5)
    
    # 检查 note 对象的完整结构
    print("\n检查 note 对象结构...")
    note_structure = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                const note = window.__INITIAL_STATE__.note;
                const keys = Object.keys(note);
                
                return {
                    keys: keys,
                    has_currentNote: !!note.currentNote,
                    has_noteDetail: !!note.noteDetail,
                    has_detail: !!note.detail,
                    note_keys: keys.slice(0, 20)
                };
            }
            return null;
        }
    """)
    
    print(f"note 对象结构：{note_structure}")
    
    # 尝试从不同位置提取数据
    print("\n尝试从不同位置提取数据...")
    
    # 尝试 1: currentNote
    data1 = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__?.note?.currentNote) {
                const cn = window.__INITIAL_STATE__.note.currentNote;
                return { source: 'currentNote', title: cn.title, user: cn.user?.nickname };
            }
            return null;
        }
    """)
    print(f"currentNote: {data1}")
    
    # 尝试 2: noteDetail
    data2 = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__?.note?.noteDetail) {
                const nd = window.__INITIAL_STATE__.note.noteDetail;
                return { source: 'noteDetail', title: nd.title, user: nd.user?.nickname };
            }
            return null;
        }
    """)
    print(f"noteDetail: {data2}")
    
    # 尝试 3: detail
    data3 = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__?.note?.detail) {
                const d = window.__INITIAL_STATE__.note.detail;
                return { source: 'detail', title: d.title, user: d.user?.nickname };
            }
            return null;
        }
    """)
    print(f"detail: {data3}")
    
    # 尝试 4: 遍历所有 key 找 title
    print("\n遍历 note 对象的所有 key 找 title...")
    title_search = await page.evaluate("""
        () => {
            if (!window.__INITIAL_STATE__?.note) return null;
            
            const note = window.__INITIAL_STATE__.note;
            const results = [];
            
            for (const key of Object.keys(note)) {
                const value = note[key];
                if (value && typeof value === 'object' && value.title) {
                    results.push({
                        key: key,
                        title: value.title,
                        has_user: !!value.user
                    });
                }
            }
            
            return results;
        }
    """)
    
    print(f"找到 title 的 keys: {title_search}")
    
    await browser.close()

if __name__ == "__main__":
    asyncio.run(test_note_structure())
