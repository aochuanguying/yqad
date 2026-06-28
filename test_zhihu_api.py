#!/usr/bin/env python3
"""
测试知乎 API
使用官方 API Token
"""

import requests

# 知乎 API Token（用户提供）
ZHIHU_API_TOKEN = "11d78a6c28453c03f047552bc588d03ad227db52"

def test_zhihu_search():
    """测试知乎搜索 API"""
    print("=" * 60)
    print("开始测试知乎 API 搜索功能")
    print("=" * 60)
    
    try:
        # 知乎搜索 API 端点
        url = "https://api.zhihu.com/search/answer"
        
        # 搜索参数
        params = {
            'q': '奥迪 Q5L',
            'offset': 0,
            'limit': 10,
            'filter': ''
        }
        
        # 请求头
        headers = {
            'Authorization': f'Bearer {ZHIHU_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        print(f"\n正在搜索：奥迪 Q5L")
        print(f"API 端点：{url}")
        
        response = requests.get(url, params=params, headers=headers, timeout=30)
        
        print(f"HTTP 状态码：{response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 搜索成功！")
            
            # 解析结果
            answers = data.get('data', [])
            print(f"找到 {len(answers)} 条结果\n")
            print("=" * 60)
            
            # 显示前 5 条
            for i, answer in enumerate(answers[:5], 1):
                print(f"\n【结果 {i}】")
                
                # 答案信息
                target = answer.get('target', {})
                print(f"标题：{target.get('title', '无标题')}")
                
                # 作者信息
                author = target.get('author', {})
                print(f"作者：{author.get('name', '未知')}")
                
                # 内容摘要
                excerpt = target.get('excerpt', '')
                if excerpt:
                    # 去除 HTML 标签
                    import re
                    excerpt = re.sub(r'<[^>]+>', '', excerpt)
                    print(f"摘要：{excerpt[:100]}...")
                
                # 统计数据
                print(f"赞同数：{target.get('voteup_count', 0)}")
                print(f"评论数：{target.get('comment_count', 0)}")
                
                # URL
                print(f"链接：{target.get('url', '')}")
                
                print("-" * 60)
            
            print("\n✓ 测试完成！")
            print("=" * 60)
        else:
            print(f"❌ 搜索失败：{response.status_code}")
            print(f"响应内容：{response.text[:200]}")
        
    except Exception as e:
        print(f"\n❌ 测试失败：{str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_zhihu_search()
