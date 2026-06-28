#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书简单测试脚本
快速测试搜索和详情获取
"""

import sys
import json
from xhs import XhsClient, SearchSortType, SearchNoteType

def test_search(cookie, keyword="汽车评测", limit=5):
    """测试搜索功能"""
    print(f"\n{'='*60}")
    print(f"测试搜索：'{keyword}'")
    print(f"{'='*60}\n")
    
    try:
        client = XhsClient(cookie=cookie)
        
        result = client.get_note_by_keyword(
            keyword=keyword,
            page=1,
            page_size=min(limit, 20),
            sort=SearchSortType.GENERAL,
            note_type=SearchNoteType.ALL
        )
        
        items = result.get('items', [])
        
        print(f"✅ 搜索成功！找到 {len(items)} 条笔记\n")
        
        for i, item in enumerate(items, 1):
            note_id = item.get('id', '')
            title = item.get('title', '') or '无标题'
            user = item.get('user', {}).get('nickname', '未知用户')
            liked = item.get('interact_info', {}).get('liked_count', 0)
            
            print(f"[{i}] {title}")
            print(f"    作者：{user}")
            print(f"    点赞：{liked}")
            print(f"    ID：{note_id}")
            print(f"    链接：https://www.xiaohongshu.com/explore/{note_id}\n")
        
        return items
        
    except Exception as e:
        print(f"❌ 搜索失败：{str(e)}")
        return []

def test_note_detail(cookie, note_id):
    """测试获取笔记详情"""
    print(f"\n{'='*60}")
    print(f"测试获取笔记详情：{note_id}")
    print(f"{'='*60}\n")
    
    try:
        client = XhsClient(cookie=cookie)
        
        note_detail = client.get_note_by_id(note_id)
        
        if note_detail:
            print("✅ 笔记详情获取成功！\n")
            print(f"标题：{note_detail.get('title', 'N/A')}")
            print(f"作者：{note_detail.get('user', {}).get('nickname', 'N/A')}")
            print(f"描述：{note_detail.get('desc', 'N/A')[:100]}...")
            print(f"点赞：{note_detail.get('interact_info', {}).get('liked_count', 'N/A')}")
            print(f"收藏：{note_detail.get('interact_info', {}).get('collected_count', 'N/A')}")
            print(f"评论：{note_detail.get('interact_info', {}).get('comment_count', 'N/A')}")
            return note_detail
        else:
            print("❌ 获取笔记详情失败")
            return None
            
    except Exception as e:
        print(f"❌ 获取详情失败：{str(e)}")
        return None

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法：python3 test_xhs_simple.py <Cookie> [关键词] [数量]")
        print("\n示例:")
        print("  python3 test_xhs_simple.py 'your_cookie_here' '汽车评测' 5")
        sys.exit(1)
    
    cookie = sys.argv[1]
    keyword = sys.argv[2] if len(sys.argv) > 2 else "汽车评测"
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    # 测试搜索
    items = test_search(cookie, keyword, limit)
    
    # 如果有结果，测试获取第一条笔记的详情
    if items:
        first_note_id = items[0].get('id', '')
        if first_note_id:
            test_note_detail(cookie, first_note_id)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n测试已中断")
        sys.exit(0)
