#!/usr/bin/env python3
"""
测试完整的搜索笔记 API 请求参数
端点：https://so.xiaohongshu.com/api/sns/web/v2/search/notes
"""

import sys
import json
from xhshow import Xhshow
import requests

# 用户提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"

def test_search_full_params():
    """测试完整参数的搜索 API"""
    print("=" * 60)
    print("测试完整参数的搜索 API")
    print("=" * 60)
    
    client = Xhshow()
    cookie_dict = {}
    for item in COOKIE.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    # 完整的请求参数（根据浏览器抓包）
    payload = {
        "keyword": "奥迪 Q5L",
        "page": 6,
        "page_size": 20,
        "search_id": client.get_search_request_id(),
        "sort": "general",
        "note_type": 0,
        "image_formats": ["jpg", "webp", "avif"],
        "geo": "",
        "message_id": "",
        "ext_flags": [],
        "filters": [
            {"tags": ["general"], "type": "sort_type"},
            {"tags": ["不限"], "type": "filter_note_type"}
        ]
    }
    
    print(f"\n请求参数:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    try:
        # 生成签名 headers
        headers = client.sign_headers(
            method="POST",
            uri="/api/sns/web/v2/search/notes",
            cookies=cookie_dict,
            payload=payload,
            x_rap=False
        )
        
        # 添加额外的 headers
        headers["Content-Type"] = "application/json"
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/explore"
        
        print(f"\n生成的 Headers:")
        print(f"  x-s: {headers.get('x-s', 'N/A')[:80]}...")
        print(f"  x-t: {headers.get('x-t', 'N/A')}")
        print(f"  x-s-common: {headers.get('x-s-common', 'N/A')[:80]}...")
        
        # 发送请求
        response = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=cookie_dict,
            json=payload
        )
        
        print(f"\n响应状态码：{response.status_code}")
        print(f"响应 Headers:")
        for key in ['content-type', 'x-trace-id']:
            if key in response.headers:
                print(f"  {key}: {response.headers[key]}")
        
        # 解析响应
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"\n✅ 请求成功！")
                
                if result.get('data') and result['data'].get('items'):
                    items = result['data']['items']
                    print(f"获取到 {len(items)} 条笔记")
                    
                    # 显示前 3 条笔记
                    print(f"\n前 3 条笔记:")
                    for i, item in enumerate(items[:3], 1):
                        note_card = item.get('note_card', {})
                        print(f"\n  [{i}] 笔记 ID: {item.get('id')}")
                        print(f"      标题：{note_card.get('display_title', '无标题')}")
                        print(f"      类型：{note_card.get('type', 'unknown')}")
                        print(f"      用户：{note_card.get('user', {}).get('nickname', '未知')}")
                        
                        # 显示互动数据
                        interact = note_card.get('interact_info', {})
                        print(f"      点赞：{interact.get('liked_count', 0)}")
                        print(f"      收藏：{interact.get('collected_count', 0)}")
                        print(f"      评论：{interact.get('comment_count', 0)}")
                        
                        # 显示 xsec_token
                        print(f"      xsec_token: {item.get('xsec_token', 'N/A')[:50]}...")
                    
                    return True, result
                else:
                    print(f"\n❌ 未获取到数据")
                    print(f"响应内容：{json.dumps(result, indent=2, ensure_ascii=False)[:1000]}")
                    return False, result
                    
            except json.JSONDecodeError as e:
                print(f"\n❌ JSON 解析失败：{e}")
                print(f"原始响应：{response.text[:500]}")
                return False, None
        else:
            print(f"\n❌ 请求失败：{response.text[:500]}")
            return False, None
            
    except Exception as e:
        print(f"\n❌ 请求异常：{e}")
        import traceback
        traceback.print_exc()
        return False, None

def test_search_with_detail():
    """搜索并获取第一个笔记的详情"""
    print("\n" + "=" * 60)
    print("测试搜索 + 详情完整流程")
    print("=" * 60)
    
    # 先搜索
    success, search_result = test_search_full_params()
    if not success or not search_result:
        return False
    
    # 获取第一个笔记的详情
    first_note = search_result['data']['items'][0]
    note_id = first_note['id']
    xsec_token = first_note.get('xsec_token')
    
    if not xsec_token:
        print("\n❌ 未获取到 xsec_token")
        return False
    
    print(f"\n获取笔记详情:")
    print(f"  笔记 ID: {note_id}")
    print(f"  xsec_token: {xsec_token[:50]}...")
    
    # 调用详情 API
    client = Xhshow()
    cookie_dict = {}
    for item in COOKIE.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    detail_payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_search",
        "xsec_token": xsec_token
    }
    
    detail_headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v1/feed",
        cookies=cookie_dict,
        payload=detail_payload,
        x_rap=True
    )
    detail_headers["Content-Type"] = "application/json"
    
    detail_response = requests.post(
        "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
        headers=detail_headers,
        cookies=cookie_dict,
        json=detail_payload
    )
    
    print(f"\n详情响应状态码：{detail_response.status_code}")
    
    if detail_response.status_code == 200:
        detail_result = detail_response.json()
        if detail_result.get('data') and detail_result['data'].get('items'):
            note_card = detail_result['data']['items'][0]['note_card']
            print(f"\n✅ 成功获取详情！")
            print(f"  标题：{note_card.get('title', 'N/A')}")
            print(f"  描述：{note_card.get('desc', 'N/A')[:100]}...")
            print(f"  用户：{note_card.get('user', {}).get('nickname', 'N/A')}")
            print(f"  图片数：{len(note_card.get('image_list', []))}")
            return True
    
    print(f"\n❌ 获取详情失败")
    print(f"响应：{detail_response.text[:500]}")
    return False

if __name__ == "__main__":
    # 测试完整参数的搜索
    success, _ = test_search_full_params()
    
    # 测试搜索 + 详情完整流程
    if success:
        test_search_with_detail()
    
    sys.exit(0 if success else 1)
