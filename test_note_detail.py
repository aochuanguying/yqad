#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试小红书笔记详情 API - 使用 xsec_token
根据资料，需要 source_note_id 和 xsec_token 参数
"""

import time
import random
import requests
import json
from xhshow import Xhshow

# Cookie (从抓包获取)
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"


def test_note_detail():
    """获取笔记详情"""
    print("=" * 80)
    print("📝 测试小红书笔记详情 API")
    print("=" * 80)
    print()
    
    # 随机休眠
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    print()
    
    client = Xhshow()
    
    # API 路径 - 尝试多种方式
    test_cases = [
        {
            "name": "方案 1: /api/sns/web/v1/feed (source_note_id)",
            "url": "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            "uri": "/api/sns/web/v1/feed",
            "payload": {
                "source_note_id": "69635d04000000000b00996b",
                "image_formats": ["jpg", "webp", "avif"],
                "extra": {"need_body_topic": "1"}
            }
        },
        {
            "name": "方案 2: /api/sns/web/v2/feed (带 xsec_token)",
            "url": "https://edith.xiaohongshu.com/api/sns/web/v2/feed",
            "uri": "/api/sns/web/v2/feed",
            "payload": {
                "note_id": "69635d04000000000b00996b",
                "xsec_token": "ABsx0ZpbDH4yyYBkR95YLx6jOuRXRa0RnwWLSX7E1Rkyw=",  # 从搜索结果中获取的 token
                "image_formats": ["jpg", "webp", "avif"],
            }
        },
        {
            "name": "方案 3: /api/sns/web/v1/note/{note_id}",
            "url": "https://edith.xiaohongshu.com/api/sns/web/v1/note/69635d04000000000b00996b",
            "uri": "/api/sns/web/v1/note/69635d04000000000b00996b",
            "payload": {}
        },
    ]
    
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
    
    for test_case in test_cases:
        print(f"\n{'='*80}")
        print(f"🔬 测试：{test_case['name']}")
        print(f"{'='*80}")
        
        try:
            # 生成签名
            signature = client.sign_xs_post(
                uri=test_case['uri'],
                a1_value=a1_value,
                payload=test_case['payload']
            )
            
            # 构建 headers
            headers = {
                "x-s": signature,
                "x-t": str(int(time.time() * 1000)),
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
            
            print(f"🔗 URL: {test_case['url']}")
            print(f"📋 Payload: {json.dumps(test_case['payload'], ensure_ascii=False)}")
            print()
            
            # 发送请求
            response = requests.post(
                test_case['url'],
                headers=headers,
                json=test_case['payload'],
                cookies=cookie_dict,
                timeout=30
            )
            
            print(f"📊 状态码：{response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('success'):
                    print("✅ 请求成功！")
                    # 解析笔记数据
                    note_data = result.get('data', {})
                    if note_data:
                        note = note_data.get('note', {}) or note_data
                        title = note.get('title', '无标题')
                        desc = note.get('desc', '')[:100]
                        user = note.get('user', {})
                        nickname = user.get('nickname', '未知用户')
                        
                        print(f"\n📋 笔记信息：")
                        print(f"   标题：{title}")
                        print(f"   描述：{desc}...")
                        print(f"   作者：{nickname}")
                        return True
                    else:
                        print("⚠️ 未找到笔记数据")
                        print(f"响应：{json.dumps(result, ensure_ascii=False, indent=2)[:500]}")
                else:
                    print(f"❌ 请求失败")
                    print(f"   错误码：{result.get('code')}")
                    print(f"   错误信息：{result.get('msg', 'Unknown error')}")
            else:
                print(f"❌ HTTP 错误：{response.status_code}")
                print(f"   响应：{response.text[:200]}")
        
        except Exception as e:
            print(f"❌ 异常：{str(e)}")
    
    return False


if __name__ == "__main__":
    success = test_note_detail()
    
    print()
    print("=" * 80)
    if success:
        print("✅ 测试成功！")
    else:
        print("❌ 测试失败")
    print("=" * 80)
