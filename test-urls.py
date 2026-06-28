#!/usr/bin/env python3
import requests
from urllib.parse import quote

keyword = '汽车贴膜'
encoded = quote(keyword)

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

print('=== 测试汽车之家多个 URL ===\n')

# 汽车之家可能的搜索 URL
urls = [
    f'https://club.autohome.com.cn/search/index.aspx?q={encoded}&type=10',
    f'https://www.autohome.com.cn/ask/search/list.aspx?q={encoded}',
    f'https://club.autohome.com.cn/bbs/search?q={encoded}',
    f'https://search.autohome.com.cn/?keyword={encoded}',
]

for url in urls:
    print(f'URL: {url}')
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        print(f'  状态码：{resp.status_code}')
        if resp.status_code == 200:
            print(f'  响应长度：{len(resp.text)}')
            if 'tit' in resp.text.lower() or '帖子' in resp.text or '结果' in resp.text:
                print('  ✅ 可能找到帖子')
        else:
            print('  ❌ 404 或其他错误')
    except Exception as e:
        print(f'  错误：{e}')
    print('')
