#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 TypeScript 中嵌入的 Python 脚本
"""

import json
import sys
import time
import random
import requests
from xhshow import Xhshow

# 测试参数
cookie = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"
keyword = "美食"
max_results = 5

try:
    # 随机休眠 1-3 秒（测试时缩短时间）
    sleep_time = random.uniform(1, 3)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    
    # 从 Cookie 中提取 a1 值
    a1_value = None
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            if key.strip() == 'a1':
                a1_value = value.strip()
                break
    
    if not a1_value:
        print(json.dumps({"error": "无法从 Cookie 中提取 a1 值"}))
        sys.exit(1)
    
    print(f"🔑 a1 值：{a1_value[:20]}...")
    
    # 初始化 xhshow 客户端
    client = Xhshow()
    
    # 生成 search_id
    search_id = client.get_search_id()
    print(f"📋 search_id: {search_id}")
    
    # API 参数
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": min(max_results, 20),
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
    
    print(f"✍️ 签名：{signature[:50]}...")
    
    # 构建 headers
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        "content-type": "application/json;charset=UTF-8",
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "zh-CN,zh;q=0.9",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "priority": "u=1, i",
    }
    
    # 将 Cookie 转换为字典
    cookie_dict = {}
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    print(f"\n🚀 发送请求...")
    # 发送请求
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    
    print(f"📊 状态码：{response.status_code}")
    
    if response.status_code != 200:
        print(json.dumps({"error": f"HTTP 错误：{response.status_code}"}))
        sys.exit(1)
    
    result = response.json()
    
    print(f"\n完整响应：{json.dumps(result, ensure_ascii=False)[:500]}")
    
    if not result.get('success'):
        error_msg = result.get('msg', '请求失败')
        print(json.dumps({"error": error_msg}))
        sys.exit(1)
    
    items = result.get('data', {}).get('items', [])
    notes = []
    
    print(f"📦 返回 {len(items)} 条结果\n")
    
    for idx, item in enumerate(items, 1):
        try:
            note_data = item.get('note_card', {}) or item.get('model', {})
            
            # 提取笔记信息
            note = {
                'id': item.get('id', ''),
                'title': note_data.get('display_title', '') or note_data.get('title', '') or '',
                'desc': note_data.get('desc', '') or '',
                'user': {
                    'nickname': note_data.get('user', {}).get('nickname', '') or '',
                    'avatar': note_data.get('user', {}).get('avatar', '') or '',
                    'user_id': note_data.get('user', {}).get('user_id', '') or ''
                },
                'interact_info': {
                    'liked_count': str(note_data.get('interact_info', {}).get('liked_count', 0)),
                    'collected_count': str(note_data.get('interact_info', {}).get('collected_count', 0)),
                    'comment_count': str(note_data.get('interact_info', {}).get('comment_count', 0))
                },
                'cover': {
                    'url': note_data.get('cover', {}).get('url', '') or note_data.get('image_list', [{}])[0].get('url', '') if note_data.get('image_list') else ''
                },
                'type': note_data.get('type', 'normal')
            }
            
            # 构建 URL
            note_id = note['id']
            if note_id:
                note['url'] = f"https://www.xiaohongshu.com/explore/{note_id}"
            else:
                note['url'] = ''
            
            notes.append(note)
            
            # 打印简要信息
            title = note['title'] or '无标题'
            nickname = note['user']['nickname'] or '未知用户'
            likes = note['interact_info']['liked_count']
            print(f"{idx}. {title} - {nickname} (❤️ {likes})")
            
        except Exception as e:
            print(f"⚠️ 解析笔记失败：{e}")
            continue
    
    print(f"\n✅ 成功解析 {len(notes)} 条笔记")
    print(json.dumps({"success": True, "notes": notes, "total": len(notes)}, ensure_ascii=False))
    
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
    sys.exit(1)
