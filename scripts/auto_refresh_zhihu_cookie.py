#!/usr/bin/env python3
"""
自动刷新知乎 Cookie 并更新到数据库
使用 Playwright 模拟登录知乎，获取最新的 Cookie

使用方法:
    python auto_refresh_zhihu_cookie.py
    
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


# 数据库配置
DB_CONFIG = {
    'host': '192.168.50.50',
    'port': 3306,
    'user': 'root',
    'password': 'Wfw7539148@',
    'database': 'yqad_prod_db'
}

# 浏览器用户数据目录
USER_DATA_DIR = os.path.join(os.path.dirname(__file__), 'zhihu_browser_data')


def save_cookie_to_db(cookie_string: str) -> bool:
    """将 Cookie 保存到数据库"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        sql = """
            UPDATE network_post_config 
            SET zhihu_cookie = %s,
                zhihu_enabled = 1,
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
    print(f"⏳ 请在打开的浏览器中登录知乎... (超时时间：{timeout}秒)")
    print("💡 提示：如果已登录，可以直接关闭扫码弹窗")
    
    start_time = time.time()
    check_interval = 2  # 每 2 秒检查一次
    
    while time.time() - start_time < timeout:
        try:
            # 检查是否登录成功
            # 方法 1: 检查页面中是否有用户头像或个人信息
            # 方法 2: 检查 Cookie 中是否有 _zap 和 z_c0
            
            cookies = page.context.cookies()
            cookie_dict = {c['name']: c['value'] for c in cookies}
            
            # 检查关键 Cookie 是否存在
            has_xsrf = '_xsrf' in cookie_dict and len(cookie_dict['_xsrf']) > 10
            has_zap = '_zap' in cookie_dict and len(cookie_dict['_zap']) > 10
            has_z_c0 = 'z_c0' in cookie_dict  # 登录凭证
            
            if has_xsrf and has_zap and has_z_c0:
                print("✅ 检测到登录成功!")
                
                # 检查是否有 __zse_ck（安全验证参数，可选）
                if '__zse_ck' in cookie_dict:
                    print("✓ 检测到 __zse_ck 安全参数")
                else:
                    print("⚠️ 未检测到 __zse_ck，可能影响部分 API 调用")
                
                return True
            
            # 检查是否已经在主页 (登录状态)
            current_url = page.url
            if 'zhihu.com' in current_url and 'login' not in current_url:
                # 尝试访问一个需要登录的页面
                try:
                    page.goto('https://www.zhihu.com/explore', wait_until='networkidle', timeout=10000)
                    time.sleep(2)
                    
                    # 再次检查 Cookie
                    cookies = page.context.cookies()
                    cookie_dict = {c['name']: c['value'] for c in cookies}
                    
                    if '_xsrf' in cookie_dict and '_zap' in cookie_dict:
                        print("✅ 已登录状态，获取 Cookie 成功!")
                        return True
                except:
                    pass
            
            # 显示剩余时间
            elapsed = int(time.time() - start_time)
            remaining = timeout - elapsed
            if remaining > 0 and remaining % 10 == 0:
                print(f"⏳ 剩余时间：{remaining}秒...")
            
            time.sleep(check_interval)
            
        except Exception as e:
            print(f"⚠️ 检查登录状态失败：{e}")
            time.sleep(check_interval)
    
    print("❌ 登录超时，请重试")
    return False


def refresh_cookie() -> bool:
    """刷新知乎 Cookie 的主函数"""
    print("=" * 60)
    print("🔄 知乎 Cookie 自动刷新工具")
    print("=" * 60)
    print()
    
    with sync_playwright() as p:
        # 启动浏览器 (持久化用户数据)
        print(f"📂 浏览器用户数据目录：{USER_DATA_DIR}")
        print("🌐 正在启动浏览器...")
        
        try:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=False,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                ]
            )
        except Exception as e:
            print(f"❌ 启动浏览器失败：{e}")
            print("💡 请确保已安装 Playwright: pip install playwright")
            print("💡 并安装浏览器：playwright install chromium")
            return False
        
        try:
            # 获取或创建页面
            if len(browser.pages) > 0:
                page = browser.pages[0]
            else:
                page = browser.new_page()
            
            # 注入反检测脚本
            page.add_init_script('''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            ''')
            
            # 先检查是否已登录
            print("🔍 检查登录状态...")
            cookies = page.context.cookies()
            cookie_dict = {c['name']: c['value'] for c in cookies}
            
            if '_xsrf' in cookie_dict and '_zap' in cookie_dict and 'z_c0' in cookie_dict:
                print("✅ 检测到已登录状态，跳过登录步骤")
            else:
                # 未登录，打开登录页面
                print("📱 打开知乎登录页面...")
                page.goto('https://www.zhihu.com/signin?next=%2F', {
                    'waitUntil': 'domcontentloaded',
                    'timeout': 30000
                })
                
                # 等待页面加载
                time.sleep(3)
            
            # 等待用户登录（如果未登录）
            print("⏳ 等待用户登录...")
            
            # 重新检查 Cookie
            cookies = page.context.cookies()
            cookie_dict = {c['name']: c['value'] for c in cookies}
            
            if '_xsrf' not in cookie_dict or '_zap' not in cookie_dict or 'z_c0' not in cookie_dict:
                # 等待用户登录
                if not wait_for_login(page, timeout=300):
                    print("❌ 登录失败，退出")
                    browser.close()
                    return False
            else:
                print("✅ 已登录，直接获取 Cookie")
            
            # 等待一下确保所有 Cookie 都已加载
            print("⏳ 等待 Cookie 完全加载...")
            time.sleep(2)
            
            # 获取所有 Cookie
            print("🍪 正在提取 Cookie...")
            cookies = page.context.cookies()
            
            # 过滤知乎相关的 Cookie
            zhihu_cookies = [c for c in cookies if c['name'].startswith('_') or c['name'] in ['z_c0', '__zse_ck', 'captcha_session_v2', 'captcha_ticket_v2']]
            
            print(f"✓ 提取到 {len(zhihu_cookies)} 个 Cookie")
            
            # 转换为 Cookie 字符串
            cookie_string = extract_cookie_string(zhihu_cookies)
            
            # 显示 Cookie 关键信息
            cookie_dict = {c['name']: c['value'] for c in zhihu_cookies}
            print()
            print("📋 Cookie 关键组件:")
            for key in ['_xsrf', '_zap', 'z_c0', '__zse_ck']:
                if key in cookie_dict:
                    value = cookie_dict[key]
                    display_value = value[:30] + '...' if len(value) > 30 else value
                    print(f"  ✓ {key}: {display_value}")
                else:
                    print(f"  ✗ {key}: 不存在")
            
            print()
            
            # 保存到数据库
            print("💾 正在保存到数据库...")
            if save_cookie_to_db(cookie_string):
                print("✅ Cookie 刷新成功!")
                return True
            else:
                print("❌ 保存失败")
                return False
                
        except Exception as e:
            print(f"❌ 刷新过程出错：{e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            # 关闭浏览器
            print("🔒 关闭浏览器...")
            browser.close()


if __name__ == '__main__':
    success = refresh_cookie()
    exit(0 if success else 1)
