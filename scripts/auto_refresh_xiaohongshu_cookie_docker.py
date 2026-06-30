#!/usr/bin/env python3
"""
Docker 版本：自动刷新小红书 Cookie 并更新到数据库
适用于群晖 Docker 环境 (headless 模式)

使用方法:
    python auto_refresh_xiaohongshu_cookie_docker.py
    
注意:
    - 首次运行需要手动扫码登录 (会生成二维码图片)
    - 登录后浏览器数据会保存到本地，后续运行自动保持登录状态
    - 登录成功后会自动保存 Cookie 到数据库
"""

import json
import time
import os
import sys
import mysql.connector
from playwright.sync_api import sync_playwright, Page, TimeoutError


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


def save_qr_code_image(page: Page, save_dir: str = '/tmp') -> str:
    """
    保存登录二维码图片
    返回图片路径
    """
    try:
        # 等待二维码出现
        qr_selector = 'canvas'
        page.wait_for_selector(qr_selector, timeout=10000)
        
        # 截取整个页面或特定区域
        screenshot_path = os.path.join(save_dir, 'xiaohongshu_login_qr.png')
        page.screenshot(path=screenshot_path, full_page=False)
        
        print(f"📱 登录二维码已保存到：{screenshot_path}")
        print(f"💡 请在群晖文件管理器中打开此图片，用手机小红书 APP 扫码")
        return screenshot_path
    except Exception as e:
        print(f"⚠️  保存二维码失败：{e}")
        return None


def wait_for_login(page: Page, timeout: int = 300) -> bool:
    """
    等待用户登录成功
    timeout: 超时时间 (秒)
    """
    print(f"⏳ 等待扫码登录... (超时时间：{timeout}秒)")
    print("💡 提示：")
    print("   1. 首次运行会生成二维码图片：/tmp/xiaohongshu_login_qr.png")
    print("   2. 在群晖文件管理器中打开图片，用手机小红书 APP 扫码")
    print("   3. 后续运行会自动保持登录状态，无需扫码")
    
    start_time = time.time()
    check_interval = 2  # 每 2 秒检查一次
    
    # 首先尝试保存二维码
    try:
        page.wait_for_selector('canvas', timeout=5000)
        time.sleep(2)  # 等待二维码完全加载
        save_qr_code_image(page)
    except:
        # 可能已经登录，不需要显示二维码
        pass
    
    while time.time() - start_time < timeout:
        try:
            # 检查是否登录成功
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
            if 'xiaohongshu.com' in current_url and 'login' not in current_url:
                # 尝试访问一个需要登录的页面
                try:
                    page.goto('https://www.xiaohongshu.com/explore', wait_until='networkidle', timeout=10000)
                    time.sleep(2)
                    
                    # 再次检查 Cookie
                    cookies = page.context.cookies()
                    cookie_dict = {c['name']: c['value'] for c in cookies}
                    
                    if 'id_token' in cookie_dict and 'web_session' in cookie_dict:
                        print("✅ 已在主页，检测到登录状态!")
                        return True
                except TimeoutError:
                    pass
            
            elapsed = int(time.time() - start_time)
            if elapsed % 10 == 0:  # 每 10 秒提示一次
                print(f"  等待登录... (已等待 {elapsed}秒)")
            
            time.sleep(check_interval)
            
        except Exception as e:
            # 忽略检查过程中的错误，继续等待
            time.sleep(check_interval)
    
    print("❌ 登录超时!")
    return False


def refresh_cookie():
    """刷新小红书 Cookie 的主函数 (Docker headless 版本)"""
    print("🚀 开始刷新小红书 Cookie (Docker 版本)...")
    
    # 持久化用户数据目录
    user_data_dir = '/tmp/xiaohongshu_browser_data'
    print(f"📂 使用用户数据目录：{user_data_dir}")
    
    # 确保目录存在
    os.makedirs(user_data_dir, exist_ok=True)
    
    with sync_playwright() as p:
        # 启动浏览器 (headless 模式，适合 Docker)
        print("🌐 启动浏览器 (headless 模式)...")
        
        try:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=True,  # Docker 环境使用无头模式
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',  # 禁用 GPU 加速
                    '--lang=zh-CN',  # 设置中文
                ],
                viewport={'width': 1280, 'height': 800},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
        except Exception as e:
            print(f"❌ 启动浏览器失败：{e}")
            print("💡 请确保 Docker 容器已安装必要的依赖和中文字体")
            return False
        
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
                print("💡 如果是首次运行，请确保生成了二维码图片并扫码")
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
        print("  - 首次运行需要扫码登录")
        print("  - 二维码图片保存在：/tmp/xiaohongshu_login_qr.png")
        print("  - 后续运行会自动保持登录状态")
        print("  - 建议设置定时任务，每 1-2 天自动运行一次")
    else:
        print("\n" + "="*50)
        print("❌ Cookie 刷新失败，请检查错误信息")
        print("="*50)
        exit(1)
