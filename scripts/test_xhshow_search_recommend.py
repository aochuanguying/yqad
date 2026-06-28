#!/usr/bin/env python3
"""
测试搜索推荐 API
端点：https://edith.xiaohongshu.com/api/sns/web/v1/search/recommend
"""

import sys
import json
from xhshow import Xhshow
import requests
from urllib.parse import quote

# 用户提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"

def test_search_recommend(keyword="奥迪 Q5L"):
    """测试搜索推荐 API"""
    print("=" * 60)
    print(f"测试搜索推荐 API - keyword: {keyword}")
    print("=" * 60)
    
    client = Xhshow()
    cookie_dict = {}
    for item in COOKIE.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    # 构建带参数的 URI
    encoded_keyword = quote(keyword)
    uri = f"/api/sns/web/v1/search/recommend?keyword={encoded_keyword}"
    
    print(f"\n请求 URI: {uri}")
    
    try:
        # GET 请求使用 params，x_rap=False
        headers = client.sign_headers(
            method="GET",
            uri=uri,
            cookies=cookie_dict,
            params={"keyword": keyword},
            x_rap=False
        )
        
        # 添加额外的 headers
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/"
        
        print(f"\n生成的 Headers:")
        print(f"  x-s: {headers.get('x-s', 'N/A')[:80]}...")
        print(f"  x-t: {headers.get('x-t', 'N/A')}")
        print(f"  x-s-common: {headers.get('x-s-common', 'N/A')[:80]}...")
        
        # 发送请求
        response = requests.get(
            f"https://edith.xiaohongshu.com{uri}",
            headers=headers,
            cookies=cookie_dict,
            params={"keyword": keyword}
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
                print(f"响应内容:")
                print(json.dumps(result, indent=2, ensure_ascii=False))
                return True
            except json.JSONDecodeError as e:
                print(f"\n❌ JSON 解析失败：{e}")
                print(f"原始响应：{response.text[:500]}")
                return False
        else:
            print(f"\n❌ 请求失败：{response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"\n❌ 请求异常：{e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_search_recommend()
    sys.exit(0 if success else 1)
