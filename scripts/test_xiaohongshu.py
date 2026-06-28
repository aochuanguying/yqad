#!/usr/bin/env python3.10
# -*- coding: utf-8 -*-
"""
小红书 Cookie 测试脚本
使用简单解析（AI 解析已由 TypeScript 的公共方法处理）
"""

import json
import sys
import time
import random
import requests
from xhshow import Xhshow

def parse_cookie_simple(cookie_str):
    """简单解析 Cookie（不使用 AI）"""
    cookie_dict = {}
    a1_value = None
    for item in cookie_str.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            key = key.strip()
            value = value.strip()
            cookie_dict[key] = value
            if key == 'a1':
                a1_value = value
    return cookie_dict, a1_value

if __name__ == '__main__':
    cookie = sys.argv[1].strip()
    time.sleep(random.uniform(1, 3))
    
    # 使用简单解析（AI 解析已由 TypeScript 的公共方法处理）
    cookie_dict, a1_value = parse_cookie_simple(cookie)
    
    if not a1_value:
        print(json.dumps({"success": False, "error": "无法从 Cookie 中提取 a1 值"}))
        sys.exit(0)
    
    client = Xhshow()
    search_id = client.get_search_id()
    
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    payload = {"keyword": "测试", "page": 1, "page_size": 10, "search_id": search_id, "sort": "general", "note_type": 0}
    
    x_s = client.sign_xs_post(uri=uri, a1_value=a1_value, payload=payload)
    x_s_common = client.sign_xs_common(cookie_dict)
    x_t = client.get_x_t()
    
    # 清理请求头中的换行符和空白字符，并确保所有值都是字符串
    def clean_header_value(value):
        """清理请求头值中的换行符和空白，并确保是字符串类型"""
        # 先转换为字符串（处理整数时间戳等）
        str_value = str(value)
        # 移除所有换行符、回车符和多余的空白
        return ' '.join(str_value.split())
    
    headers = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/json;charset=UTF-8",
        "cookie": clean_header_value(cookie),
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        "x-s": clean_header_value(x_s),
        "x-t": clean_header_value(x_t),
        "x-s-common": clean_header_value(x_s_common)
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    
    if response.status_code != 200:
        print(json.dumps({"success": False, "error": "HTTP " + str(response.status_code) + ": " + response.text[:200]}))
        sys.exit(0)
    
    result = response.json()
    
    if result.get('success'):
        items = result.get('data', {}).get('items', []) or []
        print(json.dumps({"success": True, "count": len(items)}))
    else:
        print(json.dumps({"success": False, "error": result.get('msg', '未知错误')}))
