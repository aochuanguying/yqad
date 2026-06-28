#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复版本的测试 - 解决发现的问题
"""

import asyncio
import json
import time
import random
from pathlib import Path
from playwright.async_api import async_playwright
from typing import List, Dict, Optional
import requests
from xhshow import Xhshow

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

def extract_cookie_value(key: str) -> Optional[str]:
    for item in COOKIE.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            if k.strip() == key:
                return v.strip()
    return None

# ========== 测试 1: 使用真实笔记 ID 测试详情页 ==========
async def test_playwright_with_real_note():
    """使用已知有效的笔记测试详情页"""
    print("\n" + "="*60)
    print("测试 1: Playwright 详情页（使用真实笔记）")
    print("="*60)
    
    # 先通过同步搜索获取真实的笔记 ID 和 token
    print("📝 先通过搜索获取真实的笔记...")
    try:
        client = Xhshow()
        search_id = client.get_search_id()
        a1_value = extract_cookie_value('a1')
        
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        payload = {
            "keyword": "美食",
            "page": 1,
            "page_size": 1,
            "search_id": search_id,
            "sort": "general",
            "note_type": 0
        }
        
        signature = client.sign_xs_post(
            uri="/api/sns/web/v2/search/notes",
            a1_value=a1_value,
            payload=payload
        )
        
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "content-type": "application/json;charset=UTF-8",
        }
        
        cookie_dict = {}
        for item in COOKIE.split(';'):
            if '=' in item:
                k, v = item.split('=', 1)
                cookie_dict[k.strip()] = v.strip()
        
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        result = response.json()
        items = result.get('data', {}).get('items', [])
        
        if not items:
            print("❌ 搜索结果为空")
            return False
        
        item = items[0]
        note_card = item.get('note_card', {})
        note_id = note_card.get('id')
        
        xsec_token = item.get('xsec_token')
        if not xsec_token:
            xsec_token = note_card.get('xsec_token')
        if not xsec_token:
            user = note_card.get('user', {})
            xsec_token = user.get('xsec_token')
        
        if not note_id or not xsec_token:
            print(f"❌ 无法提取笔记 ID 或 token")
            print(f"   note_id: {note_id}")
            print(f"   xsec_token: {xsec_token}")
            return False
        
        print(f"✅ 获取到笔记：{note_id}, token: {xsec_token}")
        
    except Exception as e:
        print(f"❌ 获取测试笔记失败：{e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 启动浏览器访问详情页
    try:
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
        
        page = await context.new_page()
        
        # 注入 stealth
        stealth_path = Path(__file__).parent / 'stealth.min.js'
        if stealth_path.exists():
            stealth_content = stealth_path.read_text(encoding='utf-8')
            await page.add_init_script(source=stealth_content)
            print("✅ 已注入 stealth.min.js (source 方式)")
        
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
        
        # 访问详情页
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
        print(f"🌐 访问：{url}")
        
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        await asyncio.sleep(5)  # 多等一会儿让页面完全加载
        
        # 检查页面标题
        title = await page.title()
        print(f"📄 页面标题：{title}")
        
        # 检查是否有内容
        content = await page.content()
        print(f"📄 页面内容长度：{len(content)} 字符")
        
        # 检查 __INITIAL_STATE__
        initial_state = await page.evaluate("""
            () => {
                if (window.__INITIAL_STATE__) {
                    return {
                        has_note: !!window.__INITIAL_STATE__.note,
                        has_current_note: !!window.__INITIAL_STATE__.note?.currentNote,
                        keys: Object.keys(window.__INITIAL_STATE__)
                    };
                }
                return null;
            }
        """)
        
        print(f"📦 __INITIAL_STATE__: {initial_state}")
        
        # 提取笔记数据
        note_data = await page.evaluate("""
            () => {
                if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                    const note = window.__INITIAL_STATE__.note;
                    if (note.currentNote) {
                        const cn = note.currentNote;
                        return {
                            title: cn.title,
                            user: cn.user?.nickname || '未知用户',
                            likes: cn.interact_info?.liked_count || 0,
                            desc: cn.desc?.substring(0, 100)
                        };
                    }
                }
                return null;
            }
        """)
        
        await browser.close()
        
        if note_data:
            print(f"✅ 成功获取笔记数据：")
            print(f"   标题：{note_data['title'][:50]}")
            print(f"   作者：{note_data['user']}")
            print(f"   点赞：{note_data['likes']}")
            print(f"   描述：{note_data['desc']}")
            return True
        else:
            print("❌ 未找到笔记数据")
            print("💡 可能原因：页面未完全加载、Cookie 失效、或需要登录")
            return False
            
    except Exception as e:
        print(f"❌ Playwright 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 2: 在异步环境中调用搜索 ==========
async def test_search_in_async():
    """测试在异步环境中调用搜索"""
    print("\n" + "="*60)
    print("测试 2: 异步环境中的搜索 API")
    print("="*60)
    
    # 使用 run_in_executor 在同步线程中执行
    import functools
    
    def sync_search():
        """同步搜索函数"""
        client = Xhshow()
        search_id = client.get_search_id()
        a1_value = extract_cookie_value('a1')
        
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        payload = {
            "keyword": "美食",
            "page": 1,
            "page_size": 10,
            "search_id": search_id,
            "sort": "general",
            "note_type": 0
        }
        
        signature = client.sign_xs_post(
            uri="/api/sns/web/v2/search/notes",
            a1_value=a1_value,
            payload=payload
        )
        
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "content-type": "application/json;charset=UTF-8",
        }
        
        cookie_dict = {}
        for item in COOKIE.split(';'):
            if '=' in item:
                k, v = item.split('=', 1)
                cookie_dict[k.strip()] = v.strip()
        
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        result = response.json()
        items = result.get('data', {}).get('items', [])
        return items
    
    try:
        # 在线程池中执行同步函数
        loop = asyncio.get_event_loop()
        items = await loop.run_in_executor(None, sync_search)
        
        print(f"✅ 搜索返回 {len(items)} 条结果")
        
        if items:
            for idx, item in enumerate(items[:3], 1):
                note_card = item.get('note_card', {})
                title = note_card.get('display_title', '无标题')
                print(f"   {idx}. {title[:50]}")
        
        return len(items) > 0
        
    except Exception as e:
        print(f"❌ 异步搜索失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 3: 增强的 stealth 检测 ==========
async def test_enhanced_stealth():
    """测试增强的 stealth 效果"""
    print("\n" + "="*60)
    print("测试 3: 增强的 Stealth 检测")
    print("="*60)
    
    try:
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
        )
        
        page = await context.new_page()
        
        # 注入 stealth
        stealth_path = Path(__file__).parent / 'stealth.min.js'
        if stealth_path.exists():
            stealth_content = stealth_path.read_text(encoding='utf-8')
            await page.add_init_script(source=stealth_content)
            print("✅ 已注入 stealth.min.js")
        
        # 访问一个简单页面进行检测
        await page.goto('https://httpbin.org/html', wait_until='domcontentloaded', timeout=10000)
        
        # 详细检测
        checks = await page.evaluate("""
            () => {
                const results = {
                    webdriver: typeof navigator.webdriver === 'undefined' ? 'undefined' : navigator.webdriver,
                    chrome_exists: typeof window.chrome !== 'undefined',
                    chrome_version: window.chrome?.app?.version || 'N/A',
                    plugins_length: navigator.plugins.length,
                    languages: navigator.languages.length,
                    vendor: navigator.vendor,
                    platform: navigator.platform
                };
                return results;
            }
        """)
        
        print("\n📊 检测结果：")
        print(f"   navigator.webdriver: {checks['webdriver']} (应为 undefined 或 false)")
        print(f"   window.chrome 存在：{checks['chrome_exists']} (应为 true)")
        print(f"   Chrome 版本：{checks['chrome_version']}")
        print(f"   navigator.plugins: {checks['plugins_length']} (应 > 0)")
        print(f"   navigator.languages: {checks['languages']} (应 > 0)")
        print(f"   navigator.vendor: {checks['vendor']}")
        print(f"   navigator.platform: {checks['platform']}")
        
        await browser.close()
        
        # 判断是否通过
        passed = True
        if checks['webdriver'] is not 'undefined' and checks['webdriver'] is not False:
            print("⚠️ navigator.webdriver 未被正确覆盖")
            passed = False
        
        if not checks['chrome_exists']:
            print("⚠️ window.chrome 不存在")
            passed = False
        
        if checks['plugins_length'] == 0:
            print("⚠️ navigator.plugins 为空")
            passed = False
        
        if passed:
            print("✅ Stealth 检测通过")
            return True
        else:
            print("⚠️ Stealth 检测未完全通过")
            return False
            
    except Exception as e:
        print(f"❌ Stealth 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 主函数 ==========
async def main():
    print("\n" + "="*60)
    print("🚀 开始修复版测试套件")
    print("="*60)
    
    results = {}
    
    # 测试 1: Playwright 详情页
    results['Playwright 详情页'] = await test_playwright_with_real_note()
    
    # 测试 2: 异步环境搜索
    results['异步环境搜索'] = await test_search_in_async()
    
    # 测试 3: Stealth 效果
    results['Stealth 效果'] = await test_enhanced_stealth()
    
    # 汇总
    print("\n" + "="*60)
    print("📊 测试结果汇总")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{status} - {test_name}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    
    print(f"\n总计：{total_passed}/{total_tests} 项测试通过")
    
    if total_passed == total_tests:
        print("🎉 所有测试通过！可以安全部署！")
    else:
        print("⚠️ 存在失败的测试，请检查问题")
    
    return results

if __name__ == "__main__":
    results = asyncio.run(main())
