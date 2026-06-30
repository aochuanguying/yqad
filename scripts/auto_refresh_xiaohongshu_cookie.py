#!/usr/bin/env python3
"""
自动刷新小红书 Cookie 并更新到数据库
使用 Playwright 模拟登录小红书，获取最新的 Cookie

使用方法:
    python auto_refresh_xiaohongshu_cookie.py
    
注意:
    - 需要已安装 Playwright: pip install playwright
    - 需要已安装浏览器：playwright install
    - 首次运行会打开浏览器，需要手动扫码登录
    - 登录后浏览器数据会保存到本地，后续运行自动保持登录状态
    - 登录成功后会自动保存 Cookie 到数据库
"""

import json
import time
import os
import mysql.connector
from playwright.sync_api import sync_playwright, Page


def save_cookie_to_db(cookie_string: str) -> bool:
    """将 Cookie 保存到数据库"""
    try:
        conn = mysql.connector.connect(
            host='192.168.50.50',
            port=3306,
            user='root',
            password='Wfw7539148@',
            database='yqad_prod_db'
        )
        cursor = conn.cursor()
        sql = """
            UPDATE network_post_config 
            SET xiaohongshu_cookie = %s,
                xiaohongshu_enabled = 1,
                updated_at = NOW()
            WHERE id = 1
        """
        cursor.execute(sql, (cookie_string,))
        conn.commit()
        cursor.close()
        conn.close()
        print(f"✅ Cookie 已成功保存到数据库 (长度：{len(cookie_string)})")
        return True
    except Exception as e:
        print(f"❌ 保存 Cookie 到数据库失败：{e}")
        return False


def extract_cookie_string(cookies: list) -> str:
    """从 Playwright cookies 列表提取 Cookie 字符串"""
    cookie_pairs = []
    for cookie in cookies:
        name = cookie.get('name', '')
        value = cookie.get('value', '')
        if name and value:
            cookie_pairs.append(f"{name}={value}")
    
    cookie_string = "; ".join(cookie_pairs)
    return cookie_string


def wait_for_login(page: Page, timeout: int = 300) -> bool:
    """
    等待用户登录成功
    timeout: 超时时间 (秒)
    """
    print(f"⏳ 请在打开的浏览器中扫码登录小红书... (超时时间：{timeout}秒)")
    print("💡 提示：如果已登录，可以直接关闭扫码弹窗")
    
    start_time = time.time()
    check_interval = 2  # 每 2 秒检查一次
    
    while time.time() - start_time < timeout:
        try:
            # 检查是否登录成功
            # 方法 1: 检查页面中是否有用户头像或个人信息
            # 方法 2: 检查 Cookie 中是否有 id_token 和 web_session
            
            cookies = page.context.cookies()
            cookie_dict = {c['name']: c['value'] for c in cookies}
            
            # 检查关键 Cookie 是否存在
            has_id_token = 'id_token' in cookie_dict and len(cookie_dict['id_token']) > 50
            has_web_session = 'web_session' in cookie_dict and len(cookie_dict['web_session']) > 10
            
            if has_id_token and has_web_session:
                print("✅ 检测到登录成功!")
                return True
            
            # 检查是否已经在主页 (登录状态)
            current_url = page.url
            if 'xiaohongsh.com' in current_url and 'login' not in current_url:
                # 尝试访问一个需要登录的页面
                page.goto('https://www.xiaohongshu.com/explore', wait_until='networkidle', timeout=10000)
                time.sleep(2)
                
                # 再次检查 Cookie
                cookies = page.context.cookies()
                cookie_dict = {c['name']: c['value'] for c in cookies}
                
                if 'id_token' in cookie_dict and 'web_session' in cookie_dict:
                    print("✅ 已在主页，检测到登录状态!")
                    return True
            
            print(f"  等待登录... (已等待 {int(time.time() - start_time)}秒)")
            time.sleep(check_interval)
            
        except Exception as e:
            # 忽略检查过程中的错误，继续等待
            time.sleep(check_interval)
    
    print("❌ 登录超时!")
    return False


def refresh_cookie():
    """刷新小红书 Cookie 的主函数"""
    print("🚀 开始刷新小红书 Cookie...")
    
    # 持久化用户数据目录，保持登录状态
    user_data_dir = os.path.join(os.path.dirname(__file__), 'xiaohongshu_browser_data')
    print(f"📂 使用用户数据目录：{user_data_dir}")
    
    with sync_playwright() as p:
        # 启动浏览器 (持久化用户数据)
        print("🌐 启动浏览器...")
        browser = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,  # 显示浏览器窗口，方便扫码登录
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # 创建页面
        page = browser.new_page()
        
        try:
            # 访问小红书登录页
            print("📱 访问小红书登录页...")
            page.goto('https://www.xiaohongshu.com/login', wait_until='networkidle')
            time.sleep(3)
            
            # 等待用户登录
            login_success = wait_for_login(page, timeout=300)
            
            if not login_success:
                print("❌ 登录失败或超时，请重新运行脚本")
                return False
            
            # 等待网络请求完成，确保 Cookie 已完全设置
            print("⏳ 等待 Cookie 完全加载...")
            time.sleep(3)
            
            # 获取所有 Cookie
            cookies = page.context.cookies()
            print(f"📋 获取到 {len(cookies)} 个 Cookie")
            
            # 提取 Cookie 字符串
            cookie_string = extract_cookie_string(cookies)
            print(f"📝 Cookie 长度：{len(cookie_string)}")
            
            # 保存到数据库
            if save_cookie_to_db(cookie_string):
                print("✅ Cookie 刷新成功!")
                
                # 验证 Cookie
                print("\n🔍 验证 Cookie 关键组件:")
                cookie_dict = {c['name']: c['value'] for c in cookies}
                key_cookies = ['id_token', 'web_session', 'a1', 'webId', 'acw_tc']
                for key in key_cookies:
                    if key in cookie_dict:
                        value = cookie_dict[key]
                        display_value = value[:30] + '...' if len(value) > 30 else value
                        print(f"  ✓ {key}: {display_value}")
                    else:
                        print(f"  ✗ {key}: 未找到")
                
                return True
            else:
                print("❌ 保存 Cookie 失败")
                return False
                
        except Exception as e:
            print(f"❌ 刷新 Cookie 过程中出错：{e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            # 关闭浏览器
            print("\n🔒 关闭浏览器...")
            browser.close()


if __name__ == '__main__':
    success = refresh_cookie()
    if success:
        print("\n" + "="*50)
        print("✅ 小红书 Cookie 自动刷新完成!")
        print("="*50)
        print("\n💡 提示:")
        print("  - 建议设置定时任务，每 1-2 天自动运行一次")
        print("  - 可以使用 cron: 0 2 * * * cd /path/to/scripts && python auto_refresh_xiaohongshu_cookie.py")
        print("  - 也可以手动运行此脚本更新 Cookie")
    else:
        print("\n" + "="*50)
        print("❌ Cookie 刷新失败，请检查错误信息")
        print("="*50)
        exit(1)
