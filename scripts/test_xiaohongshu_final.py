#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书完整测试脚本 - 使用 xhshow 签名
测试帖子列表搜索和帖子详情获取
"""

import sys
import json
import time
import random
import re
import requests
from xhshow import Xhshow

def get_random_user_agent():
    """生成随机 User-Agent"""
    user_agents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]
    return random.choice(user_agents)

def search_notes(keyword, cookie, limit=10):
    """
    搜索小红书笔记（使用 xhshow 签名）
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
        
        # 随机休眠 1-3 秒
        time.sleep(random.uniform(1, 3))
        
        # 初始化 xhshow 客户端
        client = Xhshow()
        search_id = client.get_search_id()
        
        # API 参数
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        uri = "/api/sns/web/v2/search/notes"
        actual_page_size = max(limit, 10)
        
        payload = {
            "keyword": keyword,
            "page": 1,
            "page_size": actual_page_size,
            "search_id": search_id,
            "sort": "general",
            "note_type": 0
        }
        
        # 生成签名
        signature = client.sign_xs_post(
            uri=uri,
            a1_value=a1_value,
            payload=payload
        )
        
        # 构建 headers
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": get_random_user_agent(),
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
        }
        
        # Cookie 转字典
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        if response.status_code != 200:
            return {'success': False, 'error': f'HTTP 错误：{response.status_code}'}
        
        result = response.json()
        
        if not result.get('success'):
            error_msg = result.get('msg', '请求失败')
            if '登录' in error_msg or 'login' in error_msg.lower():
                return {'success': False, 'error': 'Cookie 已过期或需要登录'}
            return {'success': False, 'error': error_msg}
        
        items = result.get('data', {}).get('items', [])
        notes = []
        
        for item in items:
            try:
                note_data = item.get('note_card', {}) or item.get('model', {})
                note_id = item.get('id', '')
                
                note = {
                    'id': note_id,
                    'title': note_data.get('display_title', '') or note_data.get('title', '') or '',
                    'desc': note_data.get('desc', '') or '',
                    'user': {
                        'nickname': note_data.get('user', {}).get('nickname', '') or '',
                        'user_id': note_data.get('user', {}).get('user_id', '') or ''
                    },
                    'interact_info': {
                        'liked_count': str(note_data.get('interact_info', {}).get('liked_count', 0)),
                        'collected_count': str(note_data.get('interact_info', {}).get('collected_count', 0)),
                        'comment_count': str(note_data.get('interact_info', {}).get('comment_count', 0))
                    },
                    'cover': {
                        'url': note_data.get('cover', {}).get('url', '') or ''
                    },
                    'type': note_data.get('type', 'normal'),
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
    使用 https://www.xiaohongshu.com/api/sns/web/v2/feed 接口
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
        
        # 随机休眠 1-3 秒
        time.sleep(random.uniform(1, 3))
        
        # 初始化 xhshow 客户端
        client = Xhshow()
        
        # API 参数
        url = "https://www.xiaohongshu.com/api/sns/web/v2/feed"
        uri = "/api/sns/web/v2/feed"
        
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"]
        }
        
        # 生成签名
        signature = client.sign_xs_post(
            uri=uri,
            a1_value=a1_value,
            payload=payload
        )
        
        # 构建 headers
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": get_random_user_agent(),
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
        }
        
        # Cookie 转字典
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        if response.status_code != 200:
            return {'success': False, 'error': f'HTTP 错误：{response.status_code}'}
        
        result = response.json()
        
        if not result.get('success'):
            error_msg = result.get('msg', '请求失败')
            if '登录' in error_msg or 'login' in error_msg.lower():
                return {'success': False, 'error': 'Cookie 已过期或需要登录'}
            return {'success': False, 'error': error_msg}
        
        # 解析笔记详情
        note_data = result.get('data', {}).get('items', [{}])[0]
        if not note_data:
            return {'success': False, 'error': '笔记不存在'}
        
        note_card = note_data.get('note_card', {})
        
        note_detail = {
            'id': note_data.get('id', ''),
            'title': note_card.get('title', '') or note_card.get('display_title', ''),
            'desc': note_card.get('desc', ''),
            'user': {
                'nickname': note_card.get('user', {}).get('nickname', ''),
                'user_id': note_card.get('user', {}).get('user_id', ''),
                'avatar': note_card.get('user', {}).get('avatar', '')
            },
            'interact_info': {
                'liked_count': str(note_card.get('interact_info', {}).get('liked_count', 0)),
                'collected_count': str(note_card.get('interact_info', {}).get('collected_count', 0)),
                'comment_count': str(note_card.get('interact_info', {}).get('comment_count', 0))
            },
            'cover': {
                'url': note_card.get('cover', {}).get('url', '') or ''
            },
            'images': note_card.get('image_list', []),
            'type': note_card.get('type', 'normal'),
            'url': f"https://www.xiaohongshu.com/explore/{note_id}"
        }
        
        return {
            'success': True,
            'note': note_detail,
            'note_id': note_id
        }
    
    except Exception as e:
        return {'success': False, 'error': f'获取详情失败：{str(e)}'}

def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("用法：python3 test_xiaohongshu_final.py <keyword> <cookie> [limit]")
        print("\n示例:")
        print("  python3 test_xiaohongshu_final.py '汽车评测' 'your_cookie_here' 5")
        sys.exit(1)
    
    keyword = sys.argv[1]
    cookie = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    print(f"\n{'='*60}")
    print(f"小红书测试 - 搜索：'{keyword}'")
    print(f"{'='*60}\n")
    
    # 测试搜索
    result = search_notes(keyword, cookie, limit)
    
    if result.get('success'):
        print(f"✅ 搜索成功！找到 {result['total']} 条笔记\n")
        print("-" * 60)
        
        for i, note in enumerate(result['notes'], 1):
            print(f"\n[{i}] {note['title']}")
            print(f"    作者：{note['user']['nickname']}")
            print(f"    点赞：{note['interact_info']['liked_count']}")
            print(f"    收藏：{note['interact_info']['collected_count']}")
            print(f"    评论：{note['interact_info']['comment_count']}")
            print(f"    链接：{note['url']}")
        
        print(f"\n{'='*60}")
        
        # 测试获取第一条笔记的详情
        if result['notes']:
            first_note = result['notes'][0]
            print(f"\n测试获取笔记详情：{first_note['id']}")
            print(f"{'='*60}\n")
            
            detail_result = get_note_detail(first_note['id'], cookie)
            
            if detail_result.get('success'):
                print("✅ 笔记详情获取成功！\n")
                note = detail_result['note']
                
                print(f"标题：{note['title']}")
                print(f"作者：{note['user']['nickname']}")
                print(f"描述：{note['desc'][:200]}...")
                print(f"点赞：{note['interact_info']['liked_count']}")
                print(f"收藏：{note['interact_info']['collected_count']}")
                print(f"评论：{note['interact_info']['comment_count']}")
                print(f"图片数量：{len(note.get('images', []))}")
                print(f"链接：{note['url']}")
            else:
                print(f"❌ 获取详情失败：{detail_result.get('error')}")
    else:
        print(f"❌ 搜索失败：{result.get('error')}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n测试已中断")
        sys.exit(0)
