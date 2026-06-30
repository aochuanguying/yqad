#!/usr/bin/env python3
"""
搜索小红书"奥迪 Q5L"相关内容，获取详细信息并导出到文件
基于最新测试结果重构 (2026-06-29)
添加重试机制、频率控制等高级功能
"""

import sys
import json
import time
import random
import mysql.connector
from datetime import datetime
from xhshow import Xhshow
import requests
from typing import Optional, Dict, Any


class Config:
    """配置类 - 保守安全模式"""
    # 数据库配置
    DB_HOST = '192.168.50.50'
    DB_PORT = 3306
    DB_USER = 'root'
    DB_PASSWORD = 'Wfw7539148@'
    DB_NAME = 'yqad_prod_db'
    
    # 搜索配置 - 降低频率
    KEYWORD = "奥迪 Q5L"
    MAX_PAGES = 1           # 只搜索 1 页 (降低风险)
    PAGE_SIZE = 20
    MAX_DETAILS = 2         # 只获取 2 个详情 (降低风险)
    
    # 重试配置
    MAX_RETRIES = 2         # 减少重试次数
    RETRY_DELAY = 5         # 重试延迟 5 秒
    RETRY_BACKOFF = 1.5     # 降低倍数
    
    # 频率控制 - 保守模式
    REQUEST_DELAY_MIN = 8   # 最小延迟 8 秒 (原 1 秒)
    REQUEST_DELAY_MAX = 15  # 最大延迟 15 秒 (原 3 秒)
    PAGE_DELAY_MIN = 20     # 页面间最小 20 秒 (原 3 秒)
    PAGE_DELAY_MAX = 40     # 页面间最大 40 秒 (原 5 秒)
    
    # 超时配置
    REQUEST_TIMEOUT = 30
    
    # 用户行为模拟
    SIMULATE_USER_BEHAVIOR = True
    BEHAVIOR_DELAY_MIN = 2
    BEHAVIOR_DELAY_MAX = 5


def retry_on_failure(max_retries: int = 3, delay: float = 2.0, backoff: float = 2.0):
    """
    重试装饰器
    
    Args:
        max_retries: 最大重试次数
        delay: 初始延迟 (秒)
        backoff: 延迟倍数
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            current_delay = delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        print(f"    ⚠️  第 {attempt + 1} 次失败，{current_delay:.1f}秒后重试：{e}")
                        time.sleep(current_delay)
                        current_delay *= backoff  # 指数退避
                    else:
                        print(f"    ❌ 达到最大重试次数 ({max_retries})，放弃")
                        raise last_exception
            
            return None
        return wrapper
    return decorator


def get_cookie_from_db():
    """从生产数据库获取小红书 Cookie"""
    try:
        conn = mysql.connector.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME
        )
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT xiaohongshu_cookie FROM network_post_config WHERE id = 1 AND xiaohongshu_enabled = 1"
        cursor.execute(sql)
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row and row['xiaohongshu_cookie']:
            # 清理 Cookie:移除换行符和多余内容
            cookie = row['xiaohongshu_cookie'].split('\n')[0].strip()
            return cookie
        else:
            raise Exception("数据库中未找到有效的 Cookie，请先更新 Cookie")
    except Exception as e:
        print(f"❌ 从数据库获取 Cookie 失败：{e}")
        sys.exit(1)


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
    
    @staticmethod
    def _random_delay(min_delay: float, max_delay: float):
        """随机延迟，避免触发风控"""
        delay = random.uniform(min_delay, max_delay)
        time.sleep(delay)
        return delay
    
    @retry_on_failure(max_retries=Config.MAX_RETRIES, delay=Config.RETRY_DELAY, backoff=Config.RETRY_BACKOFF)
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
            json=payload,
            timeout=Config.REQUEST_TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 0 or data.get('success'):
                return data
            else:
                error_msg = data.get('msg', '未知错误')
                # 如果是登录过期，直接抛出严重错误，不重试
                if '登录已过期' in error_msg or 'expired' in error_msg.lower():
                    raise Exception(f"Cookie 已过期：{error_msg}")
                raise Exception(f"搜索失败：{error_msg}")
        else:
            raise Exception(f"搜索失败：HTTP {response.status_code}")
    
    @retry_on_failure(max_retries=Config.MAX_RETRIES, delay=Config.RETRY_DELAY, backoff=Config.RETRY_BACKOFF)
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
            json=payload,
            timeout=Config.REQUEST_TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 0 or data.get('success'):
                return data
            else:
                error_msg = data.get('msg', '未知错误')
                # 如果是登录过期或权限问题，直接抛出严重错误
                if '登录已过期' in error_msg or 'expired' in error_msg.lower() or '权限' in error_msg:
                    raise Exception(f"Cookie 已过期或权限不足：{error_msg}")
                raise Exception(f"获取详情失败：{error_msg}")
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
    print("小红书数据导出工具 - 奥迪 Q5L (增强版)")
    print("=" * 60)
    print(f"\n⚙️  配置信息:")
    print(f"  - 关键词：{Config.KEYWORD}")
    print(f"  - 最大页数：{Config.MAX_PAGES}")
    print(f"  - 每页数量：{Config.PAGE_SIZE}")
    print(f"  - 最大详情：{Config.MAX_DETAILS}")
    print(f"  - 重试次数：{Config.MAX_RETRIES}")
    print(f"  - 请求延迟：{Config.REQUEST_DELAY_MIN}-{Config.REQUEST_DELAY_MAX}秒")
    
    # 从数据库获取最新 Cookie
    print("\n📋 正在从数据库获取 Cookie...")
    cookie = get_cookie_from_db()
    print(f"✅ Cookie 获取成功，长度：{len(cookie)}")
    
    exporter = XiaohongshuExporter(cookie)
    
    all_notes = []
    success_count = 0
    
    # 搜索多页
    for page in range(1, Config.MAX_PAGES + 1):
        print(f"\n📋 搜索第 {page} 页...")
        
        try:
            # 搜索笔记
            result = exporter.search_notes(Config.KEYWORD, page=page, page_size=Config.PAGE_SIZE)
            
            items = result.get('data', {}).get('items', [])
            
            if not items:
                print(f"  ⚠️  第 {page} 页没有数据")
                break
            
            print(f"  ✅ 获取到 {len(items)} 条笔记")
            
            # 处理前几条笔记的详情
            details_per_page = (Config.MAX_DETAILS + Config.MAX_PAGES - 1) // Config.MAX_PAGES
            for item in items[:details_per_page]:
                if success_count >= Config.MAX_DETAILS:
                    break
                
                note_id = item.get('id')
                xsec_token = item.get('xsec_token')
                
                if not xsec_token:
                    print(f"  ⚠️  笔记 {note_id} 缺少 xsec_token，跳过")
                    continue
                
                print(f"  📝 获取详情：{note_id}")
                
                # 随机延迟，避免触发风控
                delay = exporter._random_delay(Config.REQUEST_DELAY_MIN, Config.REQUEST_DELAY_MAX)
                print(f"     延迟 {delay:.1f}秒...")
                
                try:
                    detail_result = exporter.get_note_detail(note_id, xsec_token)
                    
                    if detail_result.get('data') and detail_result['data'].get('items'):
                        note_detail = detail_result['data']['items'][0]
                        note_card = note_detail.get('note_card', {})
                        
                        # 提取完整信息
                        note_data = {
                            'id': note_detail.get('id'),
                            'title': note_card.get('title') or note_card.get('display_title', '无标题'),
                            'desc': note_card.get('desc', ''),
                            'type': note_card.get('type', 'unknown'),
                            'user': note_card.get('user', {}),
                            'image_urls': exporter.extract_image_urls(note_card),
                            'interact_info': note_card.get('interact_info', {}),
                            'tag_list': note_card.get('tag_list', []),
                            'time': note_card.get('time'),
                            'search_info': {
                                'keyword': Config.KEYWORD,
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
                    
                except Exception as e:
                    print(f"    ❌ 获取详情失败：{e}")
                    # 失败后延迟更长
                    time.sleep(Config.RETRY_DELAY * 2)
                    continue
            
            # 页面间随机延迟
            if page < Config.MAX_PAGES:
                page_delay = exporter._random_delay(Config.PAGE_DELAY_MIN, Config.PAGE_DELAY_MAX)
                print(f"  ⏳ 页面间延迟 {page_delay:.1f}秒...")
            
        except Exception as e:
            print(f"  ❌ 搜索失败：{e}")
            # 如果是 Cookie 过期，直接退出
            if 'Cookie 已过期' in str(e):
                print("\n💡 提示：Cookie 已过期，请运行以下命令更新:")
                print("   python3 auto_refresh_xiaohongshu_cookie.py")
                return False
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
        print(f"  - 搜索页数：{Config.MAX_PAGES}")
        print(f"  - 获取详情：{success_count} 篇")
        total_images = sum(len(n['image_urls']) for n in all_notes)
        print(f"  - 总图片数：{total_images} 张")
        
        # 显示第一篇笔记的简要信息
        if all_notes:
            print("\n📝 示例笔记（第 1 篇）:")
            first_note = all_notes[0]
            print(f"  标题：{first_note['title']}")
            print(f"  用户：{first_note['user'].get('nickname', '未知')}")
            print(f"  描述：{first_note['desc'][:100]}...")
            print(f"  图片：{len(first_note['image_urls'])} 张")
            if first_note['image_urls']:
                print(f"  第 1 张图片：{first_note['image_urls'][0][:100]}...")
    else:
        print("\n❌ 未能获取到任何笔记详情")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
