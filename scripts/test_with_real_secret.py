"""使用生产数据库的真实 Access Secret 测试知乎搜索"""
import sys
import os
import asyncio

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_prod_db_config():
    """获取生产数据库配置"""
    return {
        'host': os.getenv('PROD_MYSQL_HOST', '192.168.50.50'),
        'user': os.getenv('PROD_MYSQL_USER', 'root'),
        'password': os.getenv('PROD_MYSQL_PASSWORD', ''),
        'database': os.getenv('PROD_MYSQL_DATABASE', 'yqad_prod_db'),
        'charset': 'utf8mb4'
    }

def read_zhihu_secret_from_prod():
    """从生产数据库读取知乎 Access Secret"""
    try:
        import pymysql
        
        prod_config = get_prod_db_config()
        print(f"🔗 连接生产数据库：{prod_config['host']}/{prod_config['database']}")
        
        conn = pymysql.connect(**prod_config)
        with conn.cursor() as cursor:
            sql = "SELECT zhihu_access_secret, zhihu_enabled FROM network_post_config LIMIT 1"
            cursor.execute(sql)
            result = cursor.fetchone()
            
            if result:
                access_secret = result[0]
                is_enabled = result[1]
                
                print(f"✅ 读取成功:")
                print(f"   - Access Secret: {access_secret[:30]}..." if len(access_secret) > 30 else f"   - Access Secret: {access_secret}")
                print(f"   - 启用状态：{'是' if is_enabled else '否'}")
                
                return access_secret if access_secret else None
            else:
                print("❌ 生产数据库中没有配置记录")
                return None
                
    except Exception as e:
        print(f"❌ 读取失败：{e}")
        return None
    finally:
        if 'conn' in locals():
            conn.close()

async def test_zhihu_search_with_secret(access_secret):
    """使用真实的 Access Secret 测试知乎搜索"""
    print("\n" + "=" * 80)
    print("测试知乎 API 搜索（使用真实 Access Secret）")
    print("=" * 80)
    
    # 步骤 1: 搜索
    print("\n🔍 步骤 1: 搜索关键词 '奥迪 Q5L'...")
    from test_zhihu_content import search_zhihu
    
    search_results = search_zhihu(access_secret, "奥迪 Q5L", limit=5)
    
    if not search_results or 'data' not in search_results or not search_results['data']:
        print("❌ API 搜索失败")
        if search_results:
            print(f"   返回结果：{search_results}")
        return
    
    print(f"✅ 搜索成功，找到 {len(search_results['data'])} 条结果")
    
    # 显示搜索结果
    for i, item in enumerate(search_results['data'][:3], 1):
        title = item.get('Title', '无标题')
        url = item.get('Url', '')
        excerpt = item.get('Excerpt', '')[:50]
        
        print(f"\n  {i}. {title}")
        print(f"     URL: {url}")
        print(f"     摘要：{excerpt}...")
    
    # 步骤 2: 获取第一篇帖子详情
    if search_results['data']:
        first_url = search_results['data'][0].get('Url')
        if first_url:
            print(f"\n📝 步骤 2: 获取第一篇帖子详情...")
            print(f"目标 URL: {first_url}")
            print("-" * 80)
            
            from test_zhihu_content import fetch_post_content_with_retry
            
            title, content, images = await fetch_post_content_with_retry(first_url, max_retries=2)
            
            # 步骤 3: 显示结果
            print("\n" + "=" * 80)
            print("📊 结果摘要")
            print("=" * 80)
            print(f"标题：{title[:60]}..." if len(title) > 60 else f"标题：{title}")
            print(f"内容长度：{len(content)} 字符")
            print(f"图片数量：{len(images)} 张")
            
            if images:
                print("\n图片列表:")
                for i, img in enumerate(images[:5], 1):
                    print(f"  {i}. {img}")
            
            print("=" * 80)
            
            # 步骤 4: 保存到文件
            save_to_file(title, content, images, first_url)

def save_to_file(title, content, images, url):
    """保存结果到文件"""
    from datetime import datetime
    
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()[:50]
    safe_title = safe_title.replace(' ', '_')
    
    # 保存文本
    text_file = os.path.join(output_dir, f"{timestamp}_{safe_title}.txt")
    with open(text_file, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("知乎帖子详情 - 奥迪 Q5L (使用真实 Access Secret)\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"标题：{title}\n")
        f.write(f"URL: {url}\n")
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
    
    print(f"\n💾 结果已保存到：{text_file}")
    
    # 保存图片
    if images:
        print(f"\n🖼️  正在下载 {len(images)} 张图片...")
        import requests
        
        img_dir = os.path.join(output_dir, f"{timestamp}_{safe_title}_images")
        os.makedirs(img_dir, exist_ok=True)
        
        for i, img_url in enumerate(images, 1):
            try:
                response = requests.get(img_url, timeout=10)
                if response.status_code == 200:
                    img_name = img_url.split('/')[-1]
                    img_path = os.path.join(img_dir, f"{i:02d}_{img_name}")
                    with open(img_path, 'wb') as f:
                        f.write(response.content)
            except Exception as e:
                print(f"    ❌ 下载失败：{e}")
        
        print(f"✅ 图片已保存到：{img_dir}")

async def main():
    print("=" * 80)
    print("使用生产数据库的真实 Access Secret 测试知乎")
    print("=" * 80)
    
    # 读取 Access Secret
    access_secret = read_zhihu_secret_from_prod()
    
    if not access_secret:
        print("\n❌ 无法获取 Access Secret，测试终止")
        return
    
    # 设置环境变量
    os.environ['ZHIHU_ACCESS_SECRET'] = access_secret
    print(f"\n✅ 已设置环境变量 ZHIHU_ACCESS_SECRET")
    
    # 测试搜索
    await test_zhihu_search_with_secret(access_secret)

if __name__ == "__main__":
    asyncio.run(main())
