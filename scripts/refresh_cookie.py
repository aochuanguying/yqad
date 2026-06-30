#!/usr/bin/env python3
"""
小红书 Cookie 自动刷新脚本（简化版）
通过 Playwright 实现扫码登录，获取最新 Cookie 并保存到数据库
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from playwright.async_api import async_playwright

# 数据库配置
DB_CONFIG = {
    'host': '192.168.50.50',
    'port': 3306,
    'user': 'root',
    'password': 'Wfw7539148@',
    'database': 'yqad_prod_db'
}

def save_cookie_to_db(cookie_string: str) -> bool:
    """将 Cookie 保存到数据库"""
    try:
        import mysql.connector
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 获取当前版本号
        cursor.execute("SELECT cookie_version FROM network_post_config WHERE id = 1")
        result = cursor.fetchone()
        current_version = result[0] if result and result[0] else 0
        new_version = current_version + 1
        
        # 构建刷新日志
        refresh_log = {
            "refresh_time": datetime.now().isoformat(),
            "duration_ms": 0,
            "status": "success",
            "source": "auto"
        }
        
        sql = """
            UPDATE network_post_config 
            SET xiaohongshu_cookie = %s,
                cookie_version = %s,
                last_refresh_time = NOW(),
                next_refresh_time = DATE_ADD(NOW(), INTERVAL 24 HOUR),
                cookie_refresh_logs = JSON_ARRAY_APPEND(
                    IFNULL(cookie_refresh_logs, '[]'),
                    '$',
                    %s
                )
            WHERE id = 1
        """
        cursor.execute(sql, (cookie_string, new_version, json.dumps(refresh_log)))
        conn.commit()
        cursor.close()
        conn.close()
        print(f"✅ Cookie 已成功保存到数据库 (版本：{new_version})")
        return True
    except Exception as e:
        print(f"❌ 保存 Cookie 到数据库失败：{e}")
        return False

async def refresh_cookie():
    """刷新 Cookie 的主流程"""
    start_time = datetime.now()
    
    async with async_playwright() as p:
        # 启动浏览器（无头模式）
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        try:
            context = await browser.new_context()
            page = await context.new_page()
            
            print("📱 正在打开小红书登录页面...")
            await page.goto('https://www.xiaohongshu.com/login', wait_until='networkidle')
            
            # 等待二维码出现
            print("⏳ 等待二维码加载...")
            await page.wait_for_selector('.login-qrcode', timeout=30000)
            
            # 截取二维码
            qr_dir = '/tmp/qr_codes'
            os.makedirs(qr_dir, exist_ok=True)
            qr_path = os.path.join(qr_dir, f'qr_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png')
            
            qrcode_element = await page.$('.login-qrcode')
            if qrcode_element:
                await qrcode_element.screenshot(path=qr_path)
                print(f"✅ 二维码已保存到：{qr_path}")
                print("📲 请使用小红书 APP 扫码登录")
            else:
                print("❌ 未找到二维码元素")
                return False
            
            # 等待登录完成（最长等待 5 分钟）
            print("⏳ 等待登��完成...")
            try:
                await page.wait_for_function(
                    'window.location.href.includes("explore") || window.location.href.includes("profile")',
                    timeout=300000
                )
                print("✅ 登录成功！")
            except Exception as e:
                print(f"❌ 登录超时：{e}")
                return False
            
            # 获取 Cookie
            cookies = await context.cookies()
            cookie_dict = {c['name']: c['value'] for c in cookies}
            
            # 构建 Cookie 字符串
            cookie_parts = []
            for name, value in cookie_dict.items():
                cookie_parts.append(f"{name}={value}")
            cookie_string = '; '.join(cookie_parts)
            
            print(f"📋 获取到 Cookie (长度：{len(cookie_string)})")
            
            # 保存到数据库
            if save_cookie_to_db(cookie_string):
                duration = (datetime.now() - start_time).total_seconds() * 1000
                print(f"✅ Cookie 刷新成功，耗时：{duration:.0f}ms")
                return True
            else:
                return False
                
        finally:
            await browser.close()

if __name__ == '__main__':
    try:
        success = asyncio.run(refresh_cookie())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ 脚本执行失败：{e}")
        sys.exit(1)
