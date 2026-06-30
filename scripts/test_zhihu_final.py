"""最终测试：知乎内容提取（带图片）"""
import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def main():
    print("=" * 60)
    print("测试知乎内容提取功能（Playwright + Cookie）")
    print("=" * 60)
    
    # 测试 URL 列表
    test_urls = [
        "https://zhuanlan.zhihu.com/p/2031378767277504021",  # 奥迪 Q5L 华为智驾
    ]
    
    # 导入 Python 脚本中的函数
    from test_zhihu_content import fetch_post_content_with_retry
    
    for url in test_urls:
        print(f"\n📝 测试 URL: {url}")
        print("-" * 60)
        
        title, content, images = await fetch_post_content_with_retry(url, max_retries=2)
        
        print(f"\n✅ 提取成功!")
        print(f"📄 标题：{title[:50]}..." if len(title) > 50 else f"📄 标题：{title}")
        print(f"📝 内容长度：{len(content)} 字符")
        print(f"🖼️  图片数量：{len(images)} 张")
        
        if images:
            print("\n图片列表:")
            for i, img in enumerate(images[:5], 1):
                print(f"  {i}. {img}")
        
        print("\n内容预览:")
        print(content[:300] + "..." if len(content) > 300 else content)
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
