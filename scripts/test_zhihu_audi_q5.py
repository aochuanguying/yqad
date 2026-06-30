"""测试：搜索奥迪 Q5L 并获取帖子详情（包括图片）"""
import asyncio
import sys
import os
import json
from datetime import datetime

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def main():
    print("=" * 80)
    print("测试知乎搜索：奥迪 Q5L")
    print("=" * 80)
    
    # 步骤 1: 搜索知乎内容
    print("\n🔍 步骤 1: 搜索知乎内容...")
    from test_zhihu_content import search_zhihu
    
    # 使用测试用的 Access Secret（实际应该从数据库读取）
    access_secret = "test"  # 这里用 test，实际应该用真实的 Access Secret
    keyword = "奥迪 Q5L"
    
    search_results = search_zhihu(access_secret, keyword, limit=10)
    
    if not search_results or 'data' not in search_results or not search_results['data']:
        print("❌ 搜索失败，使用备用 URL 列表")
        # 备用的知乎 URL 列表
        test_urls = [
            "https://zhuanlan.zhihu.com/p/2031378767277504021",
        ]
    else:
        # 从搜索结果中提取 URL
        test_urls = []
        for item in search_results['data'][:3]:  # 取前 3 个结果
            if 'Url' in item:
                test_urls.append(item['Url'])
                print(f"  找到 URL: {item['Url']}")
        
        if not test_urls:
            print("⚠️ 未找到可用 URL，使用备用 URL")
            test_urls = ["https://zhuanlan.zhihu.com/p/2031378767277504021"]
    
    # 步骤 2: 获取第一篇帖子的详情
    print(f"\n📝 步骤 2: 获取第一篇帖子详情...")
    from test_zhihu_content import fetch_post_content_with_retry
    
    target_url = test_urls[0]
    print(f"目标 URL: {target_url}")
    print("-" * 80)
    
    title, content, images = await fetch_post_content_with_retry(target_url, max_retries=2)
    
    # 步骤 3: 输出到文件
    print("\n💾 步骤 3: 保存结果到文件...")
    
    # 创建输出目录
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()[:50]
    safe_title = safe_title.replace(' ', '_')
    
    # 保存文本内容
    text_file = os.path.join(output_dir, f"{timestamp}_{safe_title}.txt")
    with open(text_file, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("知乎帖子详情 - 奥迪 Q5L\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"标题：{title}\n")
        f.write(f"URL: {target_url}\n")
        f.write(f"提取时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"内容长度：{len(content)} 字符\n")
        f.write(f"图片数量：{len(images)} 张\n")
        f.write("\n" + "=" * 80 + "\n\n")
        f.write("【正文内容】\n\n")
        f.write(content)
        f.write("\n\n" + "=" * 80 + "\n\n")
        f.write("【图片列表】\n\n")
        for i, img in enumerate(images, 1):
            f.write(f"{i}. {img}\n")
    
    print(f"✅ 文本内容已保存到：{text_file}")
    
    # 保存图片
    if images:
        print(f"\n🖼️  正在下载 {len(images)} 张图片...")
        import requests
        
        img_dir = os.path.join(output_dir, f"{timestamp}_{safe_title}_images")
        os.makedirs(img_dir, exist_ok=True)
        
        for i, img_url in enumerate(images, 1):
            try:
                print(f"  下载图片 {i}/{len(images)}: {img_url}")
                response = requests.get(img_url, timeout=10)
                if response.status_code == 200:
                    # 从 URL 提取文件名
                    img_name = img_url.split('/')[-1]
                    img_path = os.path.join(img_dir, f"{i:02d}_{img_name}")
                    with open(img_path, 'wb') as f:
                        f.write(response.content)
                    print(f"    ✅ 保存成功：{img_path}")
                else:
                    print(f"    ❌ 下载失败：HTTP {response.status_code}")
            except Exception as e:
                print(f"    ❌ 下载失败：{e}")
        
        print(f"\n✅ 图片已保存到：{img_dir}")
    
    # 步骤 4: 显示摘要
    print("\n" + "=" * 80)
    print("📊 结果摘要")
    print("=" * 80)
    print(f"标题：{title[:60]}..." if len(title) > 60 else f"标题：{title}")
    print(f"内容长度：{len(content)} 字符")
    print(f"图片数量：{len(images)} 张")
    print(f"输出文件：{text_file}")
    if images:
        print(f"图片目录：{img_dir}")
    print("=" * 80)
    
    # 显示内容预览
    print("\n📖 内容预览（前 500 字符）:")
    print("-" * 80)
    print(content[:500] + "..." if len(content) > 500 else content)
    print("-" * 80)

if __name__ == "__main__":
    asyncio.run(main())
