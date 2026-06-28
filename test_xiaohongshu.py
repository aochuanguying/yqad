#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书搜索测试脚本

使用方法：
1. 从浏览器获取小红书 Cookie
2. 运行：python3 test_xiaohongshu.py

Cookie 获取方法：
1. 访问 https://www.xiaohongshu.com 并登录
2. 按 F12 打开开发者工具
3. 切换到 Network 标签
4. 刷新页面
5. 点击任意请求，复制 Cookie 值
"""

import json
import sys
from xhs import XhsClient, SearchSortType

def get_cookie_from_input():
    """从用户输入获取 Cookie"""
    print("=" * 60)
    print("小红书搜索测试工具")
    print("=" * 60)
    print()
    print("请输入小红书 Cookie（从浏览器开发者工具复制）：")
    print("提示：Cookie 应该包含 web_session 和 a1 字段")
    print()
    cookie = input("Cookie: ").strip()
    return cookie

def test_search(cookie, keyword="奥迪", max_results=10):
    """测试搜索功能"""
    print(f"\n正在搜索：{keyword}")
    print(f"最大结果数：{max_results}")
    print("-" * 60)
    
    try:
        # 初始化客户端
        client = XhsClient(cookie=cookie)
        
        # 执行搜索
        result = client.search(
            keyword=keyword,
            page=1,
            page_size=min(max_results, 20),
            sort=SearchSortType.GENERAL,
            note_type="normal"
        )
        
        if not result or 'data' not in result or 'items' not in result['data']:
            print("❌ 搜索失败：响应格式异常")
            return False
        
        items = result['data']['items']
        print(f"✅ 搜索成功！找到 {len(items)} 条结果\n")
        
        # 显示结果
        for idx, item in enumerate(items, 1):
            note_data = item.get('note_card', {}) or item.get('model', {})
            
            note_id = item.get('id', '') or item.get('note_id', '')
            title = note_data.get('display_title', '') or note_data.get('title', '') or '无标题'
            desc = note_data.get('desc', '') or ''
            user = note_data.get('user', {})
            nickname = user.get('nickname', '') or '未知用户'
            
            interact_info = note_data.get('interact_info', {})
            likes = interact_info.get('liked_count', 0)
            collects = interact_info.get('collected_count', 0)
            comments = interact_info.get('comment_count', 0)
            
            # 截断描述
            if len(desc) > 100:
                desc = desc[:100] + "..."
            
            print(f"{idx}. {title}")
            print(f"   作者：{nickname}")
            print(f"   描述：{desc}")
            print(f"   互动：❤️ {likes}  ⭐ {collects}  💬 {comments}")
            print(f"   链接：https://www.xiaohongshu.com/explore/{note_id}")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ 搜索失败：{str(e)}")
        print()
        print("可能的原因：")
        print("1. Cookie 已过期，请重新登录并获取新的 Cookie")
        print("2. 网络连接问题")
        print("3. 账号被限制")
        return False

def test_home_feed(cookie):
    """测试首页推荐"""
    print("\n测试首页推荐...")
    print("-" * 60)
    
    try:
        from xhs import FeedType
        client = XhsClient(cookie=cookie)
        result = client.get_home_feed(FeedType.RECOMMEND)
        
        if result and 'data' in result and 'items' in result['data']:
            print(f"✅ 首页推荐获取成功！找到 {len(result['data']['items'])} 条内容")
            return True
        else:
            print("❌ 首页推荐获取失败：响应格式异常")
            return False
    except Exception as e:
        print(f"❌ 首页推荐获取失败：{str(e)}")
        return False

def main():
    """主函数"""
    # 获取 Cookie
    cookie = get_cookie_from_input()
    
    if not cookie:
        print("\n❌ Cookie 不能为空！")
        sys.exit(1)
    
    # 测试搜索
    success = test_search(cookie, "奥迪", 10)
    
    if success:
        # 可选：测试首页推荐
        print("\n" + "=" * 60)
        test_home = input("是否测试首页推荐功能？(y/n): ").strip().lower()
        if test_home == 'y':
            test_home_feed(cookie)
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
