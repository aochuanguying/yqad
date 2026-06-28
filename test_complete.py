#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整的测试套件 - 测试所有可能的死角
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

# Cookie (使用验证成功的 Cookie)
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

# 提取 Cookie 值
def extract_cookie_value(key: str) -> Optional[str]:
    for item in COOKIE.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            if k.strip() == key:
                return v.strip()
    return None

# ========== 测试 1: xhshow 签名生成 ==========
def test_xhshow_signature():
    """测试 xhshow 签名生成"""
    print("\n" + "="*60)
    print("测试 1: xhshow 签名生成")
    print("="*60)
    
    try:
        client = Xhshow()
        search_id = client.get_search_id()
        print(f"✅ search_id 生成成功：{search_id}")
        
        a1_value = extract_cookie_value('a1')
        if not a1_value:
            print("❌ 无法提取 a1 值")
            return False
        
        payload = {
            "keyword": "测试",
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
        
        print(f"✅ 签名生成成功：{signature[:50]}...")
        print(f"   签名长度：{len(signature)}")
        
        return True
        
    except Exception as e:
        print(f"❌ 签名生成失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 2: 搜索 API（同步） ==========
def test_search_api():
    """测试搜索 API"""
    print("\n" + "="*60)
    print("测试 2: 搜索 API（同步）")
    print("="*60)
    
    try:
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
            "accept": "application/json, text/plain, */*",
        }
        
        cookie_dict = {}
        for item in COOKIE.split(';'):
            if '=' in item:
                k, v = item.split('=', 1)
                cookie_dict[k.strip()] = v.strip()
        
        print(f"发送搜索请求...")
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        print(f"状态码：{response.status_code}")
        
        result = response.json()
        items = result.get('data', {}).get('items', [])
        
        print(f"✅ 返回 {len(items)} 条结果")
        
        if len(items) > 0:
            # 检查 xsec_token
            for idx, item in enumerate(items[:3], 1):
                xsec_token = item.get('xsec_token')
                note_card = item.get('note_card', {})
                if not xsec_token:
                    xsec_token = note_card.get('xsec_token')
                if not xsec_token:
                    user = note_card.get('user', {})
                    xsec_token = user.get('xsec_token')
                
                note_id = note_card.get('id')
                title = note_card.get('display_title', '无标题')
                
                print(f"   {idx}. {title[:50]} (id: {note_id}, token: {xsec_token[:20] if xsec_token else 'None'}...)")
        
        return len(items) > 0
        
    except Exception as e:
        print(f"❌ 搜索失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 3: Playwright 详情页 ==========
async def test_playwright_detail():
    """测试 Playwright 获取详情页"""
    print("\n" + "="*60)
    print("测试 3: Playwright 详情页（异步）")
    print("="*60)
    
    # 使用已知有效的笔记 ID 和 token
    test_note_id = "67d044d80000000006013d48"
    test_xsec_token = "Ab1234567890abcdef"  # 这里需要一个真实的 token
    
    # 先搜索获取一个真实的 token
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
        
        if items:
            item = items[0]
            note_card = item.get('note_card', {})
            test_note_id = note_card.get('id')
            test_xsec_token = item.get('xsec_token') or note_card.get('xsec_token')
            
            if not test_xsec_token:
                user = note_card.get('user', {})
                test_xsec_token = user.get('xsec_token')
            
            print(f"使用测试笔记：{test_note_id}, token: {test_xsec_token}")
        else:
            print("❌ 无法获取测试笔记")
            return False
            
    except Exception as e:
        print(f"❌ 获取测试笔记失败：{e}")
        return False
    
    # 启动浏览器
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
            await page.add_init_script(path=str(stealth_path))
            print("✅ 已注入 stealth.min.js")
        
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
        url = f"https://www.xiaohongshu.com/explore/{test_note_id}?xsec_token={test_xsec_token}"
        print(f"访问：{url}")
        
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        await asyncio.sleep(3)
        
        # 检查是否被检测
        webdriver = await page.evaluate("navigator.webdriver")
        print(f"navigator.webdriver: {webdriver}")
        
        # 提取数据
        note_data = await page.evaluate("""
            () => {
                if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                    const note = window.__INITIAL_STATE__.note;
                    if (note.currentNote) {
                        const cn = note.currentNote;
                        return {
                            title: cn.title,
                            user: cn.user?.nickname || '未知用户',
                            likes: cn.interact_info?.liked_count || 0
                        };
                    }
                }
                return null;
            }
        """)
        
        if note_data:
            print(f"✅ 成功获取笔记：{note_data['title'][:50]}")
            print(f"   作者：{note_data['user']} | ❤️ {note_data['likes']}")
            await browser.close()
            return True
        else:
            print("❌ 未找到笔记数据")
            await browser.close()
            return False
            
    except Exception as e:
        print(f"❌ Playwright 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 4: 完整的搜索 + 详情流程 ==========
async def test_full_flow():
    """测试完整的搜索 + 详情流程"""
    print("\n" + "="*60)
    print("测试 4: 完整的搜索 + 详情流程")
    print("="*60)
    
    try:
        # 搜索
        client = Xhshow()
        search_id = client.get_search_id()
        a1_value = extract_cookie_value('a1')
        
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        payload = {
            "keyword": "美食",
            "page": 1,
            "page_size": 3,
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
        
        print(f"搜索返回 {len(items)} 条结果")
        
        if not items:
            print("❌ 搜索结果为空")
            return False
        
        # 启动浏览器获取详情
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        )
        
        page = await context.new_page()
        
        stealth_path = Path(__file__).parent / 'stealth.min.js'
        if stealth_path.exists():
            await page.add_init_script(path=str(stealth_path))
        
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
        
        success_count = 0
        for idx, item in enumerate(items, 1):
            note_card = item.get('note_card', {})
            note_id = note_card.get('id')
            
            xsec_token = item.get('xsec_token')
            if not xsec_token:
                xsec_token = note_card.get('xsec_token')
            if not xsec_token:
                user = note_card.get('user', {})
                xsec_token = user.get('xsec_token')
            
            if not note_id or not xsec_token:
                print(f"⚠️ 跳过第 {idx} 条（缺少必要参数）")
                continue
            
            try:
                url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
                await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                await asyncio.sleep(2)
                
                note_data = await page.evaluate("""
                    () => {
                        if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                            const note = window.__INITIAL_STATE__.note;
                            if (note.currentNote) {
                                return {
                                    title: note.currentNote.title,
                                    user: note.currentNote.user?.nickname || '未知用户'
                                };
                            }
                        }
                        return null;
                    }
                """)
                
                if note_data:
                    print(f"✅ {idx}. {note_data['title'][:50]} | {note_data['user']}")
                    success_count += 1
                else:
                    print(f"❌ {idx}. 未获取到数据")
                    
            except Exception as e:
                print(f"❌ {idx}. 获取失败：{e}")
        
        await browser.close()
        
        print(f"\n成功获取 {success_count}/{len(items)} 条笔记详情")
        return success_count > 0
        
    except Exception as e:
        print(f"❌ 完整流程测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 5: Cookie 完整性检查 ==========
def test_cookie_integrity():
    """测试 Cookie 完整性"""
    print("\n" + "="*60)
    print("测试 5: Cookie 完整性检查")
    print("="*60)
    
    required_cookies = ['a1', 'web_session', 'id_token']
    missing = []
    
    for key in required_cookies:
        value = extract_cookie_value(key)
        if value:
            print(f"✅ {key}: {value[:30]}...")
        else:
            print(f"❌ {key}: 缺失")
            missing.append(key)
    
    if missing:
        print(f"⚠️ 缺少必要的 Cookie: {', '.join(missing)}")
        return False
    else:
        print("✅ 所有必要的 Cookie 都存在")
        return True

# ========== 测试 6: Stealth 效果检测 ==========
async def test_stealth_effect():
    """测试 stealth 效果"""
    print("\n" + "="*60)
    print("测试 6: Stealth 效果检测")
    print("="*60)
    
    try:
        playwright = await async_playwright().start()
        
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        )
        
        page = await context.new_page()
        
        # 注入 stealth
        stealth_path = Path(__file__).parent / 'stealth.min.js'
        if stealth_path.exists():
            await page.add_init_script(path=str(stealth_path))
            print("✅ 已注入 stealth.min.js")
        
        # 检查各项指标
        checks = {
            'navigator.webdriver': await page.evaluate("navigator.webdriver"),
            'window.chrome': await page.evaluate("typeof window.chrome !== 'undefined'"),
            'navigator.plugins.length': await page.evaluate("navigator.plugins.length"),
        }
        
        print("\n检测结果：")
        print(f"  navigator.webdriver: {checks['navigator.webdriver']} (应为 False/undefined)")
        print(f"  window.chrome 存在：{checks['window.chrome']} (应为 True)")
        print(f"  navigator.plugins: {checks['navigator.plugins.length']} (应 > 0)")
        
        await browser.close()
        
        # 判断是否通过
        passed = True
        if checks['navigator.webdriver'] is not None and checks['navigator.webdriver'] is not False:
            print("⚠️ navigator.webdriver 未被正确覆盖")
            passed = False
        
        if not checks['window.chrome']:
            print("⚠️ window.chrome 不存在")
            passed = False
        
        if passed:
            print("✅ Stealth 检测通过")
            return True
        else:
            print("⚠️ Stealth 检测未完全通过")
            return False
            
    except Exception as e:
        print(f"❌ Stealth 测试失败：{e}")
        return False

# ========== 主函数 ==========
async def main():
    print("\n" + "="*60)
    print("🚀 开始完整测试套件")
    print("="*60)
    
    results = {}
    
    # 同步测试
    results['xhshow 签名'] = test_xhshow_signature()
    results['搜索 API'] = test_search_api()
    results['Cookie 完整性'] = test_cookie_integrity()
    
    # 异步测试
    results['Playwright 详情'] = await test_playwright_detail()
    results['完整流程'] = await test_full_flow()
    results['Stealth 效果'] = await test_stealth_effect()
    
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
