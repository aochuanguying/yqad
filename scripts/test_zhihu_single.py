"""测试单个知乎 URL 的内容提取"""
from playwright.async_api import async_playwright
import asyncio
import json

async def fetch_post_content(url):
    """使用 Playwright 打开知乎 URL，提取标题、正文和正文中的图片"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled", "--no-sandbox"])
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # 添加 Cookie 以绕过安全验证
        await context.add_cookies([
            {
                'name': '_xsrf',
                'value': 'aMuDuX6dn2N04PT0brZKeE1Nq2lDc6T7',
                'domain': '.zhihu.com',
                'path': '/'
            },
            {
                'name': '_zap',
                'value': 'afab89c8-fe7f-48db-8401-1a2c061f94ad',
                'domain': '.zhihu.com',
                'path': '/'
            },
            {
                'name': 'd_c0',
                'value': 'fzaYD47FghyPTg84x0tinv6O4MI-CM4uXIk=|1782592277',
                'domain': '.zhihu.com',
                'path': '/'
            },
            {
                'name': 'z_c0',
                'value': '2|1:0|10:1782592323|4:z_c0|92:Mi4xWkF2b0FRQUFBQUJfTnBnUGpzV0NIQ1lBQUFCZ0FsVk5RNEV0YXdEcFJ0SXJ5ejhNZUFQaUZhTUtRMi1wZC1xRnNn|fe4ae0993b90bc517f9a72088bfd465ee86a8a22e5932dd9dca6913fcd6bfd70',
                'domain': '.zhihu.com',
                'path': '/'
            },
            {
                'name': '__zse_ck',
                'value': '005_Fk52dqG9F7ydd6pMKAnaWtxh8vHWmVfE2TeuEc1vK13Z00ytoVkpQ10NbyYO93UeOPxmW2ZZMDGAclpnYNcaZ24WNOJSdic=JIgjm4oHBpyRgnbpZ09nZpwPoTp9hOkE-Qjy2v2+Fj/8dZdPUXU2MmouUFnwRCfIiAPyXycKhtRhJKGirwiHF1sAfBdbD8JhdfGGLnXWKRYoMNFAUWX06g5nM2DZ5qTbxTMIlGnDLLsS9UbLhk1CTBTCcjFhys2/2',
                'domain': '.zhihu.com',
                'path': '/'
            }
        ])
        
        page = await context.new_page()
        
        print(f"🔍 打开页面：{url}")
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(3000)
        
        # 滚动页面以触发懒加载图片
        print("📜 滚动页面加载懒加载内容...")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(2000)
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(2000)
        
        # 检查页面标题
        title = await page.title()
        print(f"📄 页面标题：{title}")
        
        # 尝试多个选择器
        content_selectors = [
            '.QuestionRichText-new',
            '.RichText-cms',
            '.Post-RichText',
            '.Post-content',
            '.AnswerCard .RichText',
            '.RichText',
            'article',
            '[class*="Post"]'
        ]
        
        content_html = None
        used_selector = None
        
        for selector in content_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    content_html = await element.inner_html()
                    used_selector = selector
                    print(f"✅ 使用选择器：{selector}")
                    break
            except:
                continue
        
        if not content_html:
            print("⚠️ 所有选择器都失败了，使用完整 HTML")
            content_html = await page.content()
        
        # 提取文本
        if used_selector:
            element = await page.query_selector(used_selector)
            content_text = await element.inner_text() if element else ""
        else:
            content_text = await page.inner_text("body")
        
        # 提取图片
        if used_selector:
            element = await page.query_selector(used_selector)
            imgs = await element.query_selector_all('img') if element else []
        else:
            imgs = await page.query_selector_all('img')
        
        print(f"\n🖼️ 找到 {len(imgs)} 张图片")
        
        images = []
        for i, img in enumerate(imgs):
            src = await img.get_attribute('src')
            data_src = await img.get_attribute('data-src')
            original_src = await img.get_attribute('data-original')
            
            print(f"  图片{i+1}: src={src[:80] if src else 'None'}, data-src={data_src[:80] if data_src else 'None'}")
            
            # 优先使用 data-src 或 data-original
            final_src = data_src or original_src or src
            
            if final_src and is_valid_content_image(final_src):
                images.append(final_src)
        
        await browser.close()
        
        return {
            "success": True,
            "url": url,
            "title": title,
            "content": content_text[:500] + "..." if len(content_text) > 500 else content_text,
            "content_length": len(content_text),
            "images": images[:10],  # 最多 10 张
            "image_count": len(images)
        }

def is_valid_content_image(src):
    """判断是否是正文图片（过滤头像、图标、表情、二维码等）"""
    src_lower = src.lower()
    
    # 过滤关键词
    filter_keywords = ["avatar", "badge", "icon", "thumb", "emoji", "face", "qrcode", "blank", "loading", "default", "logo"]
    if any(kw in src_lower for kw in filter_keywords):
        return False
    
    # 过滤特定路径（但保留知乎正文图片的 v2- 路径）
    filter_paths = ["/creator/packages/", "/fe/common/", "/static/"]
    if any(path in src_lower for path in filter_paths):
        return False
    
    # 过滤 50/v2-（这是知乎的缩略图路径）
    if "/50/v2-" in src_lower:
        return False
    
    # 过滤 GIF 和 SVG（通常是图标/表情）
    if src_lower.endswith(('.gif', '.svg')):
        return False
    
    return True

if __name__ == "__main__":
    url = "https://zhuanlan.zhihu.com/p/2031378767277504021"
    result = asyncio.run(fetch_post_content(url))
    print("\n=== 结果 ===")
    print(json.dumps(result, ensure_ascii=False, indent=2))
