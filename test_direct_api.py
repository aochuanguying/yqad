#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
直接使用 requests 调用小红书 API
完全按照抓包数据来构造请求
"""

import requests
import json
import time
import random
import hashlib
import base64

# Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782614742088; websectiga=984412fef754c018e472127b8effd174be8a5d51061c991aadd200c69a2801d6; sec_poison_id=9f4b3797-1b6f-4eee-b833-1c875a4398e3; acw_tc=0ad5802f17826147427347699e2ec1f4e207b6eaa777e0114e760754187049; web_session=040069b6d9aed466dced8fc275384b3e1b53d2; id_token=VjEAAFgCoRqytC1W+thmV8rO3XCgts5ts8LaCV6AbFn5kSgHltj6weieiRes/S8fWLEyXIaB/2zQFTeuUP5fIEW/1JS7bZdt5b+YKL2lDceudrvqpHv2nEtTVQgpUhS2Lt7xoEVl; unread={%22ub%22:%226a3f90d0000000001c0275d8%22%2C%22ue%22:%226a323726000000002201a24a%22%2C%22uc%22:32}"

# User-Agent
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

# 从抓包数据中提取的 x-s 签名（这个是固定的还是动态的？）
X_S = "XYS_2UQhPsHCH0c1PUhMHjIj2erjwjQhyoPTqBPT49pjHjIj2eHjwjQ+GnPW/MPjNsQhPUHCHfM1qAZAPebK8MQYa7b/paTOy0b3qMch8FpFPBSDPfEYLe+pqMHh+p8Aa9khnL4Da/QxPeP720zDqBTBJLRF8SYNynkz2gZFN7pbLSY0PBp/PnzCyokILS4wzgQALb4bpFME+DlOpgmspSkBPrlGPSzQcpplpfzm/b87PMLIaDYNnb+tqrlMp/qMtFMeJdmALdkaaSmpGpcAJo86aM+18b8yJB+kz/mtLDS3PrRH/SQaprMA/0zCpaTEnnWh/nP74LDI8BEbPBl/HjIj2ecjwjQ6GfkSG7cjKc=="

# 从抓包数据中提取的 x-t 时间戳
X_T = "1782614864171"

def test_search_api():
    """测试搜索 API"""
    print("=" * 80)
    print("🔍 直接使用 requests 测试小红书搜索 API")
    print("=" * 80)
    print()
    
    # 随机休眠
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f}秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成")
    print()
    
    # API URL
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"
    
    # 请求头
    headers = {
        "authority": "edith.xiaohongshu.com",
        "method": "POST",
        "path": "/api/sns/web/v1/search/notes",
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
    }
    
    # 生成 search_id（随机 UUID）
    import uuid
    search_id = str(uuid.uuid4())
    
    # 请求体
    data = {
        "keyword": "奥迪 Q5L",
        "page": 1,
        "page_size": 10,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0
    }
    
    print(f"📝 搜索关键词：奥迪 Q5L")
    print(f"🔗 URL: {url}")
    print(f"📋 search_id: {search_id}")
    print()
    
    try:
        # 发送请求
        print("🚀 发送 POST 请求...")
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        print(f"📊 状态码：{response.status_code}")
        print()
        
        # 解析响应
        result = response.json()
        
        if result.get('success'):
            print("✅ 请求成功！")
            print()
            
            # 显示结果
            items = result.get('data', {}).get('items', [])
            print(f"📦 返回 {len(items)} 条结果\n")
            
            for idx, item in enumerate(items[:3], 1):
                try:
                    note_data = item.get('note_card', {}) or item.get('model', {})
                    title = note_data.get('display_title', '') or note_data.get('title', '') or '无标题'
                    desc = note_data.get('desc', '') or ''
                    user = note_data.get('user', {}) or {}
                    nickname = user.get('nickname', '') or '未知用户'
                    
                    interact_info = note_data.get('interact_info', {}) or {}
                    likes = interact_info.get('liked_count', 0)
                    collects = interact_info.get('collected_count', 0)
                    comments = interact_info.get('comment_count', 0)
                    
                    if len(desc) > 60:
                        desc = desc[:60] + "..."
                    
                    print(f"{idx}. {title}")
                    print(f"   作者：{nickname}")
                    print(f"   描述：{desc}")
                    print(f"   互动：❤️ {likes}  ⭐ {collects}  💬 {comments}")
                    print()
                except Exception as e:
                    print(f"第 {idx} 条结果解析失败：{e}")
                    print()
            
            return True
        else:
            print(f"❌ 请求失败")
            print(f"   错误码：{result.get('code')}")
            print(f"   错误信息：{result.get('msg', 'Unknown error')}")
            print()
            print("完整响应：")
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return False
        
    except Exception as e:
        print(f"❌ 异常：{str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始测试")
    print()
    
    success = test_search_api()
    
    print("=" * 80)
    if success:
        print("✅ 测试成功！")
    else:
        print("❌ 测试失败")
    print("=" * 80)
