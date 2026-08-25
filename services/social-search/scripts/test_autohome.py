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
import os
import base64
import asyncio
from urllib.parse import quote
from playwright.async_api import async_playwright

# 搜索 API URL
SEARCH_API = "https://sou.api.autohome.com.cn/v1/search"
SEARCH_URL = "https://sou.autohome.com.cn"

# base64 图片临时保存目录
TEMP_IMG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_images")


def save_base64_image(data_url: str) -> str:
    """将 base64 图片保存为文件，返回文件路径"""
    try:
        # 解析 data:image/jpeg;base64,xxx
        header, data = data_url.split(',', 1)
        ext = '.jpg'
        if 'png' in header:
            ext = '.png'
        elif 'gif' in header:
            ext = '.gif'
        elif 'webp' in header:
            ext = '.webp'
        
        os.makedirs(TEMP_IMG_DIR, exist_ok=True)
        filename = f"autohome_{int(time.time() * 1000)}{ext}"
        filepath = os.path.join(TEMP_IMG_DIR, filename)
        
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(data))
        
        return filepath
    except Exception as e:
        print(f"保存 base64 图片失败: {e}", file=sys.stderr)
        return ''


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
            # 访问搜索页面（汽车之家使用 GBK 编码）
            encoded_keyword = quote(keyword.encode('gbk'))
            search_url = f"{SEARCH_URL}?q={encoded_keyword}"
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
            
            # 如果需要获取正文内容和图片
            if fetch_content and results:
                for i, post in enumerate(results[:min(3, len(results))]):
                    try:
                        detail = await fetch_post_content(browser, post['url'])
                        post['content'] = detail.get('content', '')
                        post['images'] = detail.get('images', [])
                        await asyncio.sleep(2)
                    except Exception as e:
                        post['content'] = ''
                        post['images'] = []
                        print(f"获取正文失败 ({post['url']}): {e}", file=sys.stderr)
            
        except Exception as e:
            print(f"搜索失败: {e}", file=sys.stderr)
        finally:
            await browser.close()
    
    return results


async def fetch_post_content(browser, post_url: str) -> dict:
    """获取帖子正文内容和图片"""
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    )
    page = await context.new_page()
    
    try:
        await page.goto(post_url, wait_until='networkidle', timeout=20000)
        await page.wait_for_timeout(3000)
        
        # 提取正文和图片
        js_code = r"""() => {
            let content = '';
            let images = [];
            
            // 策略 1: 精确定位帖子正文区域
            const preciseSelectors = [
                '.consnew',
                '#F0 .w740 .consnew',
                '.fn-main .post',
                '.post-content-main',
            ];
            
            let postContent = null;
            for (const sel of preciseSelectors) {
                postContent = document.querySelector(sel);
                if (postContent && postContent.textContent.trim().length > 30) break;
                postContent = null;
            }
            
            // 策略 2: 降级到更宽泛的选择器
            if (!postContent) {
                const fallbackSelectors = ['.article-content',
                                          '.tz-content', '.con-main', '.rcon',
                                          '#F0 .w740', '#maxwrap-reply .fn-main'];
                for (const sel of fallbackSelectors) {
                    postContent = document.querySelector(sel);
                    if (postContent && postContent.textContent.trim().length > 50) break;
                    postContent = null;
                }
            }
            
            if (postContent) {
                // 移除噪音元素后再提取文本
                const clone = postContent.cloneNode(true);
                
                // 移除已知的噪音节点
                const noiseSelectors = [
                    '.post-handle', '.post-tool', '.post-reply',
                    '.post-handle-bar', '.reply-footer', '.fn-reply',
                    '.post-ip', '.post-report', '.recommend-wrap',
                    '.related-qa', '.post-crumbs', '.post-poptip',
                    '.qualitypost-tip', '.fn-replybox',
                    '[class*="recommend"]', '[class*="related"]',
                    'script', 'style',
                ];
                
                noiseSelectors.forEach(sel => {
                    clone.querySelectorAll(sel).forEach(el => el.remove());
                });
                
                // 提取清理后的文本
                let rawText = clone.textContent || '';
                
                // 用正则移除残留噪音文本
                const noisePatterns = [
                    /只看楼主\s*/g,
                    /修改帖子\s*/g,
                    /热门标准[\s\S]*?综合评判\s*/g,
                    /点击查看热门标准[\s\S]*?综合评判\s*/g,
                    /发布于\s*\S+\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}:\d{2}\s*/g,
                    /内容系网友发布[\s\S]*?可联系客服删除。?\s*/g,
                    /汽车之家温馨提示您[\s\S]*?处理违规用户与内容\s*/g,
                    /Ctrl\s*\+\s*Enter\s*发表\s*/g,
                    /发表回复\s*/g,
                    /举报\s*/g,
                    /很抱歉，该主帖[\s\S]*?修改主帖\s*/g,
                    /更多>\s*相关推荐[\s\S]*/g,
                    /最后编辑于\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}:\d{2}\s*/g,
                    /^\s*\d+\s+\d+\s*$/gm,
                    /IP\s*$/gm,
                    /^\s*回复\s*$/gm,
                    /^\s*用车经验\s*$/gm,
                    /^\s*油价[\/／]油耗\s*$/gm,
                    /^\s*购车\s*$/gm,
                    /^\s*保养\s*$/gm,
                    /^\s*装饰改装\s*$/gm,
                    /^\s*自驾游\s*$/gm,
                ];
                
                noisePatterns.forEach(pattern => {
                    rawText = rawText.replace(pattern, '');
                });
                
                // 清理多余空白
                content = rawText
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .join('\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                
                // 提取图片（从原始 DOM）
                const imgEls = postContent.querySelectorAll('img');
                for (const img of imgEls) {
                    const dataSrc = img.getAttribute('data-src') || '';
                    const dataOriginal = img.getAttribute('data-original') || '';
                    let src = img.src || img.getAttribute('src') || '';
                    
                    const exclude = ['blank', 'avatar', 'icon', 'logo', 'emoji', 'smiley', 'face', 'loading', 'key.jpg', 'getimg', 'topic-blank'];
                    let url = dataSrc || dataOriginal || src;
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (!url || !url.startsWith('http')) continue;
                    if (exclude.some(p => url.toLowerCase().includes(p))) continue;
                    if (url.includes('autoimg.cn') && url.includes('album')) {
                        images.push(url);
                    }
                }
            }
            
            // 如果主选择器没拿到图片，扩大范围
            if (images.length === 0) {
                const allImgs = document.querySelectorAll('#F0 img, .fn-main img');
                for (const img of allImgs) {
                    let src = img.getAttribute('src') || '';
                    if (src.startsWith('//')) src = 'https:' + src;
                    if (src.includes('autoimg.cn') && src.includes('album')) {
                        images.push(src);
                    }
                }
            }
            
            return { content, images };
        }"""
        result = await page.evaluate(js_code)
        
        return result
    except Exception as e:
        print(f"获取正文异常: {e}", file=sys.stderr)
        return {'content': '', 'images': []}
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
            detail = await fetch_post_content(browser, post_url)
            content = detail.get('content', '')
            images_from_content = detail.get('images', [])
            
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
                
                return { title, author, likes, comments };
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
                    "images": images_from_content,
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
