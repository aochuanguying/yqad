#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书 API 测试脚本
用于测试小红书搜索功能是否正常工作

使用官方 Web API（与后端服务一致）：
POST https://so.xiaohongshu.com/api/sns/web/v2/search/notes
"""

import sys
import json
import time
import random
import re
import requests
from urllib.parse import quote

try:
    from xhshow import Xhshow
except ImportError:
    print(json.dumps({
        'success': False,
        'error': '缺少 xhshow 库，请运行：pip3 install xhshow'
    }, ensure_ascii=False))
    sys.exit(1)

def get_random_user_agent():
    """生成随机 User-Agent"""
    user_agents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]
    return random.choice(user_agents)

def search_xiaohongshu(keyword, cookie=None, limit=5):
    """
    真实测试小红书搜索功能（使用官方 API）
    
    Args:
        keyword: 搜索关键词
        cookie: 小红书 Cookie（必需，包含 a1 值）
        limit: 返回结果数量限制
        
    Returns:
        dict: 搜索结果
    """
    try:
        if not cookie:
            return {
                'success': False,
                'error': '小红书搜索必须提供 Cookie，请复制浏览器中的 Cookie'
            }
        
        # 清理 Cookie 中的特殊字符
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        # 从 Cookie 中提取 a1 值
        a1_value = None
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                if key.strip() == 'a1':
                    a1_value = value.strip()
                    break
        
        if not a1_value:
            return {
                'success': False,
                'error': '无法从 Cookie 中提取 a1 值，请检查 Cookie 是否正确'
            }
        
        # 随机休眠 1-3 秒，模拟人工操作
        sleep_time = random.uniform(1, 3)
        time.sleep(sleep_time)
        
        # 初始化 xhshow 客户端
        client = Xhshow()
        
        # 生成 search_id
        search_id = client.get_search_id()
        
        # API 端点（与后端服务一致）
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        uri = "/api/sns/web/v2/search/notes"
        
        # page_size 必须 >= 10
        actual_page_size = max(limit, 10)
        
        # API 参数
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
        
        # 将 Cookie 转换为字典
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        if response.status_code != 200:
            return {
                'success': False,
                'error': f'HTTP 错误：{response.status_code}'
            }
        
        result = response.json()
        
        if not result.get('success'):
            error_msg = result.get('msg', '请求失败')
            if '登录' in error_msg or 'login' in error_msg.lower():
                return {
                    'success': False,
                    'error': 'Cookie 已过期或需要登录，请重新获取 Cookie'
                }
            return {
                'success': False,
                'error': error_msg
            }
        
        items = result.get('data', {}).get('items', [])
        result_count = len(items)
        
        if result_count > 0:
            return {
                'success': True,
                'count': min(result_count, limit),
                'keyword': keyword,
                'message': f'✅ 搜索成功，找到 {result_count} 条笔记'
            }
        else:
            return {
                'success': False,
                'error': f'未找到与"{keyword}"相关的笔记（可能是关键词太冷门）'
            }
    
    except Exception as e:
        return {
            'success': False,
            'error': f'未知错误：{str(e)}'
        }

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': '缺少参数：keyword'
        }, ensure_ascii=False))
        sys.exit(1)
    
    keyword = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    cookie = sys.argv[3] if len(sys.argv) > 3 else None
    
    # 执行搜索
    result = search_xiaohongshu(keyword, cookie, limit)
    
    # 输出 JSON 结果
    print(json.dumps(result, ensure_ascii=False))
    
    # 总是返回 0，让 Node.js 代码解析 JSON 判断成功与否
    sys.exit(0)

if __name__ == '__main__':
    main()
