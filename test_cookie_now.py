#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
立即测试 Cookie 有效性
使用你刚刚提供的 Cookie
"""

import json
from xhs import XhsClient
from xhs.help import sign as original_sign

# 你刚刚提供的 Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; web_session=040069b3d8514b3c0ec4787c75384b6a52752f; id_token=VjEAANKkmLp4JjFuteqI224jrBo3OEgYUoSjyEhS5G+vi6wjpPC3CK0QApeTOL2Y+x5A0C98+i41n5WcqELcKpbisksa9KhlNqKs0cSpDhkGDWBM91yqKagVFPEi4hm+TxnrrVoN; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782594354562; acw_tc=0a0bb30417825943549042649e78252c93098effb8f84af6ce75fc502e4737; websectiga=16f444b9ff5e3d7e258b5f7674489196303a0b160e16647c6c2b4dcb609f4134; sec_poison_id=e9f41ae4-8f01-45fa-94d9-9251e73aed30; unread={%22ub%22:%226a3e1625000000000f01d8dc%22%2C%22ue%22:%226a3f42f0000000001702f3af%22%2C%22uc%22:25}";

# 创建兼容包装函数
def sign_wrapper(uri, data=None, **kwargs):
    """包装 xhs.help.sign 函数以兼容库的调用方式"""
    # 忽略不需要的参数（如 web_session）
    return original_sign(uri, data)

def test_search():
    """测试搜索功能"""
    print("=" * 60)
    print("🔍 开始测试小红书搜索")
    print("=" * 60)
    print()
    
    try:
        # 初始化客户端（带包装的签名函数）
        print("正在初始化客户端（带签名包装函数）...")
        client = XhsClient(cookie=COOKIE, sign=sign_wrapper)
        print("✅ 客户端初始化成功")
        print()
        
        # 测试搜索 - 使用 get_note_by_keyword
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
        
        # result 可能是列表或字典
        if isinstance(result, list):
            items = result
        elif isinstance(result, dict):
            items = result.get('items', []) or result.get('data', {}).get('items', [])
        else:
            items = [result]
        
        if not items:
            print("❌ 搜索失败：没有结果")
            print(f"响应内容：{json.dumps(result, ensure_ascii=False, indent=2)[:500]}")
            return False
        
        print(f"✅ 搜索成功！找到 {len(items)} 条结果\n")
        
        # 显示前 5 条结果
        for idx, item in enumerate(items[:5], 1):
            try:
                # 尝试提取信息
                note_data = item.get('note_card', {}) or item.get('model', {}) or item
                
                note_id = item.get('id', '') or item.get('note_id', '') or note_data.get('id', '')
                title = note_data.get('display_title', '') or note_data.get('title', '') or '无标题'
                desc = note_data.get('desc', '') or note_data.get('description', '') or ''
                
                user = note_data.get('user', {}) or {}
                nickname = user.get('nickname', '') or '未知用户'
                
                interact_info = note_data.get('interact_info', {}) or {}
                likes = interact_info.get('liked_count', 0)
                collects = interact_info.get('collected_count', 0)
                comments = interact_info.get('comment_count', 0)
                
                # 截断描述
                if len(desc) > 80:
                    desc = desc[:80] + "..."
                
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
        print("✅ Cookie 有效！可以配置到系统中使用")
        print()
        print("下一步：")
        print("1. 运行数据库迁移（如果还没运行）")
        print("2. 重启服务")
        print("3. 在 Web 界���配置 Cookie")
        print("4. 开始使用小红书搜索功能")
    else:
        print("❌ 测试失败")
    print("=" * 60)
