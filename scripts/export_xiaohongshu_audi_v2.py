#!/usr/bin/env python3
"""
搜索小红书"奥迪 Q5L"相关内容，获取详细信息并导出到文件
版本 2：自动从数据库获取 Cookie
"""

import sys
import json
import time
import mysql.connector
from datetime import datetime
from xhshow import Xhshow
import requests

def get_cookie_from_database():
    """从生产数据库获取小红书 Cookie"""
    try:
        # 连接数据库
        conn = mysql.connector.connect(
            host='192.168.50.50',
            port=3306,
            user='root',
            password='Wfw7539148@',
            database='yqad_prod_db'
        )
        
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT xiaohongshu_cookie FROM network_post_config WHERE id = 1"
        cursor.execute(sql)
        row = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if row and row.get('xiaohongshu_cookie'):
            print("✅ 从数据库获取 Cookie 成功")
            return row['xiaohongshu_cookie']
        else:
            print("❌ 数据库中没有 Cookie")
            return None
            
    except Exception as e:
        print(f"❌ 数据库连接失败：{e}")
        return None

class XiaohongshuExporter:
    """小红书数据导出工具"""
    
    def __init__(self, cookie: str):
        self.client = Xhshow()
        self.cookie_dict = self._parse_cookie(cookie)
    
    def _parse_cookie(self, cookie: str) -> dict:
        """解析 Cookie"""
        cookie_dict = {}
        for item in cookie.split("; "):
            if "=" in item:
                key, value = item.split("=", 1)
                cookie_dict[key] = value
        return cookie_dict
    
    def search_notes(self, keyword: str, page: int = 1, page_size: int = 20):
        """搜索笔记"""
        payload = {
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
            "search_id": self.client.get_search_request_id(),
            "sort": "general",
            "note_type": 0,
            "image_formats": ["jpg", "webp", "avif"],
            "geo": "",
            "message_id": "",
            "ext_flags": [],
            "filters": [
                {"tags": ["general"], "type": "sort_type"},
                {"tags": ["不限"], "type": "filter_note_type"}
            ]
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v2/search/notes",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=False
        )
        headers["Content-Type"] = "application/json"
        
        response = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"搜索失败：HTTP {response.status_code}")
    
    def get_note_detail(self, note_id: str, xsec_token: str):
        """获取笔记详情"""
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"],
            "extra": {"need_body_topic": "1"},
            "xsec_source": "pc_search",
            "xsec_token": xsec_token
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v1/feed",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=True
        )
        headers["Content-Type"] = "application/json"
        
        response = requests.post(
            "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"获取详情失败：HTTP {response.status_code}")
    
    def extract_image_urls(self, note_card: dict) -> list:
        """提取图片 URL 列表"""
        image_urls = []
        image_list = note_card.get('image_list', [])
        
        for img in image_list:
            info_list = img.get('info_list', [])
            for info in info_list:
                url = info.get('url')
                if url:
                    image_urls.append(url)
        
        return image_urls
    
    def export_to_file(self, data: list, filename: str):
        """导出数据到文件"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = f"{filename}_{timestamp}.json"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ 数据已导出到：{filepath}")
        return filepath
    
    def export_to_markdown(self, data: list, filename: str):
        """导出为 Markdown 格式"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = f"{filename}_{timestamp}.md"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("# 小红书搜索结果 - 奥迪 Q5L\n\n")
            f.write(f"搜索时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"总计：{len(data)} 篇笔记\n\n")
            f.write("---\n\n")
            
            for i, item in enumerate(data, 1):
                f.write(f"## {i}. {item.get('title', '无标题')}\n\n")
                
                # 基本信息
                f.write(f"- **笔记 ID**: {item.get('id')}\n")
                f.write(f"- **用户**: {item.get('user', {}).get('nickname', '未知')}\n")
                f.write(f"- **类型**: {item.get('type', 'unknown')}\n")
                
                # 描述
                if item.get('desc'):
                    f.write(f"\n**内容**:\n{item['desc']}\n\n")
                
                # 互动数据
                interact = item.get('interact_info', {})
                f.write(f"- 👍 点赞：{interact.get('liked_count', 0)}\n")
                f.write(f"- ⭐ 收藏：{interact.get('collected_count', 0)}\n")
                f.write(f"- 💬 评论：{interact.get('comment_count', 0)}\n")
                
                # 图片
                image_urls = item.get('image_urls', [])
                if image_urls:
                    f.write(f"\n**图片** ({len(image_urls)} 张):\n\n")
                    for j, url in enumerate(image_urls, 1):
                        f.write(f"![图片{j}]({url})\n\n")
                
                f.write("\n---\n\n")
        
        print(f"✅ Markdown 已导出到：{filepath}")
        return filepath

def main():
    """主函数"""
    print("=" * 60)
    print("小红书数据导出工具 - 奥迪 Q5L")
    print("=" * 60)
    
    # 从数据库获取 Cookie
    print("\n📊 从生产数据库获取 Cookie...")
    cookie = get_cookie_from_database()
    
    if not cookie:
        print("❌ 无法获取 Cookie，请检查数据库连接")
        return False
    
    keyword = "奥迪 Q5L"
    max_pages = 2  # 搜索 2 页
    page_size = 20  # 每页 20 条
    max_details = 5  # 最多获取 5 个详情
    
    exporter = XiaohongshuExporter(cookie)
    
    all_notes = []
    success_count = 0
    
    # 搜索多页
    for page in range(1, max_pages + 1):
        print(f"\n📋 搜索第 {page} 页...")
        
        try:
            result = exporter.search_notes(keyword, page=page, page_size=page_size)
            
            # 检查响应
            if result.get('code') == -100:
                print(f"  ❌ Cookie 已过期：{result.get('msg')}")
                print(f"\n💡 请重新登录小红书网页版获取新的 Cookie")
                return False
            
            items = result.get('data', {}).get('items', [])
            
            if not items:
                print(f"  第 {page} 页没有数据")
                break
            
            print(f"  ✅ 获取到 {len(items)} 条笔记")
            
            # 处理前几条笔记的详情
            for item in items[:max_details // max_pages]:
                if success_count >= max_details:
                    break
                
                note_id = item.get('id')
                xsec_token = item.get('xsec_token')
                
                if not xsec_token:
                    print(f"  ⚠️  笔记 {note_id} 缺少 xsec_token，跳过")
                    continue
                
                print(f"  📝 获取详情：{note_id}")
                
                try:
                    detail_result = exporter.get_note_detail(note_id, xsec_token)
                    
                    if detail_result.get('data') and detail_result['data'].get('items'):
                        note_detail = detail_result['data']['items'][0]
                        note_card = note_detail.get('note_card', {})
                        
                        # 提取完整信息
                        note_data = {
                            'id': note_detail.get('id'),
                            'title': note_card.get('title', '无标题'),
                            'desc': note_card.get('desc', ''),
                            'type': note_card.get('type', 'unknown'),
                            'user': note_card.get('user', {}),
                            'image_urls': exporter.extract_image_urls(note_card),
                            'interact_info': note_card.get('interact_info', {}),
                            'tag_list': note_card.get('tag_list', []),
                            'time': note_card.get('time'),
                            'search_info': {
                                'keyword': keyword,
                                'page': page,
                                'search_time': datetime.now().isoformat()
                            }
                        }
                        
                        all_notes.append(note_data)
                        success_count += 1
                        print(f"    ✅ 成功获取详情，图片数：{len(note_data['image_urls'])}")
                        
                        # 显示简要信息
                        print(f"    标题：{note_data['title']}")
                        print(f"    用户：{note_data['user'].get('nickname', '未知')}")
                        print(f"    点赞：{note_data['interact_info'].get('liked_count', 0)}")
                        print(f"    图片：{len(note_data['image_urls'])} 张")
                        
                        # 显示图片链接
                        if note_data['image_urls']:
                            print(f"    图片链接:")
                            for j, url in enumerate(note_data['image_urls'][:3], 1):
                                print(f"      [{j}] {url[:100]}...")
                    
                    # 添加延迟，避免触发风控
                    time.sleep(2)
                    
                except Exception as e:
                    print(f"    ❌ 获取详情失败：{e}")
                    continue
            
            # 页面间延迟
            time.sleep(3)
            
        except Exception as e:
            print(f"  ❌ 搜索失败：{e}")
            break
    
    # 导出结果
    if all_notes:
        print("\n" + "=" * 60)
        print(f"✅ 完成！共获取 {success_count} 篇笔记详情")
        print("=" * 60)
        
        # 导出为 JSON
        exporter.export_to_file(all_notes, "audi_q5l_notes")
        
        # 导出为 Markdown
        exporter.export_to_markdown(all_notes, "audi_q5l_notes")
        
        # 显示统计信息
        print("\n📊 统计信息:")
        print(f"  - 搜索页数：{max_pages}")
        print(f"  - 获取详情：{success_count} 篇")
        print(f"  - 总图片数：{sum(len(n['image_urls']) for n in all_notes)} 张")
        
        # 显示第一篇笔记的完整信息
        if all_notes:
            print("\n📝 示例笔记（第 1 篇）:")
            first_note = all_notes[0]
            print(json.dumps(first_note, ensure_ascii=False, indent=2)[:2000])
    else:
        print("\n❌ 未能获取到任何笔记详情")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
