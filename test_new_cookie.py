#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试新提供的 Cookie
"""

import json
from xhs import XhsClient
from xhs.help import sign as original_sign

# 新提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782594354562; acw_tc=0a0bb30417825943549042649e78252c93098effb8f84af6ce75fc502e4737; websectiga=16f444b9ff5e3d7e258b5f7674489196303a0b160e16647c6c2b4dcb609f4134; sec_poison_id=925db07b-f14b-459b-bb7f-aa25466b9438; web_session=040069b3d8514b3c0ec4ec7475384b57ed8fe4; id_token=VjEAAL+YeRFymzHLysrsj46Tcxfw73n3MWSpl9Z6FQfeRfV14xJXxEN34v9MyG52XnhNhDCI59srKudZ6PXsXcro3mDKyEB0nUSjEpMWHC5wEIdl8AFEDZ+7PV43RBtLjtjoFRXu; unread={%22ub%22:%226a3fe8a4000000002201bb92%22%2C%22ue%22:%226a3f403f0000000011019d57%22%2C%22uc%22:33}";

# 创建兼容包装函数
def sign_wrapper(uri, data=None, **kwargs):
    """包装 xhs.help.sign 函数以兼容库的调用方式"""
    return original_sign(uri, data)

def test_search():
    """测试搜索功能"""
    print("=" * 60)
    print("🔍 开始测试新 Cookie")
    print("=" * 60)
    print()
    
    try:
        print("正在初始化客户端...")
        client = XhsClient(cookie=COOKIE, sign=sign_wrapper)
        print("✅ 客户端初始化成功")
        print()
        
        print("正在搜索：奥迪 Q5L")
        print("-" * 60)
        
        result = client.get_note_by_keyword(
            keyword="奥迪 Q5L",
            page=1,
            page_size=10
        )
        
        if not result:
            print("❌ 搜索失败：返回空结果")
            return False
        
        # 处理结果
        if isinstance(result, list):
            items = result
        elif isinstance(result, dict):
            items = result.get('items', []) or result.get('data', {}).get('items', [])
        else:
            items = [result]
        
        if not items:
            print("❌ 搜索失败：没有结果")
            return False
        
        print(f"✅ 搜索成功！找到 {len(items)} 条结果\n")
        
        # 显示前 3 条结果
        for idx, item in enumerate(items[:3], 1):
            try:
                note_data = item.get('note_card', {}) or item.get('model', {}) or item
                
                note_id = item.get('id', '') or item.get('note_id', '') or note_data.get('id', '')
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
                if note_id:
                    print(f"   链接：https://www.xiaohongshu.com/explore/{note_id}")
                print()
            except Exception as e:
                print(f"第 {idx} 条结果解析失败：{e}")
                print()
        
        return True
        
    except Exception as e:
        print(f"❌ 错误：{str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_search()
    
    print("=" * 60)
    if success:
        print("✅ Cookie 有效！可以配置到系统中")
    else:
        print("❌ Cookie 无效或账号受限")
    print("=" * 60)
