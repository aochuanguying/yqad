#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试完整的 __INITIAL_STATE__ 结构
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

async def test_full_state():
    """测试完整的 __INITIAL_STATE__ 结构"""
    print("="*60)
    print("调试完整的 __INITIAL_STATE__ 结构")
    print("="*60)
    
    note_id = "6a1022db000000003502b1c7"
    xsec_token = "ABbJA4PPvAR4Lv7XeLIOGUKLU6YATKcS3bBMtC8KHDeZk="
    url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
    
    # 启动浏览器
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
    
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
    
    # 访问页面
    print(f"访问页面...")
    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
    await asyncio.sleep(5)
    
    # 获取所有顶层 keys
    print("\n获取顶层 keys...")
    top_keys = await page.evaluate("""
        () => {
            if (window.__INITIAL_STATE__) {
                return Object.keys(window.__INITIAL_STATE__);
            }
            return null;
        }
    """)
    
    print(f"顶层 keys: {top_keys}")
    
    # 检查每个 key 是否包含笔记数据
    print("\n检查每个 key 的内容...")
    for key in top_keys:
        key_info = await page.evaluate(f"""
            () => {{
                const value = window.__INITIAL_STATE__.{key};
                if (value && typeof value === 'object') {{
                    const keys = Object.keys(value);
                    const has_title = keys.some(k => k.includes('title') || value[k]?.title);
                    const has_note = keys.some(k => k.includes('note') || k.includes('Note'));
                    
                    return {{
                        key: '{key}',
                        keys_count: keys.length,
                        has_title: has_title,
                        has_note: has_note,
                        sample_keys: keys.slice(0, 10)
                    }};
                }}
                return {{ key: '{key}', type: typeof value }};
            }}
        """)
        
        if key_info.get('has_title') or key_info.get('has_note'):
            print(f"✅ {key}: {key_info}")
    
    # 尝试从可能的位置提取
    print("\n尝试从可能的位置提取...")
    
    # 检查 global
    global_data = await page.evaluate("""
        () => {
            const g = window.__INITIAL_STATE__.global;
            if (g) {
                return {
                    keys: Object.keys(g),
                    has_note: !!g.note,
                    has_note_id: !!g.noteId,
                    has_title: !!g.title
                };
            }
            return null;
        }
    """)
    print(f"global: {global_data}")
    
    # 检查 serverData（如果有）
    if 'serverData' in top_keys:
        server_data = await page.evaluate("""
            () => {
                const sd = window.__INITIAL_STATE__.serverData;
                if (sd) {
                    return {
                        keys: Object.keys(sd),
                        has_note: !!sd.note,
                        has_note_detail: !!sd.noteDetail
                    };
                }
                return null;
            }
        """)
        print(f"serverData: {server_data}")
    
    # 检查 noteDetailMap
    note_detail_map = await page.evaluate("""
        () => {
            const map = window.__INITIAL_STATE__.note.noteDetailMap;
            if (map && typeof map === 'object') {
                const keys = Object.keys(map);
                return {
                    has_map: true,
                    keys_count: keys.length,
                    first_key: keys[0],
                    sample: keys[0] ? map[keys[0]]?.note : null
                };
            }
            return null;
        }
    """)
    
    if note_detail_map and note_detail_map.get('sample'):
        print(f"\nnoteDetailMap 中的笔记数据：")
        sample = note_detail_map['sample']
        print(f"  title: {sample.get('title', 'N/A')[:50]}")
        print(f"  user: {sample.get('user', {}).get('nickname', 'N/A')}")
        print(f"  desc: {sample.get('desc', 'N/A')[:100]}")
    
    await browser.close()

if __name__ == "__main__":
    asyncio.run(test_full_state())
