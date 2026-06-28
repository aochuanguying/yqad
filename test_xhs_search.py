#!/usr/bin/env python3
"""
测试小红书搜索功能
使用 xhs 库进行关键词搜索
"""

from xhs import XhsClient

# 小红书 Cookie（从浏览器获取）
XHS_COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=933d24c3-77e3-4eb8-8338-a206f5ae659a; acw_tc=0ad59cfe17825925121414501e7fa0e0fd966e4eb3c98dccc9d9fef57c8dfa; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; web_session=040069b3d8514b3c0ec4787c75384b6a52752f; id_token=VjEAANKkmLp4JjFuteqI224jrBo3OEgYUoSjyEhS5G+vi6wjpPC3CK0QApeTOL2Y+x5A0C98+i41n5WcqELcKpbisksa9KhlNqKs0cSpDhkGDWBM91yqKagVFPEi4hm+TxnrrVoN; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782592689261; unread={%22ub%22:%226a1d42ac0000000007024ffb%22%2C%22ue%22:%226a3f6a0a0000000006020f64%22%2C%22uc%22:33}"

def test_search():
    """测试搜索功能"""
    print("=" * 60)
    print("开始测试小红书搜索功能")
    print("=" * 60)
    
    try:
        # 初始化客户端
        print("\n正在初始化客户端...")
        client = XhsClient(cookie=XHS_COOKIE)
        print("✓ 客户端初始化成功")
        
        # 测试搜索
        keywords = "奥迪 Q5L"
        print(f"\n正在搜索关键词：{keywords}")
        # 使用 get_note_by_keyword 方法搜索
        search_results = client.get_note_by_keyword(keyword=keywords, page=1, page_size=10)
        
        if not search_results:
            print("❌ 搜索结果为空")
            return
        
        print(f"✓ 搜索成功，找到 {len(search_results)} 条结果\n")
        print("=" * 60)
        
        # 显示前 5 条结果
        for i, note in enumerate(search_results[:5], 1):
            print(f"\n【结果 {i}】")
            print(f"标题：{note.get('title', '无标题')}")
            print(f"作者：{note.get('user', {}).get('nickname', '未知')}")
            print(f"点赞：{note.get('likes', 0)}")
            print(f"收藏：{note.get('collected', 0)}")
            print(f"评论：{note.get('comments', 0)}")
            
            # 显示内容摘要
            desc = note.get('desc', '')
            if desc:
                print(f"内容摘要：{desc[:100]}{'...' if len(desc) > 100 else ''}")
            
            # 显示图片
            images = note.get('image_list', [])
            if images:
                print(f"图片数：{len(images)}")
                print(f"封面图：{images[0].get('url', '')}")
            
            print("-" * 60)
        
        print("\n✓ 测试完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试失败：{str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_search()
