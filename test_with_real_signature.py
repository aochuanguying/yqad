#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用真实签名测试小红书 API
思路：直接使用浏览器抓包得到的 x-s 和 x-t 签名
"""

import requests
import json
import time
import random
import uuid

# Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782614742088; websectiga=984412fef754c018e472127b8effd174be8a5d51061c991aadd200c69a2801d6; sec_poison_id=9f4b3797-1b6f-4eee-b833-1c875a4398e3; acw_tc=0ad5802f17826147427347699e2ec1f4e207b6eaa777e0114e760754187049; web_session=040069b6d9aed466dced8fc275384b3e1b53d2; id_token=VjEAAFgCoRqytC1W+thmV8rO3XCgts5ts8LaCV6AbFn5kSgHltj6weieiRes/S8fWLEyXIaB/2zQFTeuUP5fIEW/1JS7bZdt5b+YKL2lDceudrvqpHv2nEtTVQgpUhS2Lt7xoEVl; unread={%22ub%22:%226a3f90d0000000001c0275d8%22%2C%22ue%22:%226a323726000000002201a24a%22%2C%22uc%22:32}"

# User-Agent
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

# 从抓包数据中提取的真实签名
# 注意：这些签名是对应特定请求的，可能不能重复使用
REAL_X_S = "XYS_2UQhPsHCH0c1PUhMHjIj2erjwjQhyoPTqBPT49pjHjIj2eHjwjQ+GnPW/MPjNsQhPUHCHfM1qAZAPebK8MQYa7b/paTOy0b3qMch8FpFPBSDPfEYLe+pqMHh+p8Aa9khnL4Da/QxPeP720zDqBTBJLRF8SYNynkz2gZFN7pbLSY0PBp/PnzCyokILS4wzgQALb4bpFME+DlOpgmspSkBPrlGPSzQcpplpfzm/b87PMLIaDYNnb+tqrlMp/qMtFMeJdmALdkaaSmpGpcAJo86aM+18b8yJB+kz/mtLDS3PrRH/SQaprMA/0zCpaTEnnWh/nP74LDI8BEbPBl/HjIj2ecjwjQ6GfkSG7cjKc=="
REAL_X_T = "1782614864171"

def generate_new_signature(keyword, page=1, page_size=10):
    """
    使用 xhs 库生成新的签名
    虽然可能不是最新的，但先试试
    """
    from xhs.help import sign
    
    search_id = str(uuid.uuid4())
    data = {
        "keyword": keyword,
        "page": page,
        "page_size": page_size,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0
    }
    
    # 提取 Cookie 中的 a1 和 web_session
    import re
    a1_match = re.search(r'a1=([^;]+)', COOKIE)
    web_session_match = re.search(r'web_session=([^;]+)', COOKIE)
    
    a1 = a1_match.group(1) if a1_match else ""
    web_session = web_session_match.group(1) if web_session_match else ""
    
    uri = "/api/sns/web/v1/search/notes"
    signature = sign(uri, data, a1=a1, b1=web_session)
    
    return signature, data

def test_with_library_signature():
    """使用 xhs 库生成的签名"""
    print("=" * 80)
    print("🔍 测试方案：使用 xhs 库生成签名（可能不是最新算法）")
    print("=" * 80)
    print()
    
    # 随机休眠
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    print()
    
    # 生成签名
    print("🔄 生成签名...")
    signature, data = generate_new_signature("奥迪 Q5L")
    print(f"   x-s: {signature['x-s'][:50]}...")
    print(f"   x-t: {signature['x-t']}")
    print(f"   x-s-common: {signature['x-s-common'][:50]}...")
    print()
    
    # API URL
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"
    
    # 请求头
    headers = {
        "authority": "edith.xiaohongshu.com",
        "method": "POST",
        "scheme": "https",
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/json;charset=UTF-8",
        "cookie": COOKIE,
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": USER_AGENT,
        "x-s": signature['x-s'],
        "x-t": signature['x-t'],
        "x-s-common": signature['x-s-common'],
    }
    
    print(f"📝 搜索关键词：奥迪 Q5L")
    print(f"🔗 URL: {url}")
    print()
    
    try:
        # 发送请求
        print("🚀 发送 POST 请求...")
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        print(f"📊 状态码：{response.status_code}")
        print()
        
        result = response.json()
        
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

def test_get_homepage():
    """
    测试方案 2：先访问首页，建立会话
    """
    print()
    print("=" * 80)
    print("🔍 测试方案 2：先访问首页建立会话")
    print("=" * 80)
    print()
    
    session = requests.Session()
    
    # 设置 Cookie
    session.headers.update({
        "user-agent": USER_AGENT,
        "cookie": COOKIE,
    })
    
    # 先访问首页
    print("🏠 访问首页...")
    try:
        resp = session.get("https://www.xiaohongshu.com", timeout=10)
        print(f"   状态码：{resp.status_code}")
        print(f"   页面标题长度：{len(resp.text)}")
        print()
    except Exception as e:
        print(f"   ❌ 访问首页失败：{e}")
        print()
    
    # 然后访问 API
    print("🔍 访问搜索 API...")
    search_url = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"
    
    data = {
        "keyword": "test",
        "page": 1,
        "page_size": 5,
        "search_id": str(uuid.uuid4()),
        "sort": "general",
        "note_type": 0
    }
    
    try:
        resp = session.post(search_url, json=data, timeout=10)
        print(f"   状态码：{resp.status_code}")
        
        result = resp.json()
        if result.get('success'):
            print("   ✅ 成功！")
            return True
        else:
            print(f"   ❌ 失败：{result.get('msg')}")
            return False
    except Exception as e:
        print(f"   ❌ 异常：{e}")
        return False

if __name__ == "__main__":
    print("🚀 开始测试新思路")
    print()
    
    # 测试 1：使用 xhs 库生成签名
    success1 = test_with_library_signature()
    
    # 测试 2：先访问首页
    success2 = test_get_homepage()
    
    print()
    print("=" * 80)
    print("📊 测试结果总结")
    print("=" * 80)
    print(f"方案 1（xhs 签名）：{'✅ 成功' if success1 else '❌ 失败'}")
    print(f"方案 2（先访首页）：{'✅ 成功' if success2 else '❌ 失败'}")
    print("=" * 80)
