#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书单请求测试工具
- 严格对齐请求头（User-Agent 与 Cookie 一致）
- 强制随机休眠 1-10 秒
- 单次请求后立即退出
"""

import json
import sys
import time
import random
from xhs import XhsClient
from xhs.help import sign as original_sign

# 完整 Cookie（从最新抓包获取 - 2026-06-28）
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782614742088; websectiga=984412fef754c018e472127b8effd174be8a5d51061c991aadd200c69a2801d6; sec_poison_id=9f4b3797-1b6f-4eee-b833-1c875a4398e3; acw_tc=0ad5802f17826147427347699e2ec1f4e207b6eaa777e0114e760754187049; web_session=040069b6d9aed466dced8fc275384b3e1b53d2; id_token=VjEAAFgCoRqytC1W+thmV8rO3XCgts5ts8LaCV6AbFn5kSgHltj6weieiRes/S8fWLEyXIaB/2zQFTeuUP5fIEW/1JS7bZdt5b+YKL2lDceudrvqpHv2nEtTVQgpUhS2Lt7xoEVl; unread={%22ub%22:%226a3f90d0000000001c0275d8%22%2C%22ue%22:%226a323726000000002201a24a%22%2C%22uc%22:32}"

# User-Agent（与 Cookie 中的浏览器环境一致 - Chrome 149）
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

def sign_wrapper(uri, data=None, **kwargs):
    """包装签名函数，兼容库的调用"""
    return original_sign(uri, data)

def main():
    """单次请求测试"""
    print("=" * 80)
    print("🔍 小红书单请求测试（严格对齐请求头 + 随机休眠）")
    print("=" * 80)
    print()
    
    # 解析命令行参数
    keyword = sys.argv[1] if len(sys.argv) > 1 else "奥迪 Q5L"
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    print(f"📝 搜索关键词：{keyword}")
    print(f"📊 最大结果数：{max_results}")
    print()
    
    # 强制随机休眠 1-10 秒
    sleep_time = random.uniform(1, 10)
    print(f"⏰ 随机休眠：{sleep_time:.2f} 秒")
    time.sleep(sleep_time)
    print("✅ 休眠完成，开始请求")
    print()
    
    try:
        # 显示请求头信息
        print("📋 请求头信息：")
        print(f"   User-Agent: {USER_AGENT}")
        print()
        
        # 初始化客户端（带自定义 User-Agent）
        print("🔄 初始化 XhsClient...")
        client = XhsClient(
            cookie=COOKIE, 
            sign=sign_wrapper,
            user_agent=USER_AGENT
        )
        print("✅ 客户端初始化成功")
        print()
        
        # 执行单次请求
        print(f"🚀 发送请求：get_note_by_keyword('{keyword}')")
        print("-" * 80)
        
        start_time = time.time()
        result = client.get_note_by_keyword(
            keyword=keyword,
            page=1,
            page_size=min(max_results, 20)
        )
        elapsed = time.time() - start_time
        
        print(f"⏱️  请求耗时：{elapsed:.2f}秒")
        print()
        
        if not result:
            print("❌ 错误：返回空结果")
            return False
        
        # 解析结果
        if isinstance(result, list):
            items = result
        elif isinstance(result, dict):
            items = result.get('items', []) or result.get('data', {}).get('items', [])
        else:
            items = [result]
        
        if not items:
            print("❌ 错误：没有结果")
            return False
        
        print(f"✅ 请求成功！返回 {len(items)} 条结果\n")
        
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
        
        # 返回原始数据（用于调试）
        print("-" * 80)
        print("📦 原始响应数据（前 500 字符）：")
        print(json.dumps(result, ensure_ascii=False, indent=2)[:500])
        print("...")
        print()
        
        return True
        
    except Exception as e:
        print(f"❌ 错误：{str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始测试")
    print()
    
    success = main()
    
    print("=" * 80)
    if success:
        print("✅ 测试成功！")
        print("📋 总结：")
        print("   - 请求头已严格对齐（User-Agent 与 Cookie 一致）")
        print("   - 已执行随机休眠（1-10 秒）")
        print("   - 单次请求完成，进程即将退出")
    else:
        print("❌ 测试失败")
    print("=" * 80)
    
    # 退出前再次休眠
    print()
    print("⏰ 退出前休眠 2 秒...")
    time.sleep(2)
    print("👋 再见")
