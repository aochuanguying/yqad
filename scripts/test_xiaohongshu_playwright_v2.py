#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书笔记详情获取 - Playwright V2 版本
改进：更好的等待策略和数据提取
"""

import sys
import json
import time
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

def get_note_detail_v2(note_id: str, cookie: str = None):
    """
    使用 Playwright 获取小红书笔记详情（改进版）
    """
    try:
        note_url = f"https://www.xiaohongshu.com/explore/{note_id}"
        
        with sync_playwright() as p:
            # 启动浏览器
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            )
            
            # 创建上下文
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080}
            )
            
            # 设置 Cookie（如果提供）
            if cookie:
                cookie_dict = []
                for item in cookie.split(';'):
                    if '=' in item:
                        key, value = item.split('=', 1)
                        cookie_dict.append({
                            'name': key.strip(),
                            'value': value.strip(),
                            'domain': '.xiaohongshu.com',
                            'path': '/'
                        })
                context.add_cookies(cookie_dict)
            
            # 打开页面
            page = context.new_page()
            
            # 访问笔记页面
            print(f"正在访问：{note_url}")
            page.goto(note_url, wait_until='domcontentloaded', timeout=30000)
            
            # 等待页面主要内容加载
            try:
                # 等待笔记容器出现
                page.wait_for_selector('.note-container', timeout=10000)
                print("✅ 页面主要内容已加载")
            except PlaywrightTimeout:
                print("⚠️ 等待超时，尝试继续...")
            
            # 额外等待
            page.wait_for_timeout(5000)
            
            # 获取页面 HTML（用于调试）
            html = page.content()
            print(f"页面 HTML 长度：{len(html)}")
            
            # 尝试多种方式提取数据
            note_data = page.evaluate('''() => {
                const result = {
                    title: '',
                    desc: '',
                    author: '',
                    likes: 0,
                    collects: 0,
                    comments: 0,
                    images: []
                };
                
                // 方式 1: 使用 data 属性
                const noteElement = document.querySelector('[data-note-id]');
                if (noteElement) {
                    result.noteId = noteElement.getAttribute('data-note-id');
                }
                
                // 方式 2: 查找标题（多种选择器）
                const titleSelectors = [
                    'h1.title',
                    '.title',
                    '[data-title]',
                    'h2.title',
                    '.note-header h1'
                ];
                for (const selector of titleSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                        result.title = el.textContent.trim();
                        break;
                    }
                }
                
                // 方式 3: 查找描述
                const descSelectors = [
                    '.desc',
                    '.content',
                    '[data-desc]',
                    '.note-content',
                    'article p'
                ];
                for (const selector of descSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                        result.desc = el.textContent.trim();
                        break;
                    }
                }
                
                // 方式 4: 查找作者
                const authorSelectors = [
                    '.author-name',
                    '.username',
                    '[data-author]',
                    '.user-name',
                    '.nickname'
                ];
                for (const selector of authorSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                        result.author = el.textContent.trim();
                        break;
                    }
                }
                
                // 方式 5: 查找互动数据
                const actionItems = document.querySelectorAll('.action-item');
                actionItems.forEach(item => {
                    const text = item.textContent || '';
                    const count = item.querySelector('.count')?.textContent || '0';
                    
                    if (text.includes('点赞') || text.includes('like')) {
                        result.likes = parseInt(count) || 0;
                    } else if (text.includes('收藏') || text.includes('collect')) {
                        result.collects = parseInt(count) || 0;
                    } else if (text.includes('评论') || text.includes('comment')) {
                        result.comments = parseInt(count) || 0;
                    }
                });
                
                // 方式 6: 查找图片
                const imageSelectors = [
                    '.album-item img',
                    '.note-image img',
                    '[data-image]',
                    'article img'
                ];
                for (const selector of imageSelectors) {
                    const imgs = document.querySelectorAll(selector);
                    if (imgs.length > 0) {
                        imgs.forEach(img => {
                            const src = img.getAttribute('src') || img.getAttribute('data-src');
                            if (src && !src.startsWith('data:')) {
                                result.images.push(src);
                            }
                        });
                        break;
                    }
                }
                
                return result;
            }''')
            
            # 关闭浏览器
            browser.close()
            
            # 返回结果
            return {
                'success': True,
                'note_id': note_id,
                'url': note_url,
                'data': note_data
            }
            
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'note_id': note_id,
            'traceback': traceback.format_exc()
        }

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法：python3 test_xiaohongshu_playwright_v2.py <note_id> [cookie]")
        print("\n示例:")
        print("  python3 test_xiaohongshu_playwright_v2.py 69bc895d0000000021004944")
        sys.exit(1)
    
    note_id = sys.argv[1]
    cookie = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"\n{'='*60}")
    print(f"使用 Playwright V2 获取小红书笔记详情")
    print(f"{'='*60}\n")
    
    result = get_note_detail_v2(note_id, cookie)
    
    if result.get('success'):
        print("✅ 笔记详情获取成功！\n")
        data = result['data']
        
        print(f"标题：{data.get('title', 'N/A') or '未找到'}")
        print(f"作者：{data.get('author', 'N/A') or '未找到'}")
        print(f"描述：{data.get('desc', 'N/A') or '未找到'}")
        print(f"点赞：{data.get('likes', 0)}")
        print(f"收藏：{data.get('collects', 0)}")
        print(f"评论：{data.get('comments', 0)}")
        print(f"图片数量：{len(data.get('images', []))}")
        print(f"链接：{result['url']}")
        
        # 如果有图片，显示第一张
        if data.get('images'):
            print(f"图片预览：{data['images'][0][:100]}...")
    else:
        print(f"❌ 获取失败：{result.get('error')}")
        if result.get('traceback'):
            print(f"\n详细错误:\n{result['traceback']}")

if __name__ == '__main__':
    main()
