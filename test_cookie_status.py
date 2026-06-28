#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查 Cookie 状态
提取关键字段并检查是否过期
"""

import re

COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782594354562; acw_tc=0a0bb30417825943549042649e78252c93098effb8f84af6ce75fc502e4737; websectiga=16f444b9ff5e3d7e258b5f7674489196303a0b160e16647c6c2b4dcb609f4134; sec_poison_id=925db07b-f14b-459b-bb7f-aa25466b9438; web_session=040069b3d8514b3c0ec4ec7475384b57ed8fe4; id_token=VjEAAL+YeRFymzHLysrsj46Tcxfw73n3MWSpl9Z6FQfeRfV14xJXxEN34v9MyG52XnhNhDCI59srKudZ6PXsXcro3mDKyEB0nUSjEpMWHC5wEIdl8AFEDZ+7PV43RBtLjtjoFRXu; unread={%22ub%22:%226a3fe8a4000000002201bb92%22%2C%22ue%22:%226a3f403f0000000011019d57%22%2C%22uc%22:33}"

def extract_cookie_value(cookie_str, key):
    """提取 Cookie 中某个字段的值"""
    pattern = rf"{key}=([^;]+)"
    match = re.search(pattern, cookie_str)
    return match.group(1) if match else None

print("=" * 80)
print("📋 Cookie 关键字段检查")
print("=" * 80)
print()

# 提取关键字段
web_session = extract_cookie_value(COOKIE, "web_session")
a1 = extract_cookie_value(COOKIE, "a1")
id_token = extract_cookie_value(COOKIE, "id_token")
loadts = extract_cookie_value(COOKIE, "loadts")
ets = extract_cookie_value(COOKIE, "ets")

print("✅ 提取到的关键字段：")
print(f"   web_session: {web_session}")
print(f"   a1: {a1}")
print(f"   id_token: {id_token[:50]}..." if id_token else "   id_token: None")
print(f"   loadts: {loadts}")
print(f"   ets: {ets}")
print()

# 检查时间戳
import datetime

if loadts:
    loadts_time = datetime.datetime.fromtimestamp(int(loadts) / 1000)
    now = datetime.datetime.now()
    age = now - loadts_time
    print(f"📅 loadts 时间戳：{loadts_time}")
    print(f"   距离现在：{age}")
    print()

if ets:
    ets_time = datetime.datetime.fromtimestamp(int(ets) / 1000)
    print(f"📅 ets 时间戳：{ets_time}")
    print()

# 分析
print("=" * 80)
print("🔍 状态分析：")
print("=" * 80)

if not web_session:
    print("❌ web_session 缺失 - 这是关键字段，需要重新获取")
elif len(web_session) < 10:
    print(f"❌ web_session 过短 ({len(web_session)} 字符) - 可能已失效")
else:
    print(f"✅ web_session 存在 ({len(web_session)} 字符)")

if not a1:
    print("❌ a1 缺失 - 这是设备标识符")
else:
    print(f"✅ a1 存在 ({len(a1)} 字符)")

if not id_token:
    print("❌ id_token 缺失 - 这是登录凭证，必须重新获取")
elif len(id_token) < 50:
    print(f"❌ id_token 过短 ({len(id_token)} 字符) - 已过期")
else:
    print(f"✅ id_token 存在 ({len(id_token)} 字符)")

print()
print("=" * 80)
print("💡 建议：")
print("=" * 80)
print("错误码 -100 表示 '登录已过期'，说明 Cookie 中的 id_token 或 web_session 已失效。")
print()
print("解决方案：")
print("1. 打开小红书官网 (www.xiaohongshu.com)")
print("2. 登录账号")
print("3. 打开浏览器开发者工具 (F12)")
print("4. 刷新页面，找到任意请求")
print("5. 复制最新的 Cookie（包含 web_session 和 id_token）")
print()
print("或者：")
print("等待 48 小时后重试（如果是因为风控导致的临时失效）")
print("=" * 80)
