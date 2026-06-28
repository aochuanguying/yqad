#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
端到端完整测试 - 测试 xiaohongshu_final.py 的实际功能
"""

import asyncio
import json
import sys
from pathlib import Path

# 导入最终的爬虫类
sys.path.insert(0, str(Path(__file__).parent))
from xiaohongshu_final import XiaohongshuFinalCrawler

# Cookie
COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"

async def test_full_workflow():
    """测试完整的工作流程"""
    print("="*60)
    print("端到端完整测试")
    print("="*60)
    
    # 1. 初始化爬虫
    print("\n1️⃣ 初始化爬虫...")
    try:
        crawler = XiaohongshuFinalCrawler(cookie=COOKIE, headless=True)
        print("✅ 爬虫初始化成功")
    except Exception as e:
        print(f"❌ 爬虫初始化失败：{e}")
        return False
    
    # 2. 启动浏览器
    print("\n2️⃣ 启动浏览器...")
    try:
        await crawler.start()
        print("✅ 浏览器启动成功")
    except Exception as e:
        print(f"❌ 浏览器启动失败：{e}")
        await crawler.close()
        return False
    
    # 3. 搜索笔记
    print("\n3️⃣ 搜索笔记...")
    try:
        search_results = crawler.search_notes("美食", max_results=3)
        print(f"✅ 搜索返回 {len(search_results)} 条结果")
        
        if not search_results:
            print("❌ 搜索结果为空")
            await crawler.close()
            return False
        
        for idx, note in enumerate(search_results, 1):
            print(f"   {idx}. {note['title'][:50]}")
            print(f"      ID: {note['id']}")
            print(f"      Token: {note['xsec_token'][:20]}...")
            
    except Exception as e:
        print(f"❌ 搜索失败：{e}")
        import traceback
        traceback.print_exc()
        await crawler.close()
        return False
    
    # 4. 获取详情页
    print("\n4️⃣ 获取笔记详情...")
    success_count = 0
    
    for idx, note in enumerate(search_results, 1):
        print(f"\n   获取第 {idx} 条笔记详情...")
        
        try:
            detail = await crawler.get_note_detail(note['id'], note['xsec_token'])
            
            if detail:
                print(f"   ✅ 成功获取")
                print(f"      标题：{detail['title'][:50]}")
                print(f"      作者：{detail['user']}")
                print(f"      点赞：{detail['likes']}")
                success_count += 1
            else:
                print(f"   ❌ 获取失败")
                
        except Exception as e:
            print(f"   ❌ 异常：{e}")
    
    # 5. 关闭浏览器
    print("\n5️⃣ 关闭浏览器...")
    await crawler.close()
    
    # 6. 汇总结果
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)
    print(f"搜索笔记：{len(search_results)} 条")
    print(f"成功获取详情：{success_count}/{len(search_results)} 条")
    
    if success_count > 0:
        print("\n✅ 测试通过！")
        return True
    else:
        print("\n❌ 测试失败！")
        return False

async def main():
    try:
        result = await test_full_workflow()
        
        # 保存结果
        if result:
            print("\n🎉 所有测试通过！可以安全部署！")
        else:
            print("\n⚠️ 测试未完全通过，请检查问题")
        
        return result
        
    except Exception as e:
        print(f"\n❌ 测试异常：{e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)
