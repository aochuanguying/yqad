#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 xhshow 先搜索笔记，然后获取详情
"""

import sys
import json
import time
import requests
from xhshow import Xhshow

def search_notes(keyword: str, cookie: str, limit: int = 5):
    """使用 xhshow 搜索笔记"""
    try:
        # Cookie 处理
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        a1_value = cookie_dict.get('a1')
        if not a1_value:
            return {'success': False, 'error': '无法提取 a1'}
        
        # 初始化 xhshow
        client = Xhshow()
        
        # API 端点
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        uri = "/api/sns/web/v2/search/notes"
        
        # 生成 search_id
        search_id = client.get_search_id()
        
        # 请求参数
        payload = {
            "keyword": keyword,
            "page": 1,
            "page_size": max(limit, 10),
            "search_id": search_id,
            "sort": "general",
            "note_type": 0
        }
        
        # 生成 headers
        headers = client.sign_headers(
            method="POST",
            uri=uri,
            cookies=cookie_dict,
            payload=payload,
            x_rap=False
        )
        
        headers.update({
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
        })
        
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                items = result.get('data', {}).get('items', [])
                return {'success': True, 'items': items, 'total': len(items)}
            else:
                return {'success': False, 'error': result.get('msg', '失败')}
        else:
            return {'success': False, 'error': f'HTTP {response.status_code}'}
    
    except Exception as e:
        return {'success': False, 'error': str(e)}

def get_note_detail(note_id: str, cookie: str):
    """使用 xhshow 获取笔记详情"""
    try:
        # Cookie 处理
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        a1_value = cookie_dict.get('a1')
        if not a1_value:
            return {'success': False, 'error': '无法提取 a1'}
        
        # 初始化 xhshow
        client = Xhshow()
        
        # API 端点
        url = "https://www.xiaohongshu.com/api/sns/web/v2/feed"
        uri = "/api/sns/web/v2/feed"
        
        # 请求参数
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"]
        }
        
        # 生成 headers
        headers = client.sign_headers(
            method="POST",
            uri=uri,
            cookies=cookie_dict,
            payload=payload,
            x_rap=True
        )
        
        headers.update({
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
            "origin": "https://www.xiaohongshu.com",
            "referer": f"https://www.xiaohongshu.com/explore/{note_id}",
        })
        
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                note_data = result.get('data', {}).get('items', [{}])[0]
                if note_data:
                    note_card = note_data.get('note_card', {})
                    return {
                        'success': True,
                        'data': {
                            'id': note_data.get('id', ''),
                            'title': note_card.get('title', '') or note_card.get('display_title', ''),
                            'desc': note_card.get('desc', ''),
                            'user': note_card.get('user', {}),
                            'interact_info': note_card.get('interact_info', {}),
                            'images': note_card.get('image_list', []),
                            'cover': note_card.get('cover', {}).get('url', ''),
                            'type': note_card.get('type', 'normal')
                        }
                    }
                else:
                    return {'success': False, 'error': '笔记数据为空'}
            else:
                return {'success': False, 'error': result.get('msg', '失败')}
        else:
            return {'success': False, 'error': f'HTTP {response.status_code}: {response.text[:200]}'}
    
    except Exception as e:
        return {'success': False, 'error': str(e)}

def main():
    if len(sys.argv) < 3:
        print("用法：python3 test_xhshow_search_then_detail.py <keyword> <cookie> [limit]")
        sys.exit(1)
    
    keyword = sys.argv[1]
    cookie = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    print(f"\n{'='*60}")
    print(f"使用 xhshow 搜索并获取笔记详情")
    print(f"{'='*60}\n")
    
    # 1. 搜索笔记
    print(f"[1] 搜索关键词：'{keyword}'")
    print("-" * 60)
    search_result = search_notes(keyword, cookie, limit)
    
    if not search_result.get('success'):
        print(f"❌ 搜索失败：{search_result.get('error')}")
        return
    
    items = search_result.get('items', [])
    print(f"✅ 搜索成功，找到 {len(items)} 条笔记\n")
    
    for i, item in enumerate(items, 1):
        note_data = item.get('note_card', {}) or item.get('model', {})
        note_id = item.get('id', '')
        title = note_data.get('display_title', '') or note_data.get('title', '')
        user = note_data.get('user', {}).get('nickname', '')
        liked = note_data.get('interact_info', {}).get('liked_count', 0)
        
        print(f"[{i}] {title}")
        print(f"    作者：{user}")
        print(f"    点赞：{liked}")
        print(f"    ID: {note_id}\n")
    
    # 2. 获取第一条笔记的详情
    if items:
        first_note_id = items[0].get('id', '')
        print(f"\n[2] 获取笔记详情：{first_note_id}")
        print("=" * 60)
        
        detail_result = get_note_detail(first_note_id, cookie)
        
        if detail_result.get('success'):
            print("✅ 详情获取成功！\n")
            data = detail_result['data']
            
            print(f"标题：{data.get('title', 'N/A')}")
            print(f"作者：{data.get('user', {}).get('nickname', 'N/A')}")
            print(f"描述：{data.get('desc', 'N/A')[:200] if data.get('desc') else 'N/A'}...")
            print(f"点赞：{data.get('interact_info', {}).get('liked_count', 'N/A')}")
            print(f"收藏：{data.get('interact_info', {}).get('collected_count', 'N/A')}")
            print(f"评论：{data.get('interact_info', {}).get('comment_count', 'N/A')}")
            print(f"图片数量：{len(data.get('images', []))}")
            print(f"封面图：{data.get('cover', 'N/A')}")
        else:
            print(f"❌ 详情获取失败：{detail_result.get('error')}")

if __name__ == '__main__':
    import re
    main()
