#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书完整测试脚本
测试帖子列表搜索和帖子详情获取
"""

import sys
import json
import time
import random
import re
import requests
from xhs import XhsClient

# 颜色输出
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

def get_random_user_agent():
    """生成随机 User-Agent"""
    user_agents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]
    return random.choice(user_agents)

def search_notes(keyword, cookie, limit=10):
    """
    搜索小红书笔记
    
    Args:
        keyword: 搜索关键词
        cookie: 小红书 Cookie
        limit: 返回结果数量
        
    Returns:
        dict: 搜索结果
    """
    try:
        # 清理 Cookie
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        # 提取 a1 值
        a1_value = None
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                if key.strip() == 'a1':
                    a1_value = value.strip()
                    break
        
        if not a1_value:
            return {'success': False, 'error': '无法从 Cookie 中提取 a1 值'}
        
        # 随机休眠
        sleep_time = random.uniform(1, 3)
        time.sleep(sleep_time)
        
        # 初始化客户端
        client = XhsClient(cookie=cookie)
        
        # 使用 xhs 库的 get_note_by_keyword 方法
        from xhs import SearchSortType, SearchNoteType
        
        result = client.get_note_by_keyword(
            keyword=keyword,
            page=1,
            page_size=min(limit, 20),
            sort=SearchSortType.GENERAL,
            note_type=SearchNoteType.ALL
        )
        
        items = result.get('items', [])
        notes = []
        
        for item in items:
            try:
                note_id = item.get('id', '')
                
                note = {
                    'id': note_id,
                    'title': item.get('title', '') or '',
                    'desc': item.get('desc', '') or '',
                    'user': {
                        'nickname': item.get('user', {}).get('nickname', '') or '',
                        'user_id': item.get('user', {}).get('user_id', '') or ''
                    },
                    'interact_info': {
                        'liked_count': str(item.get('interact_info', {}).get('liked_count', 0)),
                        'collected_count': str(item.get('interact_info', {}).get('collected_count', 0)),
                        'comment_count': str(item.get('interact_info', {}).get('comment_count', 0))
                    },
                    'cover': {
                        'url': item.get('cover', {}).get('url', '') or ''
                    },
                    'type': item.get('type', 'normal'),
                    'url': f"https://www.xiaohongshu.com/explore/{note_id}"
                }
                notes.append(note)
            except Exception as e:
                continue
        
        return {
            'success': True,
            'notes': notes,
            'total': len(notes),
            'keyword': keyword
        }
    
    except Exception as e:
        return {'success': False, 'error': f'搜索失败：{str(e)}'}

def get_note_detail(note_id, cookie):
    """
    获取小红书笔记详情
    
    Args:
        note_id: 笔记 ID
        cookie: 小红书 Cookie
        
    Returns:
        dict: 笔记详情
    """
    try:
        # 清理 Cookie
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        # 随机休眠
        sleep_time = random.uniform(1, 3)
        time.sleep(sleep_time)
        
        # 初始化客户端
        client = XhsClient(cookie=cookie)
        
        # 使用 xhs 库的 get_note_by_id 方法
        note_detail = client.get_note_by_id(note_id)
        
        if note_detail:
            return {
                'success': True,
                'note': note_detail,
                'note_id': note_id
            }
        else:
            return {'success': False, 'error': '获取笔记详情失败'}
    
    except Exception as e:
        return {'success': False, 'error': f'获取详情失败：{str(e)}'}

def test_search():
    """测试搜索功能"""
    print_info("=" * 60)
    print_info("测试 1: 小红书帖子列表搜索")
    print_info("=" * 60)
    
    cookie = input("\n请输入小红书 Cookie: ").strip()
    if not cookie:
        print_error("Cookie 不能为空")
        return
    
    keyword = input("请输入搜索关键词 (默认：汽车评测): ").strip() or "汽车评测"
    limit = input("请输入返回结果数量 (1-20, 默认：10): ").strip() or "10"
    
    try:
        limit = int(limit)
        if limit < 1:
            limit = 10
        elif limit > 20:
            limit = 20
    except ValueError:
        limit = 10
    
    print_info(f"\n开始搜索：'{keyword}' ...")
    result = search_notes(keyword, cookie, limit)
    
    if result.get('success'):
        print_success(f"搜索成功！找到 {result['total']} 条笔记")
        print("\n搜索结果:")
        print("-" * 60)
        
        for i, note in enumerate(result['notes'], 1):
            print(f"\n[{i}] {note['title']}")
            print(f"    作者：{note['user']['nickname']}")
            print(f"    点赞：{note['interact_info']['liked_count']}")
            print(f"    收藏：{note['interact_info']['collected_count']}")
            print(f"    评论：{note['interact_info']['comment_count']}")
            print(f"    链接：{note['url']}")
            
            if note.get('desc'):
                desc_preview = note['desc'][:50] + '...' if len(note['desc']) > 50 else note['desc']
                print(f"    描述：{desc_preview}")
        
        print("\n" + "=" * 60)
        
        # 询问是否测试详情获取
        if result['notes']:
            test_detail = input("\n是否测试获取某条笔记的详情？(y/n): ").strip().lower()
            if test_detail == 'y':
                note_index = input(f"请输入笔记编号 (1-{len(result['notes'])}): ").strip()
                try:
                    note_index = int(note_index) - 1
                    if 0 <= note_index < len(result['notes']):
                        note_id = result['notes'][note_index]['id']
                        test_note_detail(note_id, cookie)
                except (ValueError, IndexError):
                    print_error("无效的编号")
    else:
        print_error(f"搜索失败：{result.get('error')}")

def test_note_detail(note_id, cookie):
    """测试获取笔记详情"""
    print_info("\n" + "=" * 60)
    print_info(f"测试 2: 获取笔记详情 (ID: {note_id})")
    print_info("=" * 60)
    
    print_info("\n正在获取笔记详情...")
    result = get_note_detail(note_id, cookie)
    
    if result.get('success'):
        print_success("笔记详情获取成功！")
        note = result.get('note', {})
        
        print("\n笔记详情:")
        print("-" * 60)
        print(f"标题：{note.get('title', 'N/A')}")
        print(f"作者：{note.get('user', {}).get('nickname', 'N/A')}")
        print(f"内容：{note.get('desc', 'N/A')[:200]}...")
        print(f"点赞：{note.get('interact_info', {}).get('liked_count', 'N/A')}")
        print(f"收藏：{note.get('interact_info', {}).get('collected_count', 'N/A')}")
        print(f"评论：{note.get('interact_info', {}).get('comment_count', 'N/A')}")
        print(f"��接：{result.get('note_id', note_id)}")
    else:
        print_error(f"获取详情失败：{result.get('error')}")
        print_warning("\n提示：当前 xhshow 库可能不支持直接获取笔记详情")
        print_warning("可以考虑以下方案：")
        print_warning("1. 使用搜索 API 返回的结果（已包含大部分信息）")
        print_warning("2. 研究小红书 Web API 的其他接口")
        print_warning("3. 使用爬虫方式获取详情页 HTML")

def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("小红书完整测试脚本")
    print("测试帖子列表搜索和帖子详情获取")
    print("=" * 60)
    
    print("\n请选择测试模式:")
    print("1. 测试搜索功能")
    print("2. 测试详情获取（需要提供笔记 ID）")
    print("3. 完整测试（搜索 + 详情）")
    
    choice = input("\n请输入选项 (1/2/3): ").strip()
    
    if choice == '1':
        test_search()
    elif choice == '2':
        cookie = input("\n请输入小红书 Cookie: ").strip()
        if not cookie:
            print_error("Cookie 不能为空")
            return
        note_id = input("请输入笔记 ID: ").strip()
        if not note_id:
            print_error("笔记 ID 不能为空")
            return
        test_note_detail(note_id, cookie)
    elif choice == '3':
        test_search()
    else:
        print_error("无效的选项")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n测试已中断")
        sys.exit(0)
