#!/usr/bin/env python3
"""
测试 Cookie 刷新脚本
运行后会打开浏览器，需要手动扫码登录小红书
"""

import sys
import os

# 添加脚本目录到路径
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from auto_refresh_xiaohongshu_cookie import refresh_cookie

if __name__ == '__main__':
    print("="*60)
    print("🧪 小红书 Cookie 自动刷新测试")
    print("="*60)
    print()
    
    success = refresh_cookie()
    
    if success:
        print("\n" + "="*60)
        print("✅ 测试成功！Cookie 已更新到数据库")
        print("="*60)
        print("\n💡 下一步:")
        print("  1. 运行测试脚本验证 Cookie 是否可用:")
        print("     python test_audi_export.py")
        print()
        print("  2. 设置定时任务自动刷新:")
        print("     bash setup_cookie_refresh_cron.sh")
        print()
    else:
        print("\n" + "="*60)
        print("❌ 测试失败，请检查错误信息")
        print("="*60)
        exit(1)
