#!/usr/bin/env python3
"""
测试使用 v2 版本的 feed API
端点：https://www.xiaohongshu.com/api/sns/web/v2/feed
"""

import sys
import json
from xhshow import Xhshow
import requests

# 用户提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"

def test_feed_v2():
    """测试 v2 feed API"""
    print("=" * 60)
    print("测试 www.xiaohongshu.com/api/sns/web/v2/feed")
    print("=" * 60)
    
    client = Xhshow()
    cookie_dict = {}
    for item in COOKIE.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    # 使用多个笔记 ID 测试
    payload = {
        "source_note_ids": ["6a2639e9000000003503b94a", "683160f9000000001101dcf1"],
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"}
    }
    
    print(f"\n请求笔记 ID: {payload['source_note_ids']}")
    print(f"请求载荷：{json.dumps(payload, indent=2)}")
    
    try:
        # 使用 sign_headers 生成完整 headers
        headers = client.sign_headers(
            method="POST",
            uri="/api/sns/web/v2/feed",
            cookies=cookie_dict,
            payload=payload,
            x_rap=True  # feed 端点需要 x-rap-param
        )
        
        # 添加额外的 headers
        headers["Content-Type"] = "application/json"
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/"
        
        print(f"\n生成的 Headers:")
        print(f"  x-s: {headers.get('x-s', 'N/A')[:80]}...")
        print(f"  x-t: {headers.get('x-t', 'N/A')}")
        print(f"  x-rap-param: {headers.get('x-rap-param', 'N/A')[:80]}...")
        
        # 发送请求
        response = requests.post(
            "https://www.xiaohongshu.com/api/sns/web/v2/feed",
            headers=headers,
            cookies=cookie_dict,
            json=payload
        )
        
        print(f"\n响应状态码：{response.status_code}")
        print(f"响应 Headers:")
        for key in ['content-type', 'x-trace-id', 'x-error-message']:
            if key in response.headers:
                print(f"  {key}: {response.headers[key]}")
        
        # 解析响应
        try:
            result = response.json()
            print(f"\n响应内容 (前 3000 字符):")
            print(json.dumps(result, indent=2, ensure_ascii=False)[:3000])
            
            # 检查是否有数据返回
            if result.get('data') and result['data'].get('items'):
                print("\n✅ 成功获取笔记详情！")
                items = result['data']['items']
                for i, item in enumerate(items):
                    print(f"\n  [{i+1}] 笔记信息:")
                    print(f"    笔记 ID: {item.get('id')}")
                    print(f"    标题：{item.get('title', 'N/A')}")
                    print(f"    描述：{item.get('desc', 'N/A')[:100] if item.get('desc') else 'N/A'}...")
                    if 'user' in item:
                        print(f"    用户：{item['user'].get('nickname', 'N/A')}")
                return True
            else:
                print("\n❌ 未获取到有效数据")
                if result.get('msg'):
                    print(f"  错误信息：{result.get('msg')}")
                return False
                
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON 解析失败：{e}")
            print(f"原始响应：{response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"\n❌ 请求失败：{e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_feed_v2()
    sys.exit(0 if success else 1)
