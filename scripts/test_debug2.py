#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from xhs import XhsClient
from xhs.help import sign

cookie = 'abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e'

try:
    # 使用 sign 函数作为外部签名
    client = XhsClient(cookie=cookie, sign=sign)
    print("✅ XhsClient 初始化成功")
    
    # 测试搜索
    result = client.get_note_by_keyword(
        keyword="汽车评测",
        page=1,
        page_size=5
    )
    
    print(f"✅ 搜索成功！返回结果类型：{type(result)}")
    print(f"\n搜索结果:")
    print("-" * 60)
    
    items = result.get('items', [])
    for i, item in enumerate(items, 1):
        note_id = item.get('id', '')
        title = item.get('title', '') or '无标题'
        user = item.get('user', {}).get('nickname', '未知用户')
        liked = item.get('interact_info', {}).get('liked_count', 0)
        
        print(f"[{i}] {title}")
        print(f"    作者：{user}")
        print(f"    点赞：{liked}")
        print(f"    ID: {note_id}")
        print(f"    链接：https://www.xiaohongshu.com/explore/{note_id}\n")
    
    # 测试获取详情
    if items:
        first_note_id = items[0].get('id', '')
        print(f"\n{'='*60}")
        print(f"测试获取笔记详情：{first_note_id}")
        print(f"{'='*60}\n")
        
        note_detail = client.get_note_by_id(first_note_id)
        
        if note_detail:
            print("✅ 笔记详情获取成功！")
            print(f"\n标题：{note_detail.get('title', 'N/A')}")
            print(f"作者：{note_detail.get('user', {}).get('nickname', 'N/A')}")
            print(f"描述：{note_detail.get('desc', 'N/A')[:100]}...")
            print(f"点赞：{note_detail.get('interact_info', {}).get('liked_count', 'N/A')}")
            print(f"收藏：{note_detail.get('interact_info', {}).get('collected_count', 'N/A')}")
            print(f"评论：{note_detail.get('interact_info', {}).get('comment_count', 'N/A')}")
        else:
            print("❌ 获取笔记详情失败")
    
except Exception as e:
    print(f"❌ 错误：{str(e)}")
    import traceback
    traceback.print_exc()
