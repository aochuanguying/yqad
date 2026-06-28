#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书爬虫 -  Docker 优化版
使用 xhshow 生成签名进行搜索（包含 xsec_token）
使用 Playwright 无头模式获取笔记详情
专为群晖 NAS Docker 环境设计
"""

import asyncio
import json
import random
import time
import os
from pathlib import Path
from playwright.async_api import async_playwright
from typing import List, Dict, Optional
import requests
from xhshow import Xhshow


class XiaohongshuDockerCrawler:
    """小红书 Docker 爬虫类"""
    
    def __init__(self, cookie: str, headless: bool = True):
        self.cookie = cookie
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        self.xhshow_client = Xhshow()
        self.stealth_js_path = Path(__file__).parent / 'stealth.min.js'
        
        # 从 Cookie 中提取 a1 值
        self.a1_value = self._extract_cookie_value('a1')
        if not self.a1_value:
            raise ValueError("无法从 Cookie 中提取 a1 值")
        
    def _extract_cookie_value(self, key: str) -> Optional[str]:
        for item in self.cookie.split(';'):
            if '=' in item:
                k, v = item.split('=', 1)
                if k.strip() == key:
                    return v.strip()
        return None
    
    def _generate_search_id(self) -> str:
        return self.xhshow_client.get_search_id()
    
    def _generate_signature(self, uri: str, payload: dict) -> str:
        return self.xhshow_client.sign_xs_post(
            uri=uri,
            a1_value=self.a1_value,
            payload=payload
        )
    
    async def start(self):
        """启动浏览器"""
        playwright = await async_playwright().start()
        
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--window-size=1920,1080',
            ]
        )
        
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        self.page = await self.context.new_page()
        
        if self.stealth_js_path.exists():
            await self.page.add_init_script(path=str(self.stealth_js_path))
        
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
                })
        
        if cookies:
            await self.context.add_cookies(cookies)
        
        print("✅ 浏览器启动完成")
        
    async def close(self):
        if self.browser:
            await self.browser.close()
            print("🔒 浏览器已关闭")
    
    def search_notes(self, keyword: str, max_results: int = 10) -> List[Dict]:
        """使用 xhshow 搜索笔记"""
        print(f"\n🔍 搜索：{keyword}")
        
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        uri = "/api/sns/web/v2/search/notes"
        
        search_id = self._generate_search_id()
        
        payload = {
            "keyword": keyword,
            "page": 1,
            "page_size": min(max_results, 20),
            "search_id": search_id,
            "sort": "general",
            "note_type": 0
        }
        
        signature = self._generate_signature(uri, payload)
        
        headers = {
            "x-s": signature,
            "x-t": str(int(time.time() * 1000)),
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "zh-CN,zh;q=0.9",
            "origin": "https://www.xiaohongshu.com",
            "referer": "https://www.xiaohongshu.com/",
            "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
        }
        
        cookie_dict = {}
        for item in self.cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        try:
            response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
            result = response.json()
            
            if not (result.get('success') or result.get('code') == 0):
                print(f"❌ 搜索失败：{result.get('msg', 'Unknown error')}")
                return []
            
            items = result.get('data', {}).get('items', [])
            print(f"📦 找到 {len(items)} 条结果")
            
            notes = []
            for item in items:
                xsec_token = item.get('xsec_token')
                note_card = item.get('note_card', {})
                
                if not xsec_token:
                    xsec_token = note_card.get('xsec_token')
                if not xsec_token:
                    user = note_card.get('user', {})
                    xsec_token = user.get('xsec_token')
                
                note_id = note_card.get('id')
                title = note_card.get('display_title', '') or note_card.get('title', '无标题')
                
                if note_id and xsec_token:
                    notes.append({
                        'id': note_id,
                        'title': title[:100],
                        'xsec_token': xsec_token,
                        'url': f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}",
                    })
            
            print(f"✅ 提取到 {len(notes)} 条有效笔记")
            return notes
            
        except Exception as e:
            print(f"❌ 搜索异常：{e}")
            return []
    
    async def get_note_detail(self, note_id: str, xsec_token: str) -> Optional[Dict]:
        """使用 Playwright 获取笔记详情"""
        print(f"\n📝 获取笔记：{note_id}")
        
        await asyncio.sleep(random.uniform(1, 3))
        
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
        
        try:
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await asyncio.sleep(3)
            
            # 从 JavaScript 中提取数据
            note_data = await self.page.evaluate("""
                () => {
                    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                        const note = window.__INITIAL_STATE__.note;
                        if (note.currentNote) {
                            const cn = note.currentNote;
                            return {
                                title: cn.title,
                                desc: cn.desc,
                                user: cn.user?.nickname || '未知用户',
                                likes: cn.interact_info?.liked_count || 0,
                                collects: cn.interact_info?.collected_count || 0,
                                comments: cn.interact_info?.comment_count || 0
                            };
                        }
                    }
                    return null;
                }
            """)
            
            if not note_data:
                print("⚠️ 未找到笔记数据")
                return None
            
            # 提取图片
            images = []
            try:
                image_elems = await self.page.query_selector_all('.note-image img')
                for img in image_elems[:5]:
                    src = await img.get_attribute('src')
                    if src:
                        images.append(src)
            except:
                pass
            
            return {
                'id': note_id,
                'title': (note_data.get('title') or '').strip(),
                'desc': (note_data.get('desc') or '').strip()[:500],
                'user': (note_data.get('user') or '未知用户').strip(),
                'likes': str(note_data.get('likes', 0)),
                'collects': str(note_data.get('collects', 0)),
                'comments': str(note_data.get('comments', 0)),
                'images': images,
                'url': url,
                'xsec_token': xsec_token,
            }
            
        except Exception as e:
            print(f"❌ 获取失败：{e}")
            return None
    
    async def search_and_get_details(self, keyword: str, max_notes: int = 5) -> List[Dict]:
        """搜索并获取详情"""
        print(f"\n{'='*60}")
        print(f"🚀 开始：搜索 '{keyword}' 获取 {max_notes} 条笔记")
        print(f"{'='*60}")
        
        search_results = self.search_notes(keyword, max_results=max_notes * 2)
        
        if not search_results:
            return []
        
        notes_with_details = []
        for idx, note in enumerate(search_results, 1):
            if len(notes_with_details) >= max_notes:
                break
            
            detail = await self.get_note_detail(note['id'], note['xsec_token'])
            if detail:
                notes_with_details.append(detail)
        
        print(f"\n✅ 完成：获取 {len(notes_with_details)} 条笔记详情")
        return notes_with_details


async def main():
    # Cookie (请替换为最新 Cookie)
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"
    
    crawler = XiaohongshuDockerCrawler(cookie=COOKIE, headless=True)
    
    try:
        await crawler.start()
        
        results = await crawler.search_and_get_details("美食", max_notes=3)
        
        print("\n📊 结果：")
        for idx, note in enumerate(results, 1):
            print(f"\n{idx}. {note['title']}")
            print(f"   作者：{note['user']} | ❤️ {note['likes']} | ⭐ {note['collects']}")
        
        # 保存结果
        with open('/tmp/xiaohongshu_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 结果已保存")
        
    except Exception as e:
        print(f"❌ 异常：{e}")
        import traceback
        traceback.print_exc()
        
    finally:
        await crawler.close()


if __name__ == "__main__":
    asyncio.run(main())
