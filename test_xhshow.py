#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 xhshow 库测试小红书签名（最新 mns0301 算法）
"""

import sys
import time
import random
import requests
from xhshow import Xhshow

# Cookie（最新提供的 Cookie - 2026-06-28）
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; acw_tc=0ad5802f17826147427347699e2ec1f4e207b6eaa777e0114e760754187049; loadts=1782616049151; websectiga=6169c1e84f393779a5f7de7303038f3b47a78e47be716e7bec57ccce17d45f99; sec_poison_id=7d02d1ea-152f-42d7-b43a-a5341b38c6c9; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; unread={%22ub%22:%226a2d65b7000000002103f4f4%22%2C%22ue%22:%226a2fa3f30000000011010599%22%2C%22uc%22:33}"

# User-Agent
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

def test_signature():
    """使用 xhshow 生成签名并测试"""
    print("=" * 80)
    print("🔍 测试 xhshow 库（最新 mns0301 签名算法）")
    print("=" * 80)
    print()
    
    # 随机休眠
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    print()
    
    # 初始化 xhshow
    print("🔄 初始化 Xhshow...")
    client = Xhshow()
    print("✅ 初始化成功")
    print()
    
    # 准备请求
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"
    uri = "/api/sns/web/v1/search/notes"
    
    import uuid
    search_id = str(uuid.uuid4())
    data = {
        "keyword": "美食",
        "page": 1,
        "page_size": 10,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0
    }
    
    # 生成签名 headers
    print("📝 生成签名...")
    headers = client.sign_headers_post(
        uri=uri,
        cookies=COOKIE,
        payload=data
    )
    
    print(f"   x-s: {headers.get('x-s', 'N/A')[:50]}...")
    print(f"   x-t: {headers.get('x-t', 'N/A')}")
    print(f"   x-s-common: {headers.get('x-s-common', 'N/A')[:50]}...")
    print(f"   x-b3-traceid: {headers.get('x-b3-traceid', 'N/A')}")
    print(f"   x-xray-traceid: {headers.get('x-xray-traceid', 'N/A')}")
    print()
    
    # 检查 x-s 是否以 XYS_ 开头
    x_s = headers.get('x-s', '')
    if x_s.startswith('XYS_'):
        print("✅ 签名格式正确（以 XYS_ 开头）")
    else:
        print(f"⚠️  签名格式可能不正确（当前：{x_s[:10]}...）")
    print()
    
    # 添加其他 headers
    headers.update({
        "user-agent": USER_AGENT,
        "content-type": "application/json;charset=UTF-8",
        "accept": "application/json, text/plain, */*",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    })
    
    print(f"📝 搜索关键词：美食")
    print(f"🔗 URL: {url}")
    print()
    
    try:
        # 发送请求
        print("🚀 发送 POST 请求...")
        # 将 Cookie 字符串转换为字典
        cookie_dict = {}
        for item in COOKIE.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        response = requests.post(url, headers=headers, json=data, cookies=cookie_dict, timeout=30)
        
        print(f"📊 状态码：{response.status_code}")
        print()
        
        result = response.json()
        
        # 打印完整响应
        import json
        print("完整响应：")
        print(json.dumps(result, ensure_ascii=False, indent=2)[:1000])
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
    print("🚀 开始测试 xhshow 签名库")
    print()
    
    success = test_signature()
    
    print()
    print("=" * 80)
    if success:
        print("✅ 测试成功！xhshow 签名库可用")
        print()
        print("📋 总结：")
        print("   ✅ 使用最新 mns0301 算法")
        print("   ✅ 签名格式正确（XYS_ 开头）")
        print("   ✅ 请求成功返回数据")
    else:
        print("❌ 测试失败")
        print()
        print("💡 可能原因：")
        print("   1. Cookie 已过期（需要重新获取）")
        print("   2. 账号被风控")
        print("   3. 签名算法仍有问题")
    print("=" * 80)
