#!/usr/bin/env python3
"""
先搜索获取最新笔记 ID，然后使用 v1 feed API 获取详情
"""

import sys
import json
from xhshow import Xhshow
import requests

# 用户提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"

def search_notes(keyword="Python 编程"):
    """搜索笔记获取最新 ID"""
    print("=" * 60)
    print("步骤 1: 搜索笔记")
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
        if result.get('data') and result['data'].get('items'):
            items = result['data']['items']
            print(f"✅ 搜索成功，获取到 {len(items)} 条笔记")
            
            # 返回前 3 个笔记 ID
            note_ids = []
            for i, item in enumerate(items[:3]):
                note_id = item.get('id')
                title = item.get('title', '无标题')
                print(f"  [{i+1}] 笔记 ID: {note_id}, 标题：{title}")
                note_ids.append(note_id)
            
            return note_ids, cookie_dict
        else:
            print("❌ 未获取到搜索结果")
            return [], cookie_dict
    else:
        print(f"❌ 搜索失败：{response.text}")
        return [], cookie_dict

def get_note_detail(note_id, cookie_dict):
    """使用 v1 feed API 获取笔记详情"""
    print("\n" + "=" * 60)
    print(f"步骤 2: 获取笔记详情 - {note_id}")
    print("=" * 60)
    
    client = Xhshow()
    
    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"}
    }
    
    headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v1/feed",
        cookies=cookie_dict,
        payload=payload,
        x_rap=True
    )
    headers["Content-Type"] = "application/json"
    headers["Origin"] = "https://www.xiaohongshu.com"
    headers["Referer"] = "https://www.xiaohongshu.com/"
    
    response = requests.post(
        "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
        headers=headers,
        cookies=cookie_dict,
        json=payload
    )
    
    print(f"详情响应状态码：{response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"响应内容:")
        print(json.dumps(result, indent=2, ensure_ascii=False)[:2000])
        
        if result.get('data') and result['data'].get('items'):
            print("\n✅ 成功获取笔记详情！")
            item = result['data']['items'][0]
            print(f"  笔记 ID: {item.get('id')}")
            print(f"  标题：{item.get('title', 'N/A')}")
            print(f"  描述：{item.get('desc', 'N/A')[:200]}...")
            
            # 显示更多详细信息
            if 'model_type' in item:
                print(f"  模型类型：{item['model_type']}")
            if 'user' in item:
                user = item['user']
                print(f"  用户：{user.get('nickname', 'N/A')}")
            
            return True
        else:
            print("\n❌ 未获取到有效数据")
            if result.get('msg'):
                print(f"  错误信息：{result.get('msg')}")
            return False
    else:
        print(f"❌ 请求失败：{response.text[:500]}")
        return False

def main():
    """主函数"""
    # 搜索笔记
    note_ids, cookie_dict = search_notes("Python 编程")
    
    if not note_ids:
        print("\n❌ 搜索失败，无法继续")
        return False
    
    # 尝试获取每个笔记的详情
    success_count = 0
    for note_id in note_ids:
        if get_note_detail(note_id, cookie_dict):
            success_count += 1
            break  # 成功一个就停止
    
    print(f"\n{'='*60}")
    print(f"总结：尝试 {len(note_ids)} 个笔记，成功 {success_count} 个")
    print("=" * 60)
    
    return success_count > 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
