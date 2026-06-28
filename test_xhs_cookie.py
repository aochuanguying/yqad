#!/usr/bin/env python3
"""
测试小红书 Cookie 是否有效
"""

from xhs import XhsClient

# 小红书 Cookie（从浏览器获取）
XHS_COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=933d24c3-77e3-4eb8-8338-a206f5ae659a; acw_tc=0ad59cfe17825925121414501e7fa0e0fd966e4eb3c98dccc9d9fef57c8dfa; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; web_session=040069b3d8514b3c0ec4787c75384b6a52752f; id_token=VjEAANKkmLp4JjFuteqI224jrBo3OEgYUoSjyEhS5G+vi6wjpPC3CK0QApeTOL2Y+x5A0C98+i41n5WcqELcKpbisksa9KhlNqKs0cSpDhkGDWBM91yqKagVFPEi4hm+TxnrrVoN; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782592689261; unread={%22ub%22:%226a1d42ac0000000007024ffb%22%2C%22ue%22:%226a3f6a0a0000000006020f64%22%2C%22uc%22:33}"

def test_cookie():
    """测试 Cookie 是否有效"""
    print("=" * 60)
    print("开始测试小红书 Cookie")
    print("=" * 60)
    
    try:
        # 初始化客户端
        print("\n正在初始化客户端...")
        client = XhsClient(cookie=XHS_COOKIE)
        print("✓ 客户端初始化成功")
        
        # 获取自己的信息
        print("\n正在获取用户信息...")
        user_info = client.get_self_info()
        
        if user_info:
            print("✓ Cookie 有效！")
            print(f"\n用户信息:")
            print(f"  昵称：{user_info.get('nickname', '未知')}")
            print(f"  用户 ID: {user_info.get('red_id', '未知')}")
            print(f"  头像：{user_info.get('image', '')[:50]}...")
        else:
            print("❌ Cookie 可能已失效")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试失败：{str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_cookie()
