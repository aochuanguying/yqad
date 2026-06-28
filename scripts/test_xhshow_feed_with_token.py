#!/usr/bin/env python3
"""
使用 xsec_token 测试 feed API
这是正确的参数格式，包含 xsec_source 和 xsec_token
"""

import sys
import json
from xhshow import Xhshow
import requests

# 用户提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"

def search_and_get_detail(keyword="Python 编程"):
    """搜索笔记并使用正确的参数获取详情"""
    print("=" * 60)
    print("步骤 1: 搜索笔记获取 xsec_token")
    print("=" * 60)
    
    client = Xhshow()
    cookie_dict = {}
    for item in COOKIE.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    # 搜索
    search_payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": 10,
        "search_id": client.get_search_request_id(),
        "extend": {
            "title_encoding": 1,
            "desc_encoding": 1
        }
    }
    
    search_headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v2/search/notes",
        cookies=cookie_dict,
        payload=search_payload,
        x_rap=False
    )
    search_headers["Content-Type"] = "application/json"
    search_headers["Origin"] = "https://www.xiaohongshu.com"
    search_headers["Referer"] = "https://www.xiaohongshu.com/explore"
    
    search_response = requests.post(
        "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
        headers=search_headers,
        cookies=cookie_dict,
        json=search_payload
    )
    
    print(f"搜索响应状态码：{search_response.status_code}")
    
    if search_response.status_code != 200:
        print(f"❌ 搜索失败：{search_response.text}")
        return False
    
    search_result = search_response.json()
    if not search_result.get('data') or not search_result['data'].get('items'):
        print("❌ 未获取到搜索结果")
        return False
    
    # 获取第一个笔记的信息
    first_note = search_result['data']['items'][0]
    note_id = first_note['id']
    xsec_token = first_note.get('xsec_token')
    
    print(f"✅ 搜索成功")
    print(f"  笔记 ID: {note_id}")
    print(f"  xsec_token: {xsec_token}")
    
    # 使用正确的参数获取详情
    print("\n" + "=" * 60)
    print("步骤 2: 使用正确的参数获取详情")
    print("=" * 60)
    
    detail_payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_search",
        "xsec_token": xsec_token
    }
    
    print(f"\n请求载荷：{json.dumps(detail_payload, indent=2)}")
    
    detail_headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v1/feed",
        cookies=cookie_dict,
        payload=detail_payload,
        x_rap=True
    )
    detail_headers["Content-Type"] = "application/json"
    detail_headers["Origin"] = "https://www.xiaohongshu.com"
    detail_headers["Referer"] = "https://www.xiaohongshu.com/"
    
    detail_response = requests.post(
        "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
        headers=detail_headers,
        cookies=cookie_dict,
        json=detail_payload
    )
    
    print(f"\n详情响应状态码：{detail_response.status_code}")
    
    if detail_response.status_code == 200:
        detail_result = detail_response.json()
        print(f"\n✅ 成功获取详情！")
        print(f"响应内容 (前 3000 字符):")
        print(json.dumps(detail_result, indent=2, ensure_ascii=False)[:3000])
        
        if detail_result.get('data') and detail_result['data'].get('items'):
            item = detail_result['data']['items'][0]
            print(f"\n=== 笔记详细信息 ===")
            print(f"笔记 ID: {item.get('id')}")
            print(f"标题：{item.get('title', 'N/A')}")
            print(f"描述：{item.get('desc', 'N/A')[:200] if item.get('desc') else 'N/A'}")
            
            if 'user' in item:
                user = item['user']
                print(f"用户：{user.get('nickname', 'N/A')}")
                print(f"用户 ID: {user.get('user_id', 'N/A')}")
            
            if 'images_list' in item:
                print(f"图片数量：{len(item['images_list'])}")
            
            return True
        else:
            print("\n❌ 未获取到有效数据")
            if detail_result.get('msg'):
                print(f"错误信息：{detail_result.get('msg')}")
            return False
    else:
        print(f"❌ 详情请求失败")
        print(f"响应内容：{detail_response.text[:500]}")
        return False

if __name__ == "__main__":
    success = search_and_get_detail()
    sys.exit(0 if success else 1)
