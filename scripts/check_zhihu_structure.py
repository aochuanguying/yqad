"""检查知乎页面实际结构的调试脚本"""
from playwright.async_api import async_playwright
import asyncio
import json

async def check_structure(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled", "--no-sandbox"])
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        print(f"🔍 打开页面：{url}")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(3000)
        
        # 获取完整 HTML
        html = await page.content()
        
        # 尝试所有可能的选择器
        selectors = [
            '.QuestionRichText-new',
            '.RichText-cms',
            '.Post-RichText',
            '.Post-content',
            '.AnswerCard .RichText',
            '.RichText',
            '[class*="RichText"]',
            '[class*="Post"]',
            '[class*="Content"]'
        ]
        
        print("\n📋 检查选择器:")
        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                if elements:
                    print(f"✅ {selector}: 找到 {len(elements)} 个元素")
                    for i, el in enumerate(elements[:2]):
                        text = await el.inner_text()
                        print(f"   - 元素{i+1}: 文本长度={len(text)}, 标签={await el.evaluate('el => el.tagName')}")
                        
                        # 检查是否有图片
                        imgs = await el.query_selector_all('img')
                        if imgs:
                            print(f"   - 包含 {len(imgs)} 张图片")
                            for j, img in enumerate(imgs[:3]):
                                src = await img.get_attribute('src')
                                data_src = await img.get_attribute('data-src')
                                print(f"     图片{j+1}: src={src[:50] if src else 'None'}, data-src={data_src[:50] if data_src else 'None'}")
            except Exception as e:
                print(f"❌ {selector}: {str(e)}")
        
        # 保存 HTML 到文件供分析
        with open('scripts/zhihu_sample.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"\n💾 已保存 HTML 样本到 scripts/zhihu_sample.html")
        
        await browser.close()

if __name__ == "__main__":
    url = "https://zhuanlan.zhihu.com/p/2031378767277504021"
    asyncio.run(check_structure(url))
