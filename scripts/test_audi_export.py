#!/usr/bin/env python3
"""
测试：使用数据库中的 Cookie 搜索奥迪 Q5L 并导出结果
"""

import sys
import json
import time
import mysql.connector
from datetime import datetime
from xhshow import Xhshow
import requests

def get_clean_cookie_from_db():
    """从数据库获取干净的 Cookie"""
    try:
        conn = mysql.connector.connect(
            host='192.168.50.50',
            port=3306,
            user='root',
            password='Wfw7539148@',
            database='yqad_prod_db'
        )
        
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT xiaohongshu_cookie FROM network_post_config WHERE id = 1"
        cursor.execute(sql)
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row and row.get('xiaohongshu_cookie'):
            # 清理 Cookie：移除换行符和多余内容
            cookie = row['xiaohongshu_cookie']
            # 取第一行，移除换行
            clean_cookie = cookie.split('\n')[0].strip()
            print(f"✅ 获取��� Cookie，长度：{len(clean_cookie)}")
            return clean_cookie
        return None
    except Exception as e:
        print(f"❌ 数据库错误：{e}")
        return None

def main():
    print("=" * 60)
    print("测试小红书 API - 奥迪 Q5L")
    print("=" * 60)
    
    # 获取 Cookie
    cookie = get_clean_cookie_from_db()
    if not cookie:
        print("❌ 无法获取 Cookie")
        return False
    
    # 初始化 xhshow
    client = Xhshow()
    cookie_dict = {}
    for item in cookie.split("; "):
        if "=" in item:
            key, value = item.split("=", 1)
            cookie_dict[key] = value
    
    print(f"✅ Cookie 解析成功，字段数：{len(cookie_dict)}")
    print(f"   a1: {cookie_dict.get('a1', '缺失')[:30]}...")
    print(f"   web_session: {cookie_dict.get('web_session', '缺失')[:30]}...")
    print(f"   id_token: {cookie_dict.get('id_token', '缺失')[:30]}...")
    
    # 搜索
    print("\n📋 开始搜索 '奥迪 Q5L'...")
    keyword = "奥迪 Q5L"
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": 10,
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
    
    headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v2/search/notes",
        cookies=cookie_dict,
        payload=payload,
        x_rap=False
    )
    headers["Content-Type"] = "application/json"
    
    try:
        response = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=cookie_dict,
            json=payload
        )
        
        print(f"\n响应状态码：{response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"响应：{json.dumps(result, ensure_ascii=False)[:500]}...")
            
            if result.get('code') == -100:
                print(f"\n❌ Cookie 已过期：{result.get('msg')}")
                print("💡 需要重新登录小红书获取新 Cookie")
                return False
            
            items = result.get('data', {}).get('items', [])
            if items:
                print(f"\n✅ 搜索成功！获取到 {len(items)} 条笔记")
                
                # 显示前 3 条
                for i, item in enumerate(items[:3], 1):
                    note_card = item.get('note_card', {})
                    print(f"\n  [{i}] {note_card.get('display_title', '无标题')}")
                    print(f"      用户：{note_card.get('user', {}).get('nickname', '未知')}")
                    print(f"      点赞：{note_card.get('interact_info', {}).get('liked_count', 0)}")
                    print(f"      ID: {item.get('id')}")
                
                # 获取第一个笔记的详情
                if len(items) > 0:
                    first_note = items[0]
                    note_id = first_note['id']
                    xsec_token = first_note.get('xsec_token')
                    
                    if xsec_token:
                        print(f"\n📝 获取笔记详情：{note_id}")
                        
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
                        
                        print(f"详情响应码：{detail_response.status_code}")
                        
                        if detail_response.status_code == 200:
                            detail_result = detail_response.json()
                            if detail_result.get('data') and detail_result['data'].get('items'):
                                note_detail = detail_result['data']['items'][0]
                                note_card = note_detail.get('note_card', {})
                                
                                print(f"\n✅ 详情获取成功！")
                                print(f"  标题：{note_card.get('title', '无标题')}")
                                print(f"  描述：{note_card.get('desc', '无描述')[:100]}...")
                                print(f"  用户：{note_card.get('user', {}).get('nickname', '未知')}")
                                
                                # 提取图片
                                image_list = note_card.get('image_list', [])
                                image_urls = []
                                for img in image_list:
                                    info_list = img.get('info_list', [])
                                    for info in info_list:
                                        url = info.get('url')
                                        if url:
                                            image_urls.append(url)
                                
                                print(f"  图片数：{len(image_urls)}")
                                if image_urls:
                                    print(f"  图片链接:")
                                    for j, url in enumerate(image_urls[:3], 1):
                                        print(f"    [{j}] {url}")
                                
                                # 保存到文件
                                output_data = {
                                    'search_keyword': keyword,
                                    'search_time': datetime.now().isoformat(),
                                    'note': {
                                        'id': note_detail.get('id'),
                                        'title': note_card.get('title'),
                                        'desc': note_card.get('desc'),
                                        'user': note_card.get('user'),
                                        'image_urls': image_urls,
                                        'interact_info': note_card.get('interact_info'),
                                        'tag_list': note_card.get('tag_list'),
                                    }
                                }
                                
                                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                                output_file = f"audi_q5l_test_{timestamp}.json"
                                
                                with open(output_file, 'w', encoding='utf-8') as f:
                                    json.dump(output_data, f, ensure_ascii=False, indent=2)
                                
                                print(f"\n✅ 数据已保存到：{output_file}")
                                return True
                        else:
                            print(f"❌ 详情获取失败：{detail_response.text[:200]}")
            else:
                print("❌ 未搜索到笔记")
        else:
            print(f"❌ 请求失败：{response.text[:200]}")
            
    except Exception as e:
        print(f"❌ 异常：{e}")
        import traceback
        traceback.print_exc()
    
    return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
