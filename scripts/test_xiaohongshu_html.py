#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书 HTML 调试脚本
保存页面 HTML 以便分析
"""

import sys
import time
from playwright.sync_api import sync_playwright

def save_html(note_id: str, cookie: str = None, output_file: str = 'xhs_page.html'):
    """
    保存小红书笔记页面的 HTML
    """
    try:
        note_url = f"https://www.xiaohongshu.com/explore/{note_id}"
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )
            
            # 设置 Cookie
            if cookie:
                cookie_dict = []
                for item in cookie.split(';'):
                    if '=' in item:
                        key, value = item.split('=', 1)
                        cookie_dict.append({
                            'name': key.strip(),
                            'value': value.strip(),
                            'domain': '.xiaohongshu.com',
                            'path': '/'
                        })
                print(f"设置了 {len(cookie_dict)} 个 Cookie")
                context.add_cookies(cookie_dict)
            
            page = context.new_page()
            
            print(f"访问：{note_url}")
            page.goto(note_url, wait_until='networkidle', timeout=30000)
            page.wait_for_timeout(5000)
            
            # 保存 HTML
            html = page.content()
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html)
            
            print(f"✅ HTML 已保存到：{output_file}")
            print(f"   HTML 长度：{len(html)}")
            
            # 检查页面标题
            page_title = page.title()
            print(f"   页面标题：{page_title}")
            
            # 检查是否有登录提示
            has_login = page.query_selector('#login-dialog') is not None
            print(f"   有登录弹窗：{has_login}")
            
            browser.close()
            
            return True
            
    except Exception as e:
        print(f"❌ 错误：{e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法：python3 test_xiaohongshu_html.py <note_id> [cookie]")
        sys.exit(1)
    
    note_id = sys.argv[1]
    cookie = sys.argv[2] if len(sys.argv) > 2 else None
    
    save_html(note_id, cookie)
