"""从数据库读取 Access Secret 测试知乎搜索"""
import asyncio
import sys
import os
from datetime import datetime

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_zhihu_access_secret_from_db():
    """从数据库读取知乎 Access Secret"""
    try:
        # 导入数据库配置
        import pymysql
        
        # 数据库连接配置（从环境变量读取）
        host = os.getenv('PROD_MYSQL_HOST', 'localhost')
        user = os.getenv('PROD_MYSQL_USER', 'root')
        password = os.getenv('PROD_MYSQL_PASSWORD', '')
        database = os.getenv('PROD_MYSQL_DATABASE', 'yqad_prod_db')
        
        print(f"🔗 连接数据库：{host}/{database}")
        
        # 连接数据库
        connection = pymysql.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            charset='utf8mb4'
        )
        
        try:
            with connection.cursor() as cursor:
                # 查询网络帖子配置表
                sql = "SELECT zhihu_access_secret, zhihu_enabled FROM network_post_config LIMIT 1"
                cursor.execute(sql)
                result = cursor.fetchone()
                
                if result:
                    access_secret = result[0]
                    is_enabled = result[1]
                    
                    print(f"✅ 从数据库读取到配置:")
                    print(f"   - Access Secret: {access_secret[:20]}..." if access_secret else "   - Access Secret: 未配置")
                    print(f"   - 启用状态：{'是' if is_enabled else '否'}")
                    
                    return access_secret if access_secret else None
                else:
                    print("⚠️ 数据库中没有配置记录")
                    return None
                    
        finally:
            connection.close()
            
    except Exception as e:
        print(f"❌ 读取数据库失败：{e}")
        return None

async def main():
    print("=" * 80)
    print("测试知乎搜索（从数据库读取 Access Secret）")
    print("=" * 80)
    
    # 步骤 1: 从数据库读取 Access Secret
    print("\n📊 步骤 1: 从数据库读取 Access Secret...")
    access_secret = get_zhihu_access_secret_from_db()
    
    if not access_secret:
        print("⚠️ 未找到 Access Secret，使用备用 URL 测试")
        test_urls = ["https://zhuanlan.zhihu.com/p/2031378767277504021"]
    else:
        # 步骤 2: 使用 Access Secret 搜索
        print("\n🔍 步骤 2: 搜索奥迪 Q5L...")
        from test_zhihu_content import search_zhihu
        
        search_results = search_zhihu(access_secret, "奥迪 Q5L", limit=5)
        
        if search_results and 'data' in search_results and search_results['data']:
            print(f"✅ 搜索成功，找到 {len(search_results['data'])} 条结果")
            
            # 提取 URL
            test_urls = []
            for item in search_results['data'][:3]:
                if 'Url' in item:
                    url = item['Url']
                    title = item.get('Title', '无标题')
                    print(f"  - {title}")
                    print(f"    URL: {url}")
                    test_urls.append(url)
        else:
            print("❌ 搜索失败，使用备用 URL")
            test_urls = ["https://zhuanlan.zhihu.com/p/2031378767277504021"]
    
    # 步骤 3: 获取第一篇帖子详情
    print(f"\n📝 步骤 3: 获取第一篇帖子详情...")
    from test_zhihu_content import fetch_post_content_with_retry
    
    target_url = test_urls[0]
    print(f"目标 URL: {target_url}")
    print("-" * 80)
    
    title, content, images = await fetch_post_content_with_retry(target_url, max_retries=2)
    
    # 步骤 4: 输出结果
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

if __name__ == "__main__":
    asyncio.run(main())
