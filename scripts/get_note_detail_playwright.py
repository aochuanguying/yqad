#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 Playwright 获取小红书笔记详情
通过搜索获取笔记列表，然后访问详情页提取完整内容
"""

import sys
import json
import time
import random
import re
from pathlib import Path
from playwright.asyncio import async_playwright
from typing import Optional, Dict, Any
import requests
from xhshow import Xhshow


def extract_cookie_value(cookie: str, key: str) -> Optional[str]:
    """从 Cookie 字符串中提取特定值"""
    for item in cookie.split(';'):
        if '=' in item:
            k, v = item.split('=', 1)
            if k.strip() == key:
                return v.strip()
    return None


def search_notes(keyword: str, cookie: str, limit: int = 1) -> Optional[Dict[str, Any]]:
    """使用 xhshow 搜索笔记，获取 note_id 和 xsec_token"""
    try:
        # Cookie 处理
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        a1_value = cookie_dict.get('a1')
        if not a1_value:
            return {'success': False, 'error': '无法提取 a1'}
        
        # 随机休眠
        time.sleep(random.uniform(1, 3))
        
        # 初始化 xhshow
        client = Xhshow()
        search_id = client.get_search_id()
        
        # API 端点
        url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
        uri = "/api/sns/web/v2/search/notes"
        
        payload = {
            "keyword": keyword,
            "page": 1,
            "page_size": max(limit, 10),
            "search_id": search_id,
            "sort": "general",
            "note_type": 0
        }
        
        # 生成 headers
        headers = client.sign_headers(
            method="POST",
            uri=uri,
            cookies=cookie_dict,
            payload=payload,
            x_rap=False
        )
        
        headers.update({
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json, text/plain, */*",
        })
        
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                items = result.get('data', {}).get('items', [])
                if items:
                    # 提取第一条笔记的信息
                    item = items[0]
                    note_card = item.get('note_card', {})
                    note_id = item.get('id', '')
                    
                    # 提取 xsec_token (从多个可能的位置)
                    xsec_token = item.get('xsec_token')
                    if not xsec_token:
                        xsec_token = note_card.get('xsec_token')
                    if not xsec_token:
                        user = note_card.get('user', {})
                        xsec_token = user.get('xsec_token')
                    
                    return {
                        'success': True,
                        'note_id': note_id,
                        'xsec_token': xsec_token or '',
                        'title': note_card.get('display_title', '') or note_card.get('title', ''),
                        'user': note_card.get('user', {})
                    }
                else:
                    return {'success': False, 'error': '搜索结果为空'}
            else:
                return {'success': False, 'error': result.get('msg', '失败')}
        else:
            return {'success': False, 'error': f'HTTP {response.status_code}'}
    
    except Exception as e:
        return {'success': False, 'error': str(e)}


async def get_note_detail_from_page(note_id: str, xsec_token: str, cookie: str) -> Optional[Dict[str, Any]]:
    """使用 Playwright 访问详情页，提取完整内容"""
    try:
        # 构建 URL
        url = f"https://www.xiaohongshu.com/explore/{note_id}"
        if xsec_token:
            url += f"?xsec_token={xsec_token}"
        
        # 启动浏览器
        playwright = await async_playwright().start()
        
        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        )
        
        # Cookie 处理
        cookie = re.sub(r'[\r\n\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\s+', ' ', cookie).strip()
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 创建浏览器上下文
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        # 设置 Cookie
        cookies = []
        for key, value in cookie_dict.items():
            cookies.append({
                'name': key,
                'value': value,
                'domain': '.xiaohongshu.com',
                'path': '/',
            })
        
        if cookies:
            await context.add_cookies(cookies)
        
        page = await context.new_page()
        
        # 注入 stealth.js (如果存在)
        stealth_path = Path(__file__).parent.parent / 'stealth.min.js'
        if stealth_path.exists():
            stealth_content = stealth_path.read_text(encoding='utf-8')
            await page.add_init_script(source=stealth_content)
        
        # 访问页面
        await page.goto(url, wait_until='networkidle', timeout=30000)
        
        # 等待页面加载
        await page.wait_for_timeout(3000)
        
        # 检查是否显示"笔记暂时无法浏览"
        try:
            error_element = await page.query_selector('text=笔记暂时无法浏览')
            if error_element:
                await browser.close()
                return {'success': False, 'error': '笔记暂时无法浏览，可能需要登录或笔记已被删除'}
        except:
            pass
        
        # 提取页面内容
        try:
            # 等待标题加载
            await page.wait_for_selector('.title', timeout=5000)
        except:
            pass
        
        # 使用 JavaScript 提取内容
        note_data = await page.evaluate('''() => {
            const data = {
                title: '',
                desc: '',
                user: '',
                likes: '',
                collects: '',
                comments: '',
                images: []
            };
            
            // 提取标题
            const titleEl = document.querySelector('.title') || 
                           document.querySelector('[class*="title"]') ||
                           document.querySelector('h1');
            if (titleEl) {
                data.title = titleEl.textContent.trim();
            }
            
            // 提取描述/内容
            const descEl = document.querySelector('.desc') || 
                          document.querySelector('[class*="desc"]') ||
                          document.querySelector('[class*="content"]') ||
                          document.querySelector('article');
            if (descEl) {
                data.desc = descEl.textContent.trim();
            }
            
            // 提取用户信息
            const userEl = document.querySelector('.user-name') ||
                          document.querySelector('[class*="user"]') ||
                          document.querySelector('[class*="author"]');
            if (userEl) {
                data.user = userEl.textContent.trim();
            }
            
            // 提取互动数据
            const likeEl = document.querySelector('[class*="like"] span') ||
                          document.querySelector('[class*="interact"] span');
            if (likeEl) {
                data.likes = likeEl.textContent.trim();
            }
            
            const collectEl = document.querySelector('[class*="collect"] span');
            if (collectEl) {
                data.collects = collectEl.textContent.trim();
            }
            
            const commentEl = document.querySelector('[class*="comment"] span');
            if (commentEl) {
                data.comments = commentEl.textContent.trim();
            }
            
            // 提取图片
            const imgEls = document.querySelectorAll('img[src]');
            data.images = Array.from(imgEls)
                .map(img => img.src)
                .filter(src => src && src.startsWith('http'))
                .slice(0, 10); // 最多 10 张图
            
            return data;
        }''')
        
        await browser.close()
        
        # 检查是否提取到有效数据
        if not note_data.title and not note_data.desc:
            return {'success': False, 'error': '无法从页面提取内容'}
        
        return {
            'success': True,
            'note_id': note_id,
            'data': {
                'id': note_id,
                'title': note_data.get('title', ''),
                'desc': note_data.get('desc', ''),
                'user': {'nickname': note_data.get('user', '')},
                'interact_info': {
                    'liked_count': note_data.get('likes', '0'),
                    'collected_count': note_data.get('collects', '0'),
                    'comment_count': note_data.get('comments', '0')
                },
                'images': note_data.get('images', []),
                'url': f"https://www.xiaohongshu.com/explore/{note_id}"
            }
        }
        
    except Exception as e:
        try:
            await browser.close()
        except:
            pass
        return {'success': False, 'error': f'Playwright 错误：{str(e)}'}


async def main():
    """主函数"""
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': '用法：python3 get_note_detail_playwright.py <keyword> <cookie> [note_id]'
        }))
        sys.exit(1)
    
    keyword = sys.argv[1]
    cookie = sys.argv[2]
    note_id = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        # 1. 如果没有提供 note_id，先搜索获取
        if not note_id:
            search_result = search_notes(keyword, cookie, 1)
            
            if not search_result or not search_result.get('success'):
                print(json.dumps({
                    'success': False,
                    'error': f'搜索失败：{search_result.get("error", "未知错误")}' if search_result else '搜索失败'
                }))
                return
            
            note_id = search_result.get('note_id', '')
            xsec_token = search_result.get('xsec_token', '')
            
            if not note_id:
                print(json.dumps({
                    'success': False,
                    'error': '无法从搜索结果中提取笔记 ID'
                }))
                return
        else:
            # 如果提供了 note_id，使用空的 xsec_token 尝试
            xsec_token = ''
        
        # 2. 使用 Playwright 获取详情
        detail_result = await get_note_detail_from_page(note_id, xsec_token, cookie)
        
        # 3. 输出结果
        print(json.dumps(detail_result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'程序错误：{str(e)}'
        }))


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
