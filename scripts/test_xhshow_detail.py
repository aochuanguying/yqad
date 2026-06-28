#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 xhshow 获取小红书笔记详情
根据 xhshow 文档的正确实现方式
"""

import sys
import json
import time
import requests
from xhshow import Xhshow, SessionManager

def get_note_detail_xhshow(note_id: str, cookie: str):
    """
    使用 xhshow 获取笔记详情
    
    关键点：
    1. 使用 sign_headers 方法生成完整 headers
    2. 需要 x-rap-param 头部（用于 feed 端点）
    3. 使用 POST 方法请求 /api/sns/web/v2/feed
    """
    try:
        # 清理 Cookie
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        # Cookie 转字典
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 提取 a1 值
        a1_value = cookie_dict.get('a1')
        if not a1_value:
            return {'success': False, 'error': '无法从 Cookie 中提取 a1 值'}
        
        print(f"✅ 已提取 a1 值：{a1_value[:30]}...")
        
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
        
        # 生成签名 headers（关键：使用 x_rap=True）
        print("正在生成签名 headers...")
        headers = client.sign_headers(
            method="POST",
            uri=uri,
            cookies=cookie_dict,
            payload=payload,
            x_rap=True,  # feed 端点需要 x-rap-param
            xsec_appid='xhs-pc-web'
        )
        
        print(f"✅ 签名生成成功")
        print(f"   x-s: {headers['x-s'][:50]}...")
        print(f"   x-t: {headers['x-t']}")
        print(f"   x-rap-param: {headers.get('x-rap-param', 'N/A')[:50]}...")
        
        # 添加其他必要的 headers
        headers.update({
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
            "origin": "https://www.xiaohongshu.com",
            "referer": f"https://www.xiaohongshu.com/explore/{note_id}",
        })
        
        # 发送请求
        print("\n正在发送请求...")
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            cookies=cookie_dict,
            timeout=30
        )
        
        print(f"请求状态码：{response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            if result.get('success'):
                print("✅ 请求成功！")
                
                # 解析数据
                note_data = result.get('data', {}).get('items', [{}])[0]
                if note_data:
                    note_card = note_data.get('note_card', {})
                    
                    detail = {
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
                        'images': note_card.get('image_list', []),
                        'cover': note_card.get('cover', {}).get('url', ''),
                        'type': note_card.get('type', 'normal')
                    }
                    
                    return {
                        'success': True,
                        'note_id': note_id,
                        'data': detail
                    }
                else:
                    return {'success': False, 'error': '笔记数据为空'}
            else:
                error_msg = result.get('msg', '请求失败')
                return {'success': False, 'error': error_msg}
        else:
            return {'success': False, 'error': f'HTTP {response.status_code}: {response.text}'}
    
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("用法：python3 test_xhshow_detail.py <note_id> <cookie>")
        print("\n示例:")
        print("  python3 test_xhshow_detail.py 69bc895d0000000021004944 'your_cookie'")
        sys.exit(1)
    
    note_id = sys.argv[1]
    cookie = sys.argv[2]
    
    print(f"\n{'='*60}")
    print(f"使用 xhshow 获取小红书笔记详情")
    print(f"{'='*60}\n")
    
    print(f"笔记 ID: {note_id}")
    print(f"Cookie: {cookie[:50]}...\n")
    
    result = get_note_detail_xhshow(note_id, cookie)
    
    if result.get('success'):
        print("\n✅ 笔记详情获取成功！\n")
        print("=" * 60)
        
        data = result['data']
        print(f"��题：{data.get('title', 'N/A')}")
        print(f"作者：{data.get('user', {}).get('nickname', 'N/A')}")
        print(f"描述：{data.get('desc', 'N/A')[:200] if data.get('desc') else 'N/A'}...")
        print(f"点赞：{data.get('interact_info', {}).get('liked_count', 'N/A')}")
        print(f"收藏：{data.get('interact_info', {}).get('collected_count', 'N/A')}")
        print(f"评论：{data.get('interact_info', {}).get('comment_count', 'N/A')}")
        print(f"图片数量：{len(data.get('images', []))}")
        print(f"封面图：{data.get('cover', 'N/A')}")
        print(f"类型：{data.get('type', 'normal')}")
        print(f"链接：https://www.xiaohongshu.com/explore/{note_id}")
        print("=" * 60)
    else:
        print(f"\n❌ 获取失败：{result.get('error')}")
        if result.get('traceback'):
            print(f"\n详细错误:\n{result['traceback']}")

if __name__ == '__main__':
    import re
    main()
