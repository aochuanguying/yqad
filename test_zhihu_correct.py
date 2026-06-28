#!/usr/bin/env python3
"""
测试知乎 API - 正确方法
使用 Access Secret + X-Request-Timestamp
"""

import requests
import time

# 知乎 Access Secret（用户提供）
ZHIHU_ACCESS_SECRET = "11d78a6c28453c03f047552bc588d03ad227db52"

def test_zhihu_search():
    """测试知乎搜索 API"""
    print("=" * 60)
    print("开始测试知乎 API 搜索功能（正确方法）")
    print("=" * 60)
    
    try:
        # 知乎搜索 API 端点
        url = "https://developer.zhihu.com/api/v1/content/zhihu_search"
        
        # 当前时间戳（秒级）
        timestamp = int(time.time())
        
        # 请求头
        headers = {
            'Authorization': f'Bearer {ZHIHU_ACCESS_SECRET}',
            'X-Request-Timestamp': str(timestamp),
            'Content-Type': 'application/json'
        }
        
        # 搜索参数（注意：参数名是 Query 和 Count，Count 最大为 10）
        params = {
            'Query': '奥迪 Q5L',
            'Count': 10
        }
        
        print(f"\n正在搜索：奥迪 Q5L")
        print(f"API 端点：{url}")
        print(f"时间戳：{timestamp}")
        print(f"请求头：Authorization: Bearer {ZHIHU_ACCESS_SECRET[:20]}...")
        
        response = requests.get(url, params=params, headers=headers, timeout=30)
        
        print(f"\nHTTP 状态码：{response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 搜索成功！")
            
            # 解析结果（根据官方 API 响应格式）
            code = data.get('Code', -1)
            message = data.get('Message', '')
            
            if code != 0:
                print(f"❌ API 返回错误：Code={code}, Message={message}")
                return
            
            search_data = data.get('Data', {})
            results = search_data.get('Items', [])
            empty_reason = search_data.get('EmptyReason', '')
            
            print(f"Code: {code}, Message: {message}")
            print(f"找到 {len(results)} 条结果\n")
            
            if not results and empty_reason:
                print(f"无结果原因：{empty_reason}")
            
            print("=" * 60)
            
            # 显示前 5 条
            for i, item in enumerate(results[:5], 1):
                print(f"\n【结果 {i}】")
                
                # 基本信息
                print(f"标题：{item.get('Title', '无标题')}")
                print(f"类型：{item.get('ContentType', 'Unknown')}")
                print(f"作者：{item.get('AuthorName', '未知')}")
                
                # 作者认证信息
                badge_text = item.get('AuthorBadgeText', '')
                if badge_text:
                    print(f"认证：{badge_text}")
                
                # 内容摘要
                content_text = item.get('ContentText', '')
                if content_text:
                    print(f"摘要：{content_text[:100]}...")
                
                # 统计数据
                print(f"赞同：{item.get('VoteUpCount', 0)}")
                print(f"评论：{item.get('CommentCount', 0)}")
                
                # 权威等级和排序
                authority = item.get('AuthorityLevel', '')
                score = item.get('RankingScore', 0)
                print(f"权威等级：{authority}, 排序分：{score:.2f}")
                
                # URL
                url = item.get('Url', '')
                print(f"链接：{url}")
                
                print("-" * 60)
            
            print("\n✓ 测试完成！")
            print("=" * 60)
            
        elif response.status_code == 401:
            print("❌ 认证失败：401 Unauthorized")
            print(f"响应内容：{response.text[:200]}")
            print("\n可能原因：")
            print("1. Access Secret 无效或已过期")
            print("2. X-Request-Timestamp 时间戳偏差太大")
            print("3. 需要联系知乎开放平台激活账号")
        else:
            print(f"❌ 搜索失败：{response.status_code}")
            print(f"响应内容：{response.text[:200]}")
        
    except Exception as e:
        print(f"\n❌ 测试失败：{str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_zhihu_search()
