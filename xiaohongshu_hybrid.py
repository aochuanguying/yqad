#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书爬虫 - 混合方案
使用 xhshow 生成签名获取搜索数据（包含 xsec_token）
使用 Playwright 无头模式获取笔记详情
专为 Docker 环境设计
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


class XiaohongshuHybridCrawler:
    """小红书混合爬虫类"""
    
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
        self.xhshow_client = Xhshow()
        
        # 获取 stealth.min.js 路径
        self.stealth_js_path = Path(__file__).parent / 'stealth.min.js'
        
        # 从 Cookie 中提取 a1 值
        self.a1_value = self._extract_cookie_value('a1')
        if not self.a1_value:
            raise ValueError("无法从 Cookie 中提取 a1 值")
        
    def _extract_cookie_value(self, key: str) -> Optional[str]:
        """从 Cookie 中提取指定 key 的值"""
        for item in self.cookie.split(';'):
            if '=' in item:
                k, v = item.split('=', 1)
                if k.strip() == key:
                    return v.strip()
        return None
    
    def _generate_search_id(self) -> str:
        """生成 search_id"""
        return self.xhshow_client.get_search_id()
    
    def _generate_signature(self, uri: str, payload: dict) -> str:
        """生成签名"""
        return self.xhshow_client.sign_xs_post(
            uri=uri,
            a1_value=self.a1_value,
            payload=payload
        )
    
    async def start(self):
        """启动浏览器"""
        playwright = await async_playwright().start()
        
        # 启动浏览器
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080',
            ]
        )
        
        # 创建浏览器上下文
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        self.page = await self.context.new_page()
        
        # 注入 stealth.min.js
        if self.stealth_js_path.exists():
            print(f"✅ 加载 stealth.min.js: {self.stealth_js_path}")
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
                    'httpOnly': True,
                    'secure': True
                })
        
        if cookies:
            await self.context.add_cookies(cookies)
            print(f"✅ 已设置 {len(cookies)} 个 Cookie")
        
        print("✅ 浏览器启动完成（混合模式）")
        
    async def close(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
            print("🔒 浏览器已关闭")
    
    def search_notes_api(self, keyword: str, page: int = 1, page_size: int = 10) -> List[Dict]:
        """
        使用 xhshow 搜索笔记（API 方式）
        
        Args:
            keyword: 搜索关键词
            page: 页码
            page_size: 每页数量
            
        Returns:
            笔记列表（包含 xsec_token）
        """
        print(f"\n🔍 API 搜索：{keyword}")
        
        # 随机休眠
        time.sleep(random.uniform(1, 3))
        
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        uri = "/api/sns/web/v2/search/notes"
        
        search_id = self._generate_search_id()
        
        payload = {
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
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
        
        # 将 Cookie 转换为字典
        cookie_dict = {}
        for item in self.cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        try:
            response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
            result = response.json()
            
            if result.get('success') or result.get('code') == 0:
                data = result.get('data', {})
                items = data.get('items', [])
                print(f"📦 API 返回 {len(items)} 条结果")
                
                notes = []
                for item in items:
                    # xsec_token 可能在 item 级别，也可能在 note_card 级别
                    xsec_token = item.get('xsec_token')
                    
                    note_card = item.get('note_card', {}) or item.get('model', {})
                    if not note_card:
                        continue
                    
                    note_id = note_card.get('id') or note_card.get('note_id')
                    
                    # 如果 item 级别没有 xsec_token，尝试从 note_card 中获取
                    if not xsec_token:
                        xsec_token = note_card.get('xsec_token')
                    
                    # 如果还是没有，尝试从 user 中获取
                    if not xsec_token:
                        user = note_card.get('user', {})
                        xsec_token = user.get('xsec_token')
                    
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
            else:
                print(f"❌ API 请求失败：{result.get('msg', 'Unknown error')}")
                return []
                
        except Exception as e:
            print(f"❌ API 异常：{e}")
            return []
    
    async def get_note_detail(self, note_id: str, xsec_token: str) -> Optional[Dict]:
        """
        使用 Playwright 获取笔记详情
        
        Args:
            note_id: 笔记 ID
            xsec_token: 安全令牌
            
        Returns:
            笔记详情字典，失败返回 None
        """
        print(f"\n📝 获取笔记详情：{note_id}")
        
        await asyncio.sleep(random.uniform(1, 3))
        
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
        print(f"🔗 URL: {url}")
        
        try:
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await asyncio.sleep(3)
            
            # 从 __INITIAL_STATE__ 中提取数据
            note_data = await self.page.evaluate("""
                () => {
                    const result = {};
                    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
                        const note = window.__INITIAL_STATE__.note;
                        
                        // 尝试从 currentNote 获取
                        if (note.currentNote) {
                            const cn = note.currentNote;
                            result.currentNote = {
                                id: cn.id,
                                title: cn.title,
                                desc: cn.desc,
                                xsec_token: cn.xsec_token,
                                user: cn.user ? {
                                    nickname: cn.user.nickname,
                                    userid: cn.user.userid
                                } : null,
                                interact_info: cn.interact_info || {}
                            };
                        }
                        
                        // 尝试从 noteDetailMap 获取
                        if (note.noteDetailMap) {
                            const keys = Object.keys(note.noteDetailMap);
                            const validKey = keys.find(k => k !== 'undefined' && k !== '');
                            if (validKey && note.noteDetailMap[validKey]) {
                                const detail = note.noteDetailMap[validKey];
                                if (detail.note) {
                                    const dn = detail.note;
                                    result.noteFromMap = {
                                        id: dn.id,
                                        title: dn.title,
                                        desc: dn.desc,
                                        xsec_token: dn.xsec_token,
                                        user: dn.user ? {
                                            nickname: dn.user.nickname,
                                            userid: dn.user.userid
                                        } : null,
                                        interact_info: dn.interact_info || {}
                                    };
                                }
                            }
                        }
                    }
                    return result;
                }
            """)
            
            # 优先使用 currentNote
            data = note_data.get('currentNote') or note_data.get('noteFromMap')
            
            if not data:
                print("❌ 未找到笔记数据")
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
                'id': data.get('id', note_id),
                'title': (data.get('title') or '').strip(),
                'desc': (data.get('desc') or '').strip()[:500],
                'user': (data.get('user', {}).get('nickname') or '未知用户').strip(),
                'likes': str(data.get('interact_info', {}).get('liked_count', 0)),
                'collects': str(data.get('interact_info', {}).get('collected_count', 0)),
                'comments': str(data.get('interact_info', {}).get('comment_count', 0)),
                'images': images,
                'url': url,
                'xsec_token': xsec_token,
            }
            
        except Exception as e:
            print(f"❌ 获取失败：{e}")
            return None
    
    async def search_and_get_details(self, keyword: str, max_notes: int = 5) -> List[Dict]:
        """
        搜索并获取详情（一体化方法）
        
        Args:
            keyword: 搜索关键词
            max_notes: 最大笔记数量
            
        Returns:
            带详情的笔记列表
        """
        print(f"\n{'='*80}")
        print(f"🚀 开始任务：搜索 '{keyword}' 并获取前 {max_notes} 条笔记详情")
        print(f"{'='*80}")
        
        # 使用 API 搜索（返回带 xsec_token 的结果）
        search_results = self.search_notes_api(keyword, page=1, page_size=max_notes * 2)
        
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
            
            detail = await self.get_note_detail(note['id'], note['xsec_token'])
            if detail:
                notes_with_details.append(detail)
        
        print(f"\n{'='*80}")
        print(f"✅ 完成：成功获取 {len(notes_with_details)} 条笔记详情")
        print(f"{'='*80}")
        
        return notes_with_details


async def main():
    """主函数"""
    # Cookie (使用 test_xhshow_search.py 中验证成功的完整 Cookie)
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}"
    
    # 无头模式 - 适合 Docker
    crawler = XiaohongshuHybridCrawler(cookie=COOKIE, headless=True)
    
    try:
        await crawler.start()
        
        # 测试搜索 + 详情
        results = await crawler.search_and_get_details("美食", max_notes=3)
        
        # 打印结果
        print("\n📊 最终��果：")
        for idx, note in enumerate(results, 1):
            print(f"\n{idx}. {note['title']}")
            print(f"   作者：{note['user']}")
            print(f"   点赞：{note['likes']}")
            print(f"   收藏：{note['collects']}")
            print(f"   评论：{note['comments']}")
            print(f"   图片：{len(note['images'])} 张")
        
        # 保存结果
        with open('xiaohongshu_hybrid_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 结果已保存：xiaohongshu_hybrid_results.json")
        
    except Exception as e:
        print(f"❌ 异常：{e}")
        import traceback
        traceback.print_exc()
        
    finally:
        await crawler.close()


if __name__ == "__main__":
    asyncio.run(main())
