#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书爬虫 - 纯 Playwright 版本
统一使用 Playwright 浏览器自动化方案，不依赖 xhs/xhshow 库
功能：
1. 搜索笔记
2. 获取笔记详情
"""

import asyncio
import json
import random
import time
from playwright.async_api import async_playwright
from typing import List, Dict, Optional


class XiaohongshuCrawler:
    """小红书爬虫类"""
    
    def __init__(self, cookie: str, headless: bool = False):
        """
        初始化爬虫
        
        Args:
            cookie: 小红书 Cookie
            headless: 是否无头模式，默认 False（方便调试）
        """
        self.cookie = cookie
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        
    async def start(self):
        """启动浏览器"""
        playwright = await async_playwright().start()
        
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ]
        )
        
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        self.page = await self.context.new_page()
        
        # 注入脚本覆盖 navigator.webdriver
        await self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
            });
            Object.defineProperty(navigator, 'chrome', {
                get: () => ({})
            });
        """)
        
        # 设置 Cookie
        await self.context.add_cookies([
            {'name': name, 'value': value, 'domain': '.xiaohongshu.com', 'path': '/'}
            for cookie in self.cookie.split(';')
            if '=' in cookie
            for name, value in [cookie.strip().split('=', 1)]
        ])
        
        print("✅ 浏览器启动完成")
        
    async def close(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
            print("✅ 浏览器已关闭")
            
    async def search_notes(self, keyword: str, page: int = 1, page_size: int = 20) -> List[Dict]:
        """
        搜索笔记
        
        Args:
            keyword: 搜索关键词
            page: 页码，默认 1
            page_size: 每页数量，默认 20
            
        Returns:
            笔记列表
        """
        print(f"\n🔍 搜索：{keyword}")
        
        # 随机休眠 1-5 秒
        sleep_time = random.uniform(1, 5)
        await asyncio.sleep(sleep_time)
        
        # 访问搜索页面
        url = f"https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes"
        print(f"🔗 URL: {url}")
        
        await self.page.goto(url, wait_until='networkidle', timeout=30000)
        
        # 等待搜索结果加载
        await asyncio.sleep(3)
        
        # 尝试获取搜索结果
        notes = []
        
        # 查找笔记卡片
        note_cards = await self.page.query_selector_all('.search-result-card')
        
        if not note_cards:
            # 如果没有找到，尝试其他选择器
            note_cards = await self.page.query_selector_all('[data-type="note"]')
        
        print(f"📦 找到 {len(note_cards)} 条笔记")
        
        for idx, card in enumerate(note_cards[:page_size]):
            try:
                # 提取笔记信息
                title_elem = await card.query_selector('.title')
                title = await title_elem.text_content() if title_elem else '无标题'
                
                desc_elem = await card.query_selector('.desc')
                desc = await desc_elem.text_content() if desc_elem else ''
                
                user_elem = await card.query_selector('.user-name')
                user = await user_elem.text_content() if user_elem else '未知用户'
                
                # 提取 note_id 和 xsec_token
                link_elem = await card.query_selector('a')
                if link_elem:
                    href = await link_elem.get_attribute('href')
                    # 从 URL 中提取 note_id 和 xsec_token
                    note_id = href.split('/explore/')[1].split('?')[0] if '/explore/' in href else ''
                    xsec_token = href.split('xsec_token=')[1].split('&')[0] if 'xsec_token=' in href else ''
                else:
                    note_id = ''
                    xsec_token = ''
                
                notes.append({
                    'id': note_id,
                    'title': title.strip(),
                    'desc': desc.strip(),
                    'user': user.strip(),
                    'xsec_token': xsec_token,
                    'url': f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}" if note_id else '',
                })
                
            except Exception as e:
                print(f"⚠️ 解析笔记失败：{e}")
                continue
        
        return notes
    
    async def get_note_detail(self, note_id: str, xsec_token: str) -> Optional[Dict]:
        """
        获取笔记详情
        
        Args:
            note_id: 笔记 ID
            xsec_token: 安全令牌
            
        Returns:
            笔记详情
        """
        print(f"\n📝 获取笔记详情：{note_id}")
        
        # 随机休眠 1-3 秒
        sleep_time = random.uniform(1, 3)
        await asyncio.sleep(sleep_time)
        
        # 访问笔记页面
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
        print(f"🔗 URL: {url}")
        
        try:
            await self.page.goto(url, wait_until='networkidle', timeout=30000)
            
            # 等待内容加载
            await asyncio.sleep(2)
            
            # 检查是否有笔记内容
            note_content = await self.page.query_selector('.note-content')
            if not note_content:
                print("❌ 未找到笔记内容")
                return None
            
            # 提取笔记详情
            title_elem = await self.page.query_selector('.title')
            title = await title_elem.text_content() if title_elem else '无标题'
            
            desc_elem = await self.page.query_selector('.desc')
            desc = await desc_elem.text_content() if desc_elem else ''
            
            user_elem = await self.page.query_selector('.user-name')
            user = await user_elem.text_content() if user_elem else '未知用户'
            
            # 互动数据
            like_elem = await self.page.query_selector('.like-count')
            likes = await like_elem.text_content() if like_elem else '0'
            
            collect_elem = await self.page.query_selector('.collect-count')
            collects = await collect_elem.text_content() if collect_elem else '0'
            
            comment_elem = await self.page.query_selector('.comment-count')
            comments = await comment_elem.text_content() if comment_elem else '0'
            
            # 图片列表
            images = []
            image_elems = await self.page.query_selector_all('.note-image img')
            for img in image_elems:
                src = await img.get_attribute('src')
                if src:
                    images.append(src)
            
            return {
                'id': note_id,
                'title': title.strip(),
                'desc': desc.strip(),
                'user': user.strip(),
                'likes': likes.strip(),
                'collects': collects.strip(),
                'comments': comments.strip(),
                'images': images,
                'url': url,
            }
            
        except Exception as e:
            print(f"❌ 获取笔记详情失败：{e}")
            return None
    
    async def search_and_get_details(self, keyword: str, max_notes: int = 10) -> List[Dict]:
        """
        搜索并获取笔记详情
        
        Args:
            keyword: 搜索关键词
            max_notes: 最大获取笔记数量
            
        Returns:
            带详情的笔记列表
        """
        print(f"\n{'='*80}")
        print(f"🚀 开始任务：搜索 '{keyword}' 并获取前 {max_notes} 条笔记详情")
        print(f"{'='*80}")
        
        # 搜索笔记
        search_results = await self.search_notes(keyword, page=1, page_size=max_notes)
        
        if not search_results:
            print("❌ 搜索结果为空")
            return []
        
        print(f"✅ 搜索完成，找到 {len(search_results)} 条笔记")
        
        # 获取每条笔记的详情
        notes_with_details = []
        
        for idx, note in enumerate(search_results, 1):
            print(f"\n[{idx}/{len(search_results)}] 处理笔记：{note['id']}")
            
            if note['xsec_token']:
                detail = await self.get_note_detail(note['id'], note['xsec_token'])
                if detail:
                    notes_with_details.append(detail)
            else:
                print("⚠️ 缺少 xsec_token，跳过")
        
        print(f"\n{'='*80}")
        print(f"✅ 任务完成，成功获取 {len(notes_with_details)} 条笔记详情")
        print(f"{'='*80}")
        
        return notes_with_details


async def main():
    """主函数"""
    # Cookie (请替换为最新的 Cookie)
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"
    
    # 创建爬虫实例
    crawler = XiaohongshuCrawler(cookie=COOKIE, headless=False)
    
    try:
        # 启动浏览器
        await crawler.start()
        
        # 搜索并获取详情
        keyword = "美食"
        results = await crawler.search_and_get_details(keyword, max_notes=5)
        
        # 打印结果
        print("\n📊 最终结果：")
        for idx, note in enumerate(results, 1):
            print(f"\n{idx}. {note['title']}")
            print(f"   作者：{note['user']}")
            print(f"   点赞：{note['likes']}")
            print(f"   收藏：{note['collects']}")
            print(f"   评论：{note['comments']}")
            print(f"   图片：{len(note['images'])} 张")
        
        # 保存结果到文件
        with open(f'xiaohongshu_{keyword}_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 结果已保存到：xiaohongshu_{keyword}_results.json")
        
    except Exception as e:
        print(f"❌ 程序异常：{e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # 关闭浏览器
        await crawler.close()


if __name__ == "__main__":
    asyncio.run(main())
