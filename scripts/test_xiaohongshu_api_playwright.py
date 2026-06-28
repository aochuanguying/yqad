#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书笔记详情获取 - xhshow + Playwright 结合方案
先用 xhshow 获取签名和参数，再用 Playwright 构建请求
"""

import sys
import json
import time
import random
import re
from xhshow import Xhshow
from playwright.sync_api import sync_playwright

def get_note_detail_combined(note_id: str, cookie: str):
    """
    结合 xhshow 和 Playwright 获取笔记详情
    
    步骤：
    1. 使用 xhshow 生成签名和必要参数
    2. 使用 Playwright 构建带签名的请求
    3. 获取并解析响应
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
        
        print("✅ 已提取 a1 值")
        
        # 随机休眠
        time.sleep(random.uniform(1, 3))
        
        # 1. 使用 xhshow 生成签名和参数
        client = Xhshow()
        
        # API 端点
        url = "https://www.xiaohongshu.com/api/sns/web/v2/feed"
        uri = "/api/sns/web/v2/feed"
        
        # 请求参数
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"]
        }
        
        # 生成签名
        print("正在生成签名...")
        signature = client.sign_xs_post(
            uri=uri,
            a1_value=a1_value,
            payload=payload
        )
        print(f"✅ 签名生成成功：{signature[:50]}...")
        
        # 生成时间戳
        x_t = str(int(time.time() * 1000))
        
        # Cookie 转字典
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 2. 使用 Playwright 发送请求
        print("\n正在使用 Playwright 发送请求...")
        
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            )
            
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            )
            
            # 设置 Cookie
            cookies = []
            for key, value in cookie_dict.items():
                cookies.append({
                    'name': key,
                    'value': value,
                    'domain': '.xiaohongshu.com',
                    'path': '/'
                })
            context.add_cookies(cookies)
            
            page = context.new_page()
            
            # 设置请求头
            page.set_extra_http_headers({
                'x-s': signature,
                'x-t': x_t,
                'content-type': 'application/json;charset=UTF-8',
                'accept': 'application/json, text/plain, */*',
                'origin': 'https://www.xiaohongshu.com',
                'referer': f'https://www.xiaohongshu.com/explore/{note_id}'
            })
            
            # 发送 POST 请求
            try:
                response = page.request.post(
                    url,
                    data=payload
                )
                
                print(f"请求状态码：{response.status}")
                
                if response.status == 200:
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
                            
                            browser.close()
                            return {
                                'success': True,
                                'note_id': note_id,
                                'data': detail
                            }
                        else:
                            browser.close()
                            return {'success': False, 'error': '笔记数据为空'}
                    else:
                        error_msg = result.get('msg', '请求失败')
                        browser.close()
                        return {'success': False, 'error': error_msg}
                else:
                    error_text = response.text()
                    browser.close()
                    return {'success': False, 'error': f'HTTP {response.status}: {error_text}'}
                    
            except Exception as e:
                browser.close()
                return {'success': False, 'error': f'请求失败：{str(e)}'}
    
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
        print("用法：python3 test_xiaohongshu_api_playwright.py <note_id> <cookie>")
        print("\n示例:")
        print("  python3 test_xiaohongshu_api_playwright.py 69bc895d0000000021004944 'your_cookie'")
        sys.exit(1)
    
    note_id = sys.argv[1]
    cookie = sys.argv[2]
    
    print(f"\n{'='*60}")
    print(f"小红书笔记详情获取 - xhshow + Playwright 结合方案")
    print(f"{'='*60}\n")
    
    print(f"笔记 ID: {note_id}")
    print(f"Cookie: {cookie[:50]}...\n")
    
    result = get_note_detail_combined(note_id, cookie)
    
    if result.get('success'):
        print("\n✅ 笔记详情获取成功！\n")
        print("=" * 60)
        
        data = result['data']
        print(f"标题：{data.get('title', 'N/A')}")
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
    main()
