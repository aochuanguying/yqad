#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书爬虫 - 纯 Playwright 版本 v2
改进搜索选择器，使用更通用的方式
"""

import asyncio
import json
import random
from playwright.async_api import async_playwright
from typing import List, Dict, Optional


class XiaohongshuCrawler:
    """小红书爬虫类"""
    
    def __init__(self, cookie: str, headless: bool = False):
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
        
        # 注入脚本
        await self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
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
            
    async def search_notes(self, keyword: str, max_results: int = 20) -> List[Dict]:
        """
        搜索笔记 - 改进版本
        通过访问搜索页面，然后从页面中提取笔记列表
        """
        print(f"\n🔍 搜索：{keyword}")
        
        # 随机休眠
        await asyncio.sleep(random.uniform(2, 5))
        
        # 访问搜索页面
        url = f"https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes"
        print(f"🔗 URL: {url}")
        
        await self.page.goto(url, wait_until='networkidle', timeout=30000)
        
        # 等待搜索结果加载
        await asyncio.sleep(5)
        
        # 截图查看
        screenshot_path = f'/tmp/xhs_search_{keyword}.png'
        await self.page.screenshot(path=screenshot_path)
        print(f"💾 搜索页面截图：{screenshot_path}")
        
        # 获取页面 HTML 用于调试
        html_path = f'/tmp/xhs_search_{keyword}.html'
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(await self.page.content())
        print(f"💾 页面 HTML：{html_path}")
        
        # 尝试多种方式提取笔记
        notes = []
        
        # 方法 1：查找所有笔记链接
        note_links = await self.page.query_selector_all('a[href*="/explore/"]')
        print(f"📦 找到 {len(note_links)} 个笔记链接")
        
        for link in note_links[:max_results]:
            try:
                href = await link.get_attribute('href')
                if href and '/explore/' in href:
                    # 提取 note_id 和 xsec_token
                    parts = href.split('?')
                    note_id = parts[0].split('/explore/')[1] if len(parts) > 0 else ''
                    xsec_token = ''
                    
                    if len(parts) > 1 and 'xsec_token=' in parts[1]:
                        xsec_token = parts[1].split('xsec_token=')[1].split('&')[0]
                    
                    # 获取笔记标题
                    title = await link.text_content()
                    title = title.strip() if title else '无标题'
                    
                    if note_id:
                        notes.append({
                            'id': note_id,
                            'title': title[:100],  # 限制长度
                            'xsec_token': xsec_token,
                            'url': f"https://www.xiaohongshu.com/explore/{note_id}" + (f"?xsec_token={xsec_token}" if xsec_token else ''),
                        })
            except Exception as e:
                print(f"⚠️ 解析链接失败：{e}")
                continue
        
        # 去重
        seen_ids = set()
        unique_notes = []
        for note in notes:
            if note['id'] not in seen_ids:
                seen_ids.add(note['id'])
                unique_notes.append(note)
        
        print(f"✅ 去重后：{len(unique_notes)} 条笔记")
        return unique_notes
    
    async def get_note_detail(self, note_id: str, xsec_token: str) -> Optional[Dict]:
        """获取笔记详情"""
        print(f"\n📝 获取笔记详情：{note_id}")
        
        await asyncio.sleep(random.uniform(1, 3))
        
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
        print(f"🔗 URL: {url}")
        
        try:
            await self.page.goto(url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(3)
            
            # 检查是否有笔记内容
            note_content = await self.page.query_selector('.note-content')
            if not note_content:
                print("❌ 未找到笔记内容")
                return None
            
            # 提取详情
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
            
            # 图片
            images = []
            image_elems = await self.page.query_selector_all('.note-image img')
            for img in image_elems:
                src = await img.get_attribute('src')
                if src:
                    images.append(src)
            
            return {
                'id': note_id,
                'title': title.strip(),
                'desc': desc.strip()[:200],
                'user': user.strip(),
                'likes': likes.strip(),
                'collects': collects.strip(),
                'comments': comments.strip(),
                'images': images[:5],  # 只取前 5 张
                'url': url,
            }
            
        except Exception as e:
            print(f"❌ 获取失败：{e}")
            return None
    
    async def search_and_get_details(self, keyword: str, max_notes: int = 5) -> List[Dict]:
        """搜索并获取详情"""
        print(f"\n{'='*80}")
        print(f"🚀 开始任务：搜索 '{keyword}' 并获取前 {max_notes} 条笔记详情")
        print(f"{'='*80}")
        
        # 搜索
        search_results = await self.search_notes(keyword, max_results=max_notes * 2)
        
        if not search_results:
            print("❌ 搜索结果为空")
            return []
        
        print(f"✅ 搜索完成，找到 {len(search_results)} 条笔记")
        
        # 获取详情
        notes_with_details = []
        
        for idx, note in enumerate(search_results, 1):
            if len(notes_with_details) >= max_notes:
                break
                
            print(f"\n[{idx}/{len(search_results)}] 处理：{note['id']}")
            
            if note['xsec_token']:
                detail = await self.get_note_detail(note['id'], note['xsec_token'])
                if detail:
                    notes_with_details.append(detail)
            else:
                print("⚠️ 缺少 xsec_token")
        
        print(f"\n{'='*80}")
        print(f"✅ 完成：成功获取 {len(notes_with_details)} 条笔记详情")
        print(f"{'='*80}")
        
        return notes_with_details


async def main():
    """主函数"""
    # Cookie (请替换为最新 Cookie)
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"
    
    crawler = XiaohongshuCrawler(cookie=COOKIE, headless=False)
    
    try:
        await crawler.start()
        
        # 测试搜索
        results = await crawler.search_and_get_details("美食", max_notes=3)
        
        # 打印结果
        print("\n📊 最终结果：")
        for idx, note in enumerate(results, 1):
            print(f"\n{idx}. {note['title']}")
            print(f"   作者：{note['user']}")
            print(f"   点赞：{note['likes']}")
            print(f"   收藏：{note['collects']}")
            print(f"   评论：{note['comments']}")
            print(f"   图片：{len(note['images'])} 张")
        
        # 保存结果
        with open('xiaohongshu_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 结果已保存：xiaohongshu_results.json")
        
    except Exception as e:
        print(f"❌ 异常：{e}")
        import traceback
        traceback.print_exc()
        
    finally:
        await crawler.close()


if __name__ == "__main__":
    asyncio.run(main())
