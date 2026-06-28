#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
获取新鲜 Cookie 的指南
"""

print("=" * 80)
print("📋 获取小红书最新 Cookie 的步骤")
print("=" * 80)
print()

print("1️⃣  打开浏览器（Chrome 149）")
print("   - 确保是最新版本")
print("   - 打开无痕模式（避免缓存干扰）")
print()

print("2️⃣  访问小红书官网")
print("   - 网址：https://www.xiaohongshu.com")
print("   - 登录你的新账号")
print("   - 确保登录成功，能正常浏览")
print()

print("3️⃣  打开开发者工具")
print("   - 按 F12 或右键 → 检查")
print("   - 切换到 Network（网络）标签")
print()

print("4️⃣  刷新页面")
print("   - 按 Ctrl+R 或 Cmd+R 刷新")
print("   - 在 Network 标签中找到请求")
print()

print("5️⃣  找到关键请求")
print("   - 寻找：edith.xiaohongshu.com 的请求")
print("   - 或者：www.xiaohongshu.com/explore 的请求")
print("   - 点击这个请求")
print()

print("6️⃣  复制 Cookie")
print("   - 在 Request Headers（请求头）部分")
print("   - 找到 cookie 字段")
print("   - 完整复制整个 cookie 的值（从 abRequestId 到 unread 的完整内容）")
print()

print("7️⃣  验证 Cookie 关键字段")
print("   确保包含以下字段：")
print("   ✅ web_session=040069...")
print("   ✅ id_token=VjEA...")
print("   ✅ a1=19f0ac...")
print()

print("=" * 80)
print("💡 提示")
print("=" * 80)
print()
print("如果 Cookie 仍然报 '登录已过期'（错误码 -100）：")
print("1. 确保是在登录状态下刷新的页面")
print("2. 尝试重新登录小红书")
print("3. 登录后立即复制 Cookie，不要等待")
print("4. 使用无痕模式，避免旧 Cookie 干扰")
print()

print("=" * 80)
print("📝 获取到 Cookie 后")
print("=" * 80)
print()
print("将 Cookie 粘贴到测试脚本中：")
print("  test_xiaohongshu_single.py")
print("  或")
print("  test_direct_api.py")
print()
print("然后运行测试：")
print("  python3 test_xiaohongshu_single.py")
print()
