#!/usr/bin/env python3
"""
详细检查搜索 API 返回的数据，看是否包含完整的笔记信息
"""

import sys
import json
from xhshow import Xhshow
import requests

# 用户提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"

def search_notes_detailed(keyword="Python 编程"):
    """搜索笔记并详细检查返回数据"""
    print("=" * 60)
    print("搜索笔记并检查数据结构")
    print("=" * 60)
    
    client = Xhshow()
    cookie_dict = {}
    for item in COOKIE.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": 10,
        "search_id": client.get_search_request_id(),
        "extend": {
            "title_encoding": 1,
            "desc_encoding": 1
        }
    }
    
    headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v2/search/notes",
        cookies=cookie_dict,
        payload=payload,
        x_rap=False
    )
    headers["Content-Type"] = "application/json"
    headers["Origin"] = "https://www.xiaohongshu.com"
    headers["Referer"] = "https://www.xiaohongshu.com/explore"
    
    response = requests.post(
        "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
        headers=headers,
        cookies=cookie_dict,
        json=payload
    )
    
    print(f"搜索响应状态码：{response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        
        # 显示完整的响应结构
        print("\n=== 完整响应结构 ===")
        print(json.dumps(result, indent=2, ensure_ascii=False)[:3000])
        
        # 详细分析第一个笔记的内容
        if result.get('data') and result['data'].get('items'):
            first_item = result['data']['items'][0]
            
            print("\n=== 第一个笔记的详细字段 ===")
            for key, value in first_item.items():
                if isinstance(value, str):
                    print(f"{key}: {value[:100] if len(value) > 100 else value}")
                elif isinstance(value, dict):
                    print(f"{key}: (字典，包含 {len(value)} 个键)")
                    for k, v in value.items():
                        if isinstance(v, str) and len(v) > 100:
                            print(f"  {k}: {v[:100]}...")
                        else:
                            print(f"  {k}: {v}")
                elif isinstance(value, list):
                    print(f"{key}: (列表，包含 {len(value)} 项)")
                else:
                    print(f"{key}: {value}")
            
            # 检查是否包含发帖需要的关键信息
            print("\n=== 发帖所需关键信息检查 ===")
            required_fields = ['id', 'title', 'desc', 'user', 'images_list', 'video', 'type']
            for field in required_fields:
                if field in first_item:
                    print(f"✅ {field}: 存在")
                else:
                    print(f"❌ {field}: 缺失")
            
            return True
        else:
            print("❌ 未获取到搜索结果")
            return False
    else:
        print(f"❌ 搜索失败：{response.text}")
        return False

if __name__ == "__main__":
    success = search_notes_detailed()
    sys.exit(0 if success else 1)
