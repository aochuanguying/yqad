#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试不同的笔记详情 API
"""

import sys
import time
import random
import re
import requests
from xhshow import Xhshow

def get_note_detail_v1(note_id, cookie):
    """使用 /api/sns/web/v1/feed 接口"""
    try:
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        a1_value = None
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                if key.strip() == 'a1':
                    a1_value = value.strip()
                    break
        
        if not a1_value:
            return {'success': False, 'error': '无法提取 a1'}
        
        time.sleep(random.uniform(1, 3))
        
        client = Xhshow()
        
        # 尝试使用 v1 API
        url = "https://www.xiaohongshu.com/api/sns/web/v1/feed"
        uri = "/api/sns/web/v1/feed"
        
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"]
        }
        
        signature = client.sign_xs_post(uri=uri, a1_value=a1_value, payload=payload)
        
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "content-type": "application/json;charset=UTF-8",
        }
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        print(f"v1 API - 状态码：{response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ v1 API 成功！")
                return {'success': True, 'data': result}
            else:
                print(f"❌ v1 API 失败：{result.get('msg', 'Unknown')}")
        else:
            print(f"❌ v1 API HTTP 错误：{response.status_code}")
            
        return {'success': False, 'error': f'HTTP {response.status_code}'}
        
    except Exception as e:
        print(f"❌ v1 API 异常：{str(e)}")
        return {'success': False, 'error': str(e)}

def get_note_detail_v2(note_id, cookie):
    """使用 /api/sns/web/v2/feed 接口"""
    try:
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        a1_value = None
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                if key.strip() == 'a1':
                    a1_value = value.strip()
                    break
        
        if not a1_value:
            return {'success': False, 'error': '无法提取 a1'}
        
        time.sleep(random.uniform(1, 3))
        
        client = Xhshow()
        
        url = "https://www.xiaohongshu.com/api/sns/web/v2/feed"
        uri = "/api/sns/web/v2/feed"
        
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"]
        }
        
        signature = client.sign_xs_post(uri=uri, a1_value=a1_value, payload=payload)
        
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "content-type": "application/json;charset=UTF-8",
        }
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        print(f"v2 API - 状态码：{response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ v2 API 成功！")
                return {'success': True, 'data': result}
            else:
                print(f"❌ v2 API 失败：{result.get('msg', 'Unknown')}")
        else:
            print(f"❌ v2 API HTTP 错误：{response.status_code}")
            
        return {'success': False, 'error': f'HTTP {response.status_code}'}
        
    except Exception as e:
        print(f"❌ v2 API 异常��{str(e)}")
        return {'success': False, 'error': str(e)}

def main():
    if len(sys.argv) < 3:
        print("用法：python3 test_note_detail.py <note_id> <cookie>")
        sys.exit(1)
    
    note_id = sys.argv[1]
    cookie = sys.argv[2]
    
    print(f"\n测试获取笔记详情：{note_id}")
    print("=" * 60)
    
    # 测试 v1 API
    print("\n[测试 v1 API]")
    result1 = get_note_detail_v1(note_id, cookie)
    
    if not result1['success']:
        # 测试 v2 API
        print("\n[测试 v2 API]")
        result2 = get_note_detail_v2(note_id, cookie)

if __name__ == '__main__':
    main()
