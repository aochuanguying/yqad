#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的 xhs 库测试
只需要输入 Cookie 即可测试搜索功能
"""

import sys
from xhs import XhsClient, SearchSortType

# 测试 Cookie（请替换为你的真实 Cookie）
TEST_COOKIE = ""

def test_search(cookie):
    """测试搜索功能"""
    print("🔍 正在测试小红书搜索...")
    
    try:
        client = XhsClient(cookie=cookie)
        result = client.search(
            keyword="测试",
            page=1,
            page_size=5,
            sort=SearchSortType.GENERAL,
            note_type="normal"
        )
        
        if result and 'data' in result and 'items' in result['data']:
            items = result['data']['items']
            print(f"✅ 搜索成功！返回 {len(items)} 条结果")
            return True
        else:
            print("❌ 搜索失败：响应格式异常")
            return False
            
    except Exception as e:
        print(f"❌ 错误：{str(e)}")
        return False

if __name__ == "__main__":
    if not TEST_COOKIE:
        print("⚠️  请在脚本中设置 TEST_COOKIE 变量")
        print("或者使用交互式测试脚本：python3 test_xiaohongshu.py")
        sys.exit(1)
    
    success = test_search(TEST_COOKIE)
    sys.exit(0 if success else 1)
