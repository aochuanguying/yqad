#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试不登录能否访问小红书
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def test_no_login():
    """测试不登录访问"""
    print("="*60)
    print("测试不登录访问小红书")
    print("="*60)
    
    # 启动浏览器（不设置 Cookie）
    print("\n启动浏览器（无 Cookie）...")
    playwright = await async_playwright().start()
    
    browser = await playwright.chromium.launch(
        headless=True,
        args=['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
    )
    
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    )
    
    page = await context.new_page()
    
    # 注入 stealth
    stealth_path = Path(__file__).parent / 'stealth.min.js'
    if stealth_path.exists():
        await page.add_init_script(path=str(stealth_path))
        print("✅ 已注入 stealth.min.js")
    
    # 测试 1: 访问首页
    print("\n测试 1: 访问首页...")
    await page.goto('https://www.xiaohongshu.com', wait_until='domcontentloaded', timeout=30000)
    print(f"首页标题：{await page.title()}")
    
    # 测试 2: 访问搜索页面
    print("\n测试 2: 访问搜索页面（美食）...")
    search_url = "https://www.xiaohongshu.com/search_result?keyword=美食&source=web_search_result_notes"
    await page.goto(search_url, wait_until='domcontentloaded', timeout=30000)
    print(f"搜索页面标题：{await page.title()}")
    
    await asyncio.sleep(3)
    
    # 检查是否有搜索结果
    search_check = await page.evaluate("""
        () => {
            const has_search = !!window.__INITIAL_STATE__?.search;
            const has_feed = !!window.__INITIAL_STATE__?.feed;
            const feeds_count = window.__INITIAL_STATE__?.search?.feeds?.length || 
                               window.__INITIAL_STATE__?.feed?.feeds?.length || 0;
            
            return {
                has_search,
                has_feed,
                feeds_count,
                page_title: document.title
            };
        }
    """)
    
    print(f"搜索结果：{search_check}")
    
    # 测试 3: 访问详情页
    print("\n测试 3: 访问笔记详情页...")
    note_id = "6a1022db000000003502b1c7"
    xsec_token = "ABbJA4PPvAR4Lv7XeLIOGUKLU6YATKcS3bBMtC8KHDeZk="
    detail_url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
    
    await page.goto(detail_url, wait_until='domcontentloaded', timeout=30000)
    print(f"详情页标题：{await page.title()}")
    
    await asyncio.sleep(3)
    
    # 检查是否有笔记数据
    note_check = await page.evaluate("""
        () => {
            const has_note = !!window.__INITIAL_STATE__?.note;
            const has_detail = !!window.__INITIAL_STATE__?.note?.noteDetailMap;
            
            let note_data = null;
            if (has_note && has_detail) {
                const map = window.__INITIAL_STATE__.note.noteDetailMap;
                const keys = Object.keys(map);
                if (keys.length > 0) {
                    const item = map[keys[0]]?.note || map[keys[0]];
                    note_data = {
                        title: item?.title,
                        user: item?.user?.nickname
                    };
                }
            }
            
            return {
                has_note,
                has_detail,
                note_data,
                page_title: document.title
            };
        }
    """)
    
    print(f"详情页数据：{note_check}")
    
    # 检查是否有登录提示
    login_check = await page.evaluate("""
        () => {
            const body = document.body.innerText;
            const has_login = body.includes('登录') || body.includes('立即登录');
            return has_login;
        }
    """)
    
    if login_check:
        print("⚠️ 页面包含登录提示")
    
    await browser.close()
    
    # 总结
    print("\n" + "="*60)
    print("测试结论")
    print("="*60)
    
    if search_check['feeds_count'] > 0:
        print("✅ 不登录可以搜索")
    else:
        print("⚠️ 搜索结果为空（可能是异步加载）")
    
    if note_check['note_data']:
        print(f"✅ 不登录可以查看详情：{note_check['note_data']['title']}")
    else:
        print("⚠️ 无法获取笔记详情")
    
    if login_check:
        print("⚠️ 有登录提示，但不影响访问")

if __name__ == "__main__":
    asyncio.run(test_no_login())
