#!/usr/bin/env python3
"""
汽车之家搜索脚本
使用 Playwright 搜索汽车之家论坛帖子并获取内容

用法:
  python3 test_autohome.py <关键词> <最大结果数> [--fetch-content]
  python3 test_autohome.py --detail <帖子URL>
"""

import sys
import json
import time
import asyncio
from playwright.async_api import async_playwright

# 搜索 API URL
SEARCH_API = "https://sou.api.autohome.com.cn/v1/search"
SEARCH_URL = "https://sou.autohome.com.cn"


async def search_posts(keyword: str, max_results: int = 10, fetch_content: bool = False):
    """搜索汽车之家帖子"""
    results = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            # 访问搜索页面
            search_url = f"{SEARCH_URL}?q={keyword}"
            await page.goto(search_url, wait_until='networkidle', timeout=20000)
            await page.wait_for_timeout(5000)
            
            # 提取搜索结果（2025 年新版页面结构）
            posts = await page.evaluate('''() => {
                const items = [];
                const maxResults = ''' + str(max_results) + ''';
                
                // 新版页面结构：通过论坛帖子链接定位
                const postLinks = document.querySelectorAll('a[href*="club.autohome.com.cn/bbs"]');
                
                postLinks.forEach((linkEl) => {
                    if (items.length >= maxResults) return;
                    
                    const title = linkEl.textContent?.trim() || '';
                    const url = linkEl.href || '';
                    
                    if (!title || !url) return;
                    
                    // 找到帖子卡片容器（向上遍历找到包含回复数等信息的父元素）
                    let card = linkEl.parentElement;
                    for (let i = 0; i < 5 && card; i++) {
                        const text = card.textContent || '';
                        if (text.includes('回复') || text.includes('浏览')) break;
                        card = card.parentElement;
                    }
                    
                    const cardText = card ? card.textContent.trim() : '';
                    
                    // 从卡片文本中提取回复数
                    const replyMatch = cardText.match(/(\d+)\s*个?\s*回复/);
                    const replies = replyMatch ? parseInt(replyMatch[1]) : 0;
                    
                    // 从卡片文本中提取浏览数
                    const viewMatch = cardText.match(/浏览\s*[:：]?\s*(\d+)/);
                    const views = viewMatch ? parseInt(viewMatch[1]) : 0;
                    
                    // 从卡片文本中提取时间
                    const timeMatch = cardText.match(/(\d{2,4}[-/]\d{1,2}[-/]\d{1,2})/);
                    const publish_time = timeMatch ? timeMatch[1] : '';
                    
                    items.push({ title, url, author: '', replies, views, publish_time });
                });
                
                return items;
            }''')
            
            results = posts
            
            # 如果需要获取正文内容
            if fetch_content and results:
                for i, post in enumerate(results[:min(2, len(results))]):
                    try:
                        content = await fetch_post_content(browser, post['url'])
                        post['content'] = content
                        await asyncio.sleep(2)
                    except Exception as e:
                        post['content'] = ''
                        print(f"获取正文失败 ({post['url']}): {e}", file=sys.stderr)
            
        except Exception as e:
            print(f"搜索失败: {e}", file=sys.stderr)
        finally:
            await browser.close()
    
    return results


async def fetch_post_content(browser, post_url: str) -> str:
    """获取帖子正文内容"""
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    )
    page = await context.new_page()
    
    try:
        await page.goto(post_url, wait_until='networkidle', timeout=20000)
        await page.wait_for_timeout(3000)
        
        # 使用精准选择器提取正文
        content = await page.evaluate('''() => {
            const postContent = document.querySelector('.fn-main .post, .post-content, .article-content, .tz-content');
            if (postContent) {
                return postContent.textContent.trim();
            }
            
            // 备用选择器
            const altContent = document.querySelector('.con-main, .rcon, .xgt-content');
            if (altContent) {
                return altContent.textContent.trim();
            }
            
            return '';
        }''')
        
        return content
    except Exception as e:
        print(f"获取正文异常: {e}", file=sys.stderr)
        return ''
    finally:
        await context.close()


async def get_post_detail(post_url: str):
    """获取单个帖子详情"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        try:
            content = await fetch_post_content(browser, post_url)
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            page = await context.new_page()
            
            await page.goto(post_url, wait_until='networkidle', timeout=20000)
            await page.wait_for_timeout(2000)
            
            # 提取帖子信息
            info = await page.evaluate('''() => {
                const title = document.querySelector('.title, h1, .post-title')?.textContent?.trim() || '';
                const author = document.querySelector('.author, .user-name')?.textContent?.trim() || '';
                const likes = parseInt(document.querySelector('.likes, .like-count')?.textContent) || 0;
                const comments = parseInt(document.querySelector('.replies, .reply-count')?.textContent) || 0;
                const images = Array.from(document.querySelectorAll('.post img, .content img')).map(img => img.src);
                
                return { title, author, likes, comments, images };
            }''')
            
            await context.close()
            await browser.close()
            
            return {
                "success": True,
                "data": {
                    "id": post_url.split('/')[-1].replace('.html', ''),
                    "title": info.get('title', ''),
                    "content": content,
                    "author": info.get('author', ''),
                    "likes": info.get('likes', 0),
                    "comments": info.get('comments', 0),
                    "images": info.get('images', []),
                    "url": post_url
                }
            }
        except Exception as e:
            await browser.close()
            return {
                "success": False,
                "error": str(e)
            }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少参数"}))
        sys.exit(1)
    
    # 获取帖子详情模式
    if sys.argv[1] == '--detail':
        if len(sys.argv) < 3:
            print(json.dumps({"success": False, "error": "缺少帖子URL"}))
            sys.exit(1)
        
        post_url = sys.argv[2]
        result = asyncio.run(get_post_detail(post_url))
        print(json.dumps(result, ensure_ascii=False))
        return
    
    # 搜索模式
    keyword = sys.argv[1]
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    fetch_content = '--fetch-content' in sys.argv
    
    results = asyncio.run(search_posts(keyword, max_results, fetch_content))
    
    print(json.dumps({
        "success": True,
        "results": results,
        "total": len(results)
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
