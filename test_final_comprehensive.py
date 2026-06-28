#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最终完整测试套件 - 修复所有发现的问题
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

# ========== 测试 2: 搜索 API（纯同步） ==========
def test_search_sync():
    """测试搜索 API（纯同步环境）"""
    print("\n" + "="*60)
    print("测试 2: 搜索 API（纯同步）")
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
        
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        result = response.json()
        items = result.get('data', {}).get('items', [])
        
        print(f"状态码：{response.status_code}")
        print(f"✅ 返回 {len(items)} 条结果")
        
        if len(items) > 0:
            for idx, item in enumerate(items[:3], 1):
                note_card = item.get('note_card', {})
                title = note_card.get('display_title', '无标题')
                print(f"   {idx}. {title[:50]}")
        
        return len(items) > 0
        
    except Exception as e:
        print(f"❌ 搜索失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 3: 异步环境中的搜索（使用 run_in_executor） ==========
async def test_search_in_async():
    """测试在异步环境中调用搜索"""
    print("\n" + "="*60)
    print("测试 3: 异步环境中的搜索（run_in_executor）")
    print("="*60)
    
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

# ========== 辅助函数：搜索笔记 ==========
def search_notes(keyword: str = "美食", page_size: int = 10) -> list:
    """同步搜索笔记（模块级函数）"""
    client = Xhshow()
    search_id = client.get_search_id()
    a1_value = extract_cookie_value('a1')
    
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": page_size,
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

# ========== 测试 4: Playwright 详情页 ==========
async def test_playwright_detail():
    """测试 Playwright 获取详情页"""
    print("\n" + "="*60)
    print("测试 4: Playwright 详情页")
    print("="*60)
    
    # 先获取真实的笔记（page_size 必须 >= 10）
    print("📝 获取测试笔记...")
    try:
        loop = asyncio.get_event_loop()
        items = await loop.run_in_executor(None, search_notes, "美食", 10)
        items = items[:1]  # 只取第 1 条
        
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
            return False
        
        print(f"✅ 获取到笔记：{note_id}")
        
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
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        page = await context.new_page()
        
        # 注入 stealth（使用 path 参数）
        stealth_path = Path(__file__).parent / 'stealth.min.js'
        if stealth_path.exists():
            await page.add_init_script(path=str(stealth_path))
            print("✅ 已注入 stealth.min.js (path 方式)")
        
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
        await asyncio.sleep(5)
        
        # 检查页面
        title = await page.title()
        print(f"📄 页面标题：{title}")
        
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
            return True
        else:
            print("❌ 未找到笔记数据")
            return False
            
    except Exception as e:
        print(f"❌ Playwright 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False

# ========== 测试 5: Stealth 效果检测 ==========
async def test_stealth():
    """测试 stealth 效果"""
    print("\n" + "="*60)
    print("测试 5: Stealth 效果检测")
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
            await page.add_init_script(path=str(stealth_path))
            print("✅ 已注入 stealth.min.js")
        
        # 检测
        checks = await page.evaluate("""
            () => {
                return {
                    webdriver: typeof navigator.webdriver === 'undefined' ? 'undefined' : navigator.webdriver,
                    chrome_exists: typeof window.chrome !== 'undefined',
                    chrome_version: window.chrome?.app?.version || 'N/A',
                    plugins_length: navigator.plugins.length,
                    languages: navigator.languages.length,
                    vendor: navigator.vendor,
                    platform: navigator.platform
                };
            }
        """)
        
        print("\n📊 检测结果：")
        print(f"   navigator.webdriver: {checks['webdriver']}")
        print(f"   window.chrome 存在：{checks['chrome_exists']}")
        print(f"   Chrome 版本：{checks['chrome_version']}")
        print(f"   navigator.plugins: {checks['plugins_length']}")
        print(f"   navigator.languages: {checks['languages']}")
        
        await browser.close()
        
        # 判断
        passed = True
        if checks['webdriver'] != 'undefined' and checks['webdriver'] is not False:
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
        return False

# ========== 测试 6: Cookie 完整性 ==========
def test_cookie_integrity():
    """测试 Cookie 完整性"""
    print("\n" + "="*60)
    print("测试 6: Cookie 完整性")
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

# ========== 测试 7: 完整流程（搜索 + 详情） ==========
async def test_full_flow():
    """测试完整的搜索 + 详情流程"""
    print("\n" + "="*60)
    print("测试 7: 完整的搜索 + 详情流程")
    print("="*60)
    
    try:
        # 搜索（page_size 必须 >= 10）
        print("🔍 搜索笔记...")
        loop = asyncio.get_event_loop()
        all_items = await loop.run_in_executor(None, search_notes, "美食", 10)
        items = all_items[:3]  # 只取前 3 条
        
        print(f"✅ 搜索返回 {len(items)} 条结果")
        
        if not items:
            print("❌ 搜索结果为空")
            return False
        
        # 启动浏览器
        print("🌐 启动浏览器...")
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
        
        # 获取详情
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

# ========== 主函数 ==========
async def main():
    print("\n" + "="*60)
    print("🚀 开始最终完整测试套件")
    print("="*60)
    
    results = {}
    
    # 同步测试
    print("\n【同步测试】")
    results['xhshow 签名'] = test_xhshow_signature()
    results['搜索 API(同步)'] = test_search_sync()
    results['Cookie 完整性'] = test_cookie_integrity()
    
    # 异步测试
    print("\n【异步测试】")
    results['搜索 API(异步)'] = await test_search_in_async()
    results['Playwright 详情'] = await test_playwright_detail()
    results['Stealth 效果'] = await test_stealth()
    results['完整流程'] = await test_full_flow()
    
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
        return True
    else:
        print("⚠️ 存在失败的测试，请检查问题")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
