#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 xhshow - 获取首页推荐（使用正确的参数）
"""

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
    
    # 首页推荐 API（从 xhs 库源码找到）
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
    uri = "/api/sns/web/v1/homefeed"
    
    # 正确的参数（从 xhs 库的 get_home_feed 方法复制）
    params = {
        "cursor_score": "",
        "num": 40,
        "refresh_type": 1,
        "note_index": 0,
        "unread_begin_note_id": "",
        "unread_end_note_id": "",
        "unread_note_count": 0,
        "category": "homefeed_recommend"  # 推荐
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
    # 使用 xhshow 的 sign_xs_get 方法
    signature = client.sign_xs_get(
        uri=uri,
        a1_value=a1_value,
        params=params
    )
    
    # 构建 headers
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),  # 毫秒级时间戳
        "user-agent": USER_AGENT,
        "accept": "application/json, text/plain, */*",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    }
    
    # 将 Cookie 转换为字典
    cookie_dict = {}
    for item in COOKIE.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    print(f"🔗 URL: {url}")
    print(f"📋 参数：num={params['num']}, category={params['category']}")
    print()
    
    try:
        print("🚀 发送 GET 请求...")
        response = requests.get(url, headers=headers, params=params, cookies=cookie_dict, timeout=30)
        
        print(f"📊 状态码：{response.status_code}")
        print(f"📋 响应内容：{response.text[:500]}")
        print()
        
        try:
            result = response.json()
        except:
            print("❌ 无法解析 JSON 响应")
            return False
        
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
    success = test_homefeed()
    
    print()
    print("=" * 80)
    if success:
        print("✅ 测试成功！")
    else:
        print("❌ 测试失败")
    print("=" * 80)
