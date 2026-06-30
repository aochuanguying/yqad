"""从生产数据库复制知乎 Access Secret 到测试数据库"""
import pymysql
import os

def copy_zhihu_secret():
    """复制 Access Secret 从生产库到测试库"""
    
    # 生产数据库配置
    prod_config = {
        'host': os.getenv('PROD_MYSQL_HOST', '192.168.50.50'),
        'user': os.getenv('PROD_MYSQL_USER', 'root'),
        'password': os.getenv('PROD_MYSQL_PASSWORD', ''),
        'database': os.getenv('PROD_MYSQL_DATABASE', 'yqad_prod_db'),
        'charset': 'utf8mb4'
    }
    
    # 测试数据库配置（假设是本地）
    test_config = {
        'host': 'localhost',
        'user': 'root',
        'password': '',
        'database': 'yqad_test_db',
        'charset': 'utf8mb4'
    }
    
    print("=" * 80)
    print("复制知乎 Access Secret 从生产库到测试库")
    print("=" * 80)
    
    # 步骤 1: 从生产数据库读取
    print(f"\n📊 步骤 1: 连接生产数据库 {prod_config['host']}/{prod_config['database']}...")
    try:
        prod_conn = pymysql.connect(**prod_config)
        with prod_conn.cursor() as cursor:
            sql = "SELECT zhihu_access_secret, zhihu_enabled FROM network_post_config LIMIT 1"
            cursor.execute(sql)
            result = cursor.fetchone()
            
            if result:
                access_secret = result[0]
                is_enabled = result[1]
                
                print(f"✅ 读取成功:")
                print(f"   - Access Secret: {access_secret[:30]}..." if len(access_secret) > 30 else f"   - Access Secret: {access_secret}")
                print(f"   - 启用状态：{'是' if is_enabled else '否'}")
            else:
                print("❌ 生产数据库中没有配置记录")
                return None
                
    except Exception as e:
        print(f"❌ 连接生产数据库失败：{e}")
        return None
    finally:
        prod_conn.close()
    
    # 步骤 2: 写入测试数据库
    print(f"\n📊 步骤 2: 连接到测试数据库 {test_config['host']}/{test_config['database']}...")
    try:
        test_conn = pymysql.connect(**test_config)
        with test_conn.cursor() as cursor:
            # 检查表是否存在
            cursor.execute("SHOW TABLES LIKE 'network_post_config'")
            if not cursor.fetchone():
                print("⚠️ 测试数据库中没有 network_post_config 表，尝试创建...")
                # 这里可以添加创建表的逻辑
                print("⚠️ 请先运行数据库迁移创建表")
                return None
            
            # 更新或插入配置
            sql = """
                INSERT INTO network_post_config (zhihu_access_secret, zhihu_enabled) 
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE 
                    zhihu_access_secret = VALUES(zhihu_access_secret),
                    zhihu_enabled = VALUES(zhihu_enabled)
            """
            cursor.execute(sql, (access_secret, is_enabled))
            test_conn.commit()
            
            print(f"✅ 写入成功!")
            print(f"   - 已更新测试数据库配置")
            
    except Exception as e:
        print(f"❌ 写入测试数据库失败：{e}")
        return None
    finally:
        test_conn.close()
    
    print("\n" + "=" * 80)
    print("✅ 复制完成!")
    print("=" * 80)
    
    return access_secret

if __name__ == "__main__":
    secret = copy_zhihu_secret()
    if secret:
        print(f"\n💡 提示：现在可以使用 Access Secret 进行测试")
        print(f"   设置环境变量：export ZHIHU_ACCESS_SECRET=\"{secret}\"")
