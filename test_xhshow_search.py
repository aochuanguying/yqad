#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 xhshow 测试小红书搜索 API
根据 xhs 库的源码找到的正确 API 路径
"""

import time
import random
import requests
from xhshow import Xhshow

# Cookie (从抓包获取)
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

def test_search():
    """测试搜索 API"""
    print("=" * 80)
    print("🔍 测试 xhshow - 搜索小红书笔记")
    print("=" * 80)
    print()
    
    # 随机休眠
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    print()
    
    client = Xhshow()
    
    # 正确的搜索 API 路径和参数（从抓包获取）
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    # 使用 xhshow 的 get_search_id() 方法生成 search_id
    search_id = client.get_search_id()
    
    payload = {
        "keyword": "美食",
        "page": 1,
        "page_size": 10,
        "search_id": search_id,
        "sort": "general",  # general, popularity_descending, time_descending
        "note_type": 0  # 0: all, 1: video, 2: image
    }
    
    # 从 Cookie 中提取 a1 值
    a1_value = None
    for item in COOKIE.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            if key.strip() == 'a1':
                a1_value = value.strip()
                break
    
    if not a1_value:
        print("❌ 无法从 Cookie 中提取 a1 值")
        return False
    
    print(f"🔑 a1 值：{a1_value}")
    print()
    
    print("🔄 生成签名...")
    # 使用 xhshow 的 sign_xs_post 方法
    signature = client.sign_xs_post(
        uri=uri,
        a1_value=a1_value,
        payload=payload
    )
    
    # 构建 headers
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),  # 毫秒级时间戳
        "user-agent": USER_AGENT,
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
    }
    
    # 将 Cookie 转换为字典
    cookie_dict = {}
    for item in COOKIE.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    print(f"📝 搜索关键词：美食")
    print(f"🔗 URL: {url}")
    print(f"📋 search_id: {search_id}")
    print()
    
    try:
        print("🚀 发送 POST 请求...")
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        print(f"📊 状态码：{response.status_code}")
        print()
        
        result = response.json()
        
        import json
        print("完整响应：")
        print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])
        print()
        
        if result.get('success'):
            print("✅ 请求成功！")
            items = result.get('data', {}).get('items', [])
            print(f"📦 返回 {len(items)} 条结果\n")
            
            for idx, item in enumerate(items[:5], 1):
                note_data = item.get('note_card', {}) or item.get('model', {})
                title = note_data.get('display_title', '') or '无标题'
                nickname = note_data.get('user', {}).get('nickname', '未知用户')
                interact_info = note_data.get('interact_info', {}) or {}
                likes = interact_info.get('liked_count', 0)
                print(f"{idx}. {title} - {nickname} (❤️ {likes})")
            
            return True
        else:
            print(f"❌ 请求失败")
            print(f"   错误码：{result.get('code')}")
            print(f"   错误信息：{result.get('msg', 'Unknown error')}")
            return False
        
    except Exception as e:
        print(f"❌ 异常：{str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_search()
    
    print()
    print("=" * 80)
    if success:
        print("✅ 测试成功！")
    else:
        print("❌ 测试失败")
    print("=" * 80)
