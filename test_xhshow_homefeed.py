#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 xhshow - 获取首页推荐
"""

import sys
import time
import random
import requests
from xhshow import Xhshow

# Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; acw_tc=0ad5802f17826147427347699e2ec1f4e207b6eaa777e0114e760754187049; loadts=1782616049151; websectiga=6169c1e84f393779a5f7de7303038f3b47a78e47be716e7bec57ccce17d45f99; sec_poison_id=7d02d1ea-152f-42d7-b43a-a5341b38c6c9; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; unread={%22ub%22:%226a2d65b7000000002103f4f4%22%2C%22ue%22:%226a2fa3f30000000011010599%22%2C%22uc%22:33}"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

def test_homefeed():
    """获取首页推荐"""
    print("=" * 80)
    print("🔍 测试 xhshow - 获取首页推荐")
    print("=" * 80)
    print()
    
    # 随机休眠
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    print()
    
    client = Xhshow()
    
    # 获取首页推荐
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
    uri = "/api/sns/web/v1/homefeed"
    
    params = {
        "page_size": 10,
        "cursor": "",
        "refresh_type": 1,
        "image_formats": "jpg,webp,avif"
    }
    
    print("🔄 生成签名...")
    headers = client.sign_headers_get(
        uri=uri,
        cookies=COOKIE,
        params=params
    )
    
    print(f"   x-s: {headers.get('x-s', 'N/A')[:50]}...")
    print(f"   x-t: {headers.get('x-t', 'N/A')}")
    print()
    
    headers.update({
        "user-agent": USER_AGENT,
        "accept": "application/json, text/plain, */*",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    })
    
    print(f"🔗 URL: {url}")
    print()
    
    try:
        print("🚀 发送 GET 请求...")
        # 将 Cookie 字符串转换为字典
        cookie_dict = {}
        for item in COOKIE.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        response = requests.get(url, headers=headers, params=params, cookies=cookie_dict, timeout=30)
        
        print(f"📊 状态码：{response.status_code}")
        print()
        
        result = response.json()
        
        import json
        print("完整响应：")
        print(json.dumps(result, ensure_ascii=False, indent=2)[:1500])
        print()
        
        if result.get('success'):
            print("✅ 请求成功！")
            items = result.get('data', {}).get('items', [])
            print(f"📦 返回 {len(items)} 条结果\n")
            
            for idx, item in enumerate(items[:3], 1):
                note_data = item.get('note_card', {}) or item.get('model', {})
                title = note_data.get('display_title', '') or '无标题'
                nickname = note_data.get('user', {}).get('nickname', '未知用户')
                print(f"{idx}. {title} - {nickname}")
            
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
    success = test_homefeed()
    
    print()
    print("=" * 80)
    if success:
        print("✅ 测试成功！")
    else:
        print("❌ 测试失败")
    print("=" * 80)
