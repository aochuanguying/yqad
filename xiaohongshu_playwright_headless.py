#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书爬虫 - Playwright 无头模式优化版
专为 Docker 环境设计，使用 stealth.min.js 绕过检测
"""

import asyncio
import json
import random
import os
from pathlib import Path
from playwright.async_api import async_playwright
from typing import List, Dict, Optional


class XiaohongshuCrawler:
    """小红书爬虫类 - 无头模式优化版"""
    
    def __init__(self, cookie: str, headless: bool = True):
        """
        初始化爬虫
        
        Args:
            cookie: 小红书 Cookie 字符串
            headless: 是否使用无头模式，默认 True（适合 Docker）
        """
        self.cookie = cookie
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        
        # 获取 stealth.min.js 路径
        self.stealth_js_path = Path(__file__).parent / 'stealth.min.js'
        if not self.stealth_js_path.exists():
            print(f"⚠️ 警告：stealth.min.js 未找到，请确保文件存在：{self.stealth_js_path}")
        
    async def start(self):
        """启动浏览器"""
        playwright = await async_playwright().start()
        
        # 启动浏览器 - 无头模式优化
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--no-first-run',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080',
            ]
        )
        
        # 创建浏览器上下文 - 模拟真实浏览器
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
            color_scheme='light',
            device_scale_factor=1,
            has_touch=False,
            is_mobile=False,
        )
        
        self.page = await self.context.new_page()
        
        # 注入 stealth.min.js - 关键的反检测脚本
        if self.stealth_js_path.exists():
            print(f"✅ 加载 stealth.min.js: {self.stealth_js_path}")
            await self.page.add_init_script(path=str(self.stealth_js_path))
        else:
            # 如果 stealth.min.js 不存在，使用基本的反检测脚本
            print("⚠️ 使用基本反检测脚本（建议下载 stealth.min.js）")
            await self.page.add_init_script("""
                // 覆盖 navigator.webdriver
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false
                });
                
                // 覆盖 permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // 覆盖 chrome 运行时
                Object.defineProperty(navigator, 'chrome', {
                    get: () => ({
                        runtime: {
                            id: undefined,
                            onInstalled: { addListener: () => {} }
                        }
                    })
                });
            """)
        
        # 设置 Cookie
        cookies = []
        for cookie_str in self.cookie.split(';'):
            if '=' in cookie_str:
                name, value = cookie_str.strip().split('=', 1)
                cookies.append({
                    'name': name.strip(),
                    'value': value.strip(),
                    'domain': '.xiaohongshu.com',
                    'path': '/',
                    'httpOnly': True,
                    'secure': True
                })
        
        if cookies:
            await self.context.add_cookies(cookies)
            print(f"✅ 已设置 {len(cookies)} 个 Cookie")
        
        # 访问首页初始化
        print("🏠 访问首页初始化...")
        await self.page.goto("https://www.xiaohongshu.com", wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)
        
        print("✅ 浏览器启动完成（无头模式优化）")
        
    async def close(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
            print("🔒 浏览器已关闭")
            
    async def search_notes(self, keyword: str, max_results: int = 20) -> List[Dict]:
        """
        搜索笔记
        
        Args:
            keyword: 搜索关键词
            max_results: 最大结果数
            
        Returns:
            笔记列表
        """
        print(f"\n🔍 搜索：{keyword}")
        
        # 随机休眠模拟真实用户
        await asyncio.sleep(random.uniform(2, 5))
        
        # 访问搜索页面
        url = f"https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes"
        print(f"🔗 URL: {url}")
        
        await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # 等待搜索结果加载
        await asyncio.sleep(5)
        
        # 截图和保存 HTML 用于调试（Docker 环境可选）
        if os.getenv('DEBUG_MODE', 'false').lower() == 'true':
            screenshot_path = f'/tmp/xhs_search_{keyword.replace(" ", "_")}.png'
            await self.page.screenshot(path=screenshot_path)
            print(f"💾 搜索页面截图：{screenshot_path}")
            
            html_path = f'/tmp/xhs_search_{keyword.replace(" ", "_")}.html'
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(await self.page.content())
            print(f"💾 页面 HTML：{html_path}")
        
        # 提取笔记链接和 xsec_token
        notes = []
        
        # 从页面 JavaScript 中提取所有笔记数据
        page_data = await self.page.evaluate("""
            () => {
                const notes = [];
                // 尝试从 window.__INITIAL_STATE__ 中提取
                if (window.__INITIAL_STATE__) {
                    try {
                        const state = window.__INITIAL_STATE__;
                        const searchResult = state.searchResult || {};
                        const data = searchResult.data || [];
                        
                        data.forEach(item => {
                            if (item && item.id && item.xsec_token) {
                                notes.push({
                                    id: item.id,
                                    xsec_token: item.xsec_token,
                                    title: item.title || ''
                                });
                            }
                        });
                    } catch (e) {
                        console.log('无法从 __INITIAL_STATE__ 提取:', e);
                    }
                }
                return notes;
            }
        """)
        
        print(f"📦 从 JavaScript 提取到 {len(page_data)} 条笔记")
        
        # 如果从 JavaScript 提取失败，使用 DOM 方式
        if not page_data:
            note_links = await self.page.query_selector_all('a[href*="/explore/"]')
            print(f"📦 从 DOM 找到 {len(note_links)} 个笔记链接")
            
            for link in note_links[:max_results]:
                try:
                    href = await link.get_attribute('href')
                    if href and '/explore/' in href:
                        parts = href.split('?')
                        note_id = parts[0].split('/explore/')[1] if len(parts) > 0 else ''
                        xsec_token = ''
                        
                        if len(parts) > 1 and 'xsec_token=' in parts[1]:
                            xsec_token = parts[1].split('xsec_token=')[1].split('&')[0]
                        
                        title = await link.text_content()
                        title = title.strip() if title else '无标题'
                        
                        if note_id:
                            page_data.append({
                                'id': note_id,
                                'xsec_token': xsec_token,
                                'title': title[:100],
                            })
                except Exception as e:
                    print(f"⚠️ 解析链接失败：{e}")
                    continue
        
        # 转换为统一的格式
        for item in page_data:
            notes.append({
                'id': item.get('id', ''),
                'title': item.get('title', '无标题')[:100],
                'xsec_token': item.get('xsec_token', ''),
                'url': f"https://www.xiaohongshu.com/explore/{item.get('id', '')}" + (f"?xsec_token={item.get('xsec_token', '')}" if item.get('xsec_token') else ''),
            })
        
        # 去重
        seen_ids = set()
        unique_notes = []
        for note in notes:
            if note['id'] not in seen_ids:
                seen_ids.add(note['id'])
                unique_notes.append(note)
        
        print(f"✅ 去重后：{len(unique_notes)} 条笔记")
        return unique_notes
    
    async def get_note_detail(self, note_id: str, xsec_token: str = '') -> Optional[Dict]:
        """
        获取笔记详情
        
        Args:
            note_id: 笔记 ID
            xsec_token: 安全令牌（可选，如果为空会尝试从页面提取）
            
        Returns:
            笔记详情字典，失败返回 None
        """
        print(f"\n📝 获取笔记详情：{note_id}")
        
        await asyncio.sleep(random.uniform(1, 3))
        
        # 先尝试不带 xsec_token 访问
        if not xsec_token:
            url = f"https://www.xiaohongshu.com/explore/{note_id}"
        else:
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
            
            # 如果没有 xsec_token，尝试从页面提取
            if not xsec_token:
                xsec_token_from_page = await self.page.evaluate("""
                    () => {
                        if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                            const note = window.__INITIAL_STATE__.note;
                            if (note.currentNote) {
                                return note.currentNote.xsec_token || note.currentNote.xsecToken;
                            }
                            if (note.noteDetailMap) {
                                const keys = Object.keys(note.noteDetailMap);
                                for (const key of keys) {
                                    if (note.noteDetailMap[key] && note.noteDetailMap[key].note) {
                                        const noteData = note.noteDetailMap[key].note;
                                        if (noteData.xsec_token) return noteData.xsec_token;
                                        if (noteData.xsecToken) return noteData.xsecToken;
                                    }
                                }
                            }
                        }
                        return null;
                    }
                """)
                if xsec_token_from_page:
                    xsec_token = xsec_token_from_page
                    url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
                    print(f"✅ 从页面提取 xsec_token: {xsec_token[:30]}...")
            
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
                'images': images[:5],
                'url': url,
                'xsec_token': xsec_token,
            }
            
        except Exception as e:
            print(f"❌ 获取失败：{e}")
            return None
    
    async def search_and_get_details(self, keyword: str, max_notes: int = 5) -> List[Dict]:
        """
        搜索并获取详情
        
        Args:
            keyword: 搜索关键词
            max_notes: 最大笔记数量
            
        Returns:
            带详情的笔记列表
        """
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
            
            # 即使没有 xsec_token 也尝试获取（方法会自动从页面提取）
            detail = await self.get_note_detail(note['id'], note.get('xsec_token', ''))
            if detail:
                notes_with_details.append(detail)
        
        print(f"\n{'='*80}")
        print(f"✅ 完成：成功获取 {len(notes_with_details)} 条笔记详情")
        print(f"{'='*80}")
        
        return notes_with_details


async def main():
    """主函数"""
    # Cookie (请替换为最新 Cookie)
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; acw_tc=0a4aa0cb17826168523438362ef94287e177dc87ab101eb1d17bdd8d97b95e; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=1a942233-fa08-4886-99dc-81a68d4c6bdc"
    
    # 无头模式 - 适合 Docker
    crawler = XiaohongshuCrawler(cookie=COOKIE, headless=True)
    
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
