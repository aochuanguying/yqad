#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小红书笔记详情获取 - Playwright 版本
使用 Playwright 访问小红书网页获取笔记详情
"""

import sys
import json
import re
from playwright.sync_api import sync_playwright

def get_note_detail_by_playwright(note_id: str, cookie: str = None):
    """
    使用 Playwright 获取小红书笔记详情
    
    Args:
        note_id: 笔记 ID
        cookie: 小红书 Cookie（可选，用于登录态）
        
    Returns:
        dict: 笔记详情
    """
    try:
        note_url = f"https://www.xiaohongshu.com/explore/{note_id}"
        
        with sync_playwright() as p:
            # 启动浏览器
            browser = p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            
            # 创建上下文
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
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
            page.goto(note_url, wait_until='networkidle', timeout=30000)
            
            # 等待页面加载
            page.wait_for_timeout(5000)
            
            # 提取笔记内容
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
                
                // 提取标题
                const titleEl = document.querySelector('h1.title');
                if (titleEl) {
                    result.title = titleEl.textContent.trim();
                }
                
                // 提取描述
                const descEl = document.querySelector('.desc');
                if (descEl) {
                    result.desc = descEl.textContent.trim();
                }
                
                // 提取作者
                const authorEl = document.querySelector('.author-name');
                if (authorEl) {
                    result.author = authorEl.textContent.trim();
                }
                
                // 提取互动数据
                const likeEl = document.querySelector('[data-type="like"] .count');
                if (likeEl) {
                    result.likes = parseInt(likeEl.textContent.trim()) || 0;
                }
                
                const collectEl = document.querySelector('[data-type="collect"] .count');
                if (collectEl) {
                    result.collects = parseInt(collectEl.textContent.trim()) || 0;
                }
                
                const commentEl = document.querySelector('[data-type="comment"] .count');
                if (commentEl) {
                    result.comments = parseInt(commentEl.textContent.trim()) || 0;
                }
                
                // 提取图片
                const imageEls = document.querySelectorAll('.album-item img');
                imageEls.forEach(img => {
                    const src = img.getAttribute('src') || img.getAttribute('data-src');
                    if (src) {
                        result.images.push(src);
                    }
                });
                
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
        return {
            'success': False,
            'error': str(e),
            'note_id': note_id
        }

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法：python3 test_xiaohongshu_playwright.py <note_id> [cookie]")
        print("\n示例:")
        print("  python3 test_xiaohongshu_playwright.py 69bc895d0000000021004944")
        sys.exit(1)
    
    note_id = sys.argv[1]
    cookie = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"\n{'='*60}")
    print(f"使用 Playwright 获取小红书笔记详情")
    print(f"{'='*60}\n")
    
    result = get_note_detail_by_playwright(note_id, cookie)
    
    if result.get('success'):
        print("✅ 笔记详情获取成功！\n")
        data = result['data']
        
        print(f"标题：{data.get('title', 'N/A')}")
        print(f"作者：{data.get('author', 'N/A')}")
        print(f"描述：{data.get('desc', 'N/A')[:200]}...")
        print(f"点赞：{data.get('likes', 0)}")
        print(f"收藏：{data.get('collects', 0)}")
        print(f"评论：{data.get('comments', 0)}")
        print(f"图片数量：{len(data.get('images', []))}")
        print(f"链接：{result['url']}")
    else:
        print(f"❌ 获取失败：{result.get('error')}")

if __name__ == '__main__':
    main()
