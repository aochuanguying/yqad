#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知乎内容提取脚本
1. 使用知乎开放平台搜索 API 获取帖子列表
2. 使用 Playwright 打开知乎 URL 获取正文内容和图片
"""

import sys
import json
import asyncio
import requests
from urllib.parse import urlencode

# 知乎开放平台搜索 API
SEARCH_API = "https://developer.zhihu.com/api/v1/content/zhihu_search"

# 通用请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
}


def is_valid_content_image(src):
    """
    判断是否是正文图片（过滤头像、图标、表情、二维码等）
    
    Args:
        src: 图片 URL
    
    Returns:
        bool: True 表示是正文图片，False 表示需要过滤
    """
    src_lower = src.lower()
    
    # 过滤关键词
    filter_keywords = [
        "avatar",        # 头像
        "badge",         # 徽章
        "icon",          # 图标
        "thumb",         # 缩略图
        "small",         # 小图
        "emoji",         # 表情
        "face",          # 表情
        "qrcode",        # 二维码
        "blank",         # 空白占位图
        "loading",       # 加载图
        "default",       # 默认图
        "logo",          # Logo
    ]
    
    # 如果包含过滤关键词，直接返回 False
    if any(kw in src_lower for kw in filter_keywords):
        return False
    
    # 过滤特定域名/路径
    filter_paths = [
        "/v2-",                  # 知乎头像/徽章 CDN 路径
        "/50/v2-",               # 小尺寸头像
        "/creator/packages/",    # 创作者中心资源
        "/fe/common/",           # 前端通用资源
        "/static/",              # 静态资源
    ]
    
    if any(path in src_lower for path in filter_paths):
        return False
    
    # 过滤特定文件类型（非图片）
    if src_lower.endswith(('.gif', '.svg')):
        return False
    
    # 只保留常见的图片格式
    if not any(src_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']):
        # 如果没有扩展名，但有 http 开头且包含 zhimg（知乎图片 CDN），也认为是图片
        if 'zhimg.com' not in src_lower:
            return False
    
    # 过滤太小的图片（可能是图标）
    if '100x100' in src_lower or '50x50' in src_lower:
        return False
    
    return True


def search_zhihu(access_secret, keyword, limit=50):
    """
    搜索知乎内容（仅搜索，不获取正文）
    
    Args:
        access_secret: 知乎 Access Secret
        keyword: 搜索关键词
        limit: 期望返回的最大结果数
    
    Returns:
        dict: {"success": bool, "results": [...], "total": int, "error": str}
    """
    try:
        import time
        import uuid
        
        all_results = []
        page_size = 10  # 知乎 API 每页最大 10 条
        offset = 0
        
        while len(all_results) < limit:
            timestamp = str(int(time.time()))
            
            params = {
                "Query": keyword,
                "Count": str(page_size),
            }
            
            headers = {
                "Authorization": f"Bearer {access_secret}",
                "X-Request-Timestamp": timestamp,
                "Content-Type": "application/json",
            }
            
            resp = requests.get(SEARCH_API, params=params, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                print(f"❌ 知乎 API 返回错误：HTTP {resp.status_code}")
                break
            
            data = resp.json()
            
            if data.get("Code") != 0:
                print(f"❌ 知乎 API 业务错误：Code={data.get('Code')}, Message={data.get('Message')}")
                break
            
            items = data.get("Data", {}).get("Items", [])
            if not items:
                break
            
            for item in items:
                all_results.append({
                    "title": item.get("Title", ""),
                    "url": item.get("Url", ""),
                    "author": item.get("AuthorName", ""),
                    "likes": item.get("VoteUpCount", 0),
                    "comments": item.get("CommentCount", 0),
                    "content_type": item.get("ContentType", ""),
                    "content_id": item.get("ContentID", ""),
                    "content_text": item.get("ContentText", ""),  # 纯文本摘要
                })
            
            # 如果返回的数据少于页大小，说明已经是最后一页
            if len(items) < page_size:
                break
            
            offset += page_size
            
            # 避免无限循环
            if offset > 100:  # 最多获取 10 页（100 条）
                break
        
        return {"success": True, "results": all_results[:limit], "total": len(all_results[:limit])}
    
    except requests.exceptions.Timeout:
        return {"success": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络错误：{str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"未知错误：{str(e)}"}


async def fetch_post_content_with_retry(url, max_retries=2):
    """
    带重试机制的正文获取函数
    
    Args:
        url: 知乎 URL
        max_retries: 最大重试次数
    
    Returns:
        tuple: (title: str, content: str, images: list)
    """
    retry_delay = 2  # 重试延迟（秒）
    
    for attempt in range(max_retries + 1):
        try:
            result = await fetch_post_content(url)
            # 如果成功获取内容，直接返回
            if result[1]:  # content 不为空
                return result
            
            # 如果第一次尝试没有内容，记录日志并继续重试
            if attempt < max_retries:
                print(f"⚠️ 第 {attempt + 1} 次尝试未获取到内容，{retry_delay}秒后重试...")
                await asyncio.sleep(retry_delay)
                
        except Exception as e:
            if attempt < max_retries:
                print(f"⚠️ 第 {attempt + 1} 次尝试失败：{e}，{retry_delay}秒后重试...")
                await asyncio.sleep(retry_delay)
            else:
                print(f"❌ 所有 {max_retries + 1} 次尝试均失败")
                return "", "", []
    
    return "", "", []


async def fetch_post_content(url):
    """
    使用 Playwright 打开知乎 URL，提取标题、正文和正文中的图片
    
    Args:
        url: 知乎 URL
    
    Returns:
        tuple: (title: str, content: str, images: list)
    
    技术说明:
        - 知乎页面结构：回答在 .AnswerCard 或 .Post-RichText 容器中
        - 自动过滤头像、徽章、表情等非正文图片
        - 支持懒加载图片（滚动页面触发）
        - 包含 fallback 机制
    """
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = await context.new_page()
        
        # 注入 stealth 反检测脚本
        import os
        stealth_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "stealth.min.js"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "../stealth.min.js"),
        ]
        for sp in stealth_paths:
            if os.path.exists(sp):
                with open(sp, "r") as f:
                    await page.add_init_script(f.read())
                print("✓ stealth.min.js 注入成功")
                break
        
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)  # 等待更多内容加载
            
            # 尝试滚动页面以触发懒加载的图片
            try:
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(2)
                await page.evaluate("window.scrollTo(0, 0)")
                await asyncio.sleep(1)
            except Exception:
                pass
            
            # 提取标题
            title = ""
            try:
                # 知乎标题选择器
                title_selectors = [
                    "h1.QuestionHeader-title",      # 问题页标题
                    "h1.Post-Title",                # 专栏文章标题
                    ".CardHeader h2",               # 回答卡片标题
                    "h1",                           # fallback
                ]
                
                for selector in title_selectors:
                    title_element = await page.query_selector(selector)
                    if title_element:
                        title = await title_element.inner_text()
                        title = title.strip()
                        if title:
                            break
            except Exception as e:
                print(f"⚠️ 提取标题失败：{e}")
            
            # 如果没有找到标题，用文本方式提取
            if not title:
                body_text = await page.inner_text("body")
                lines = body_text.split("\n")
                for line in lines:
                    line = line.strip()
                    if 10 < len(line) < 100 and any(kw in line for kw in ["如何", "评价", "体验", "怎么样", "值得"]):
                        title = line
                        break
            
            # 提取正文内容和图片
            content_lines = []
            images = []
            selector_used = ""
            
            # 知乎正文选择器（按优先级排序）
            content_selectors = [
                ".AnswerCard .RichText",            # 回答正文（最常用）
                ".Post-RichText",                   # 专栏文章正文
                ".RichText",                        # 通用富文本
                ".zm-editable-editor-outer",        # 旧版��辑器
                "article",                          # HTML5 article
                ".content",                         # 通用 content
            ]
            
            for selector in content_selectors:
                content_element = await page.query_selector(selector)
                if content_element:
                    selector_used = selector
                    print(f"✓ 使用选择器：'{selector}'")
                    
                    # 提取文本
                    try:
                        content_text = await content_element.inner_text()
                        content_lines = [line.strip() for line in content_text.split("\n") if line.strip() and len(line.strip()) > 5]
                    except Exception as e:
                        print(f"⚠️ 提取文本失败：{e}")
                    
                    # 提取图片
                    try:
                        img_elements = await content_element.query_selector_all("img")
                        print(f"   找到 {len(img_elements)} 张图片")
                        
                        for img in img_elements:
                            try:
                                src = await img.get_attribute("src")
                                if src and src.startswith("http"):
                                    if is_valid_content_image(src):
                                        images.append(src)
                                # 检查 data-src 属性（懒加载图片）
                                data_src = await img.get_attribute("data-src")
                                if data_src and data_src.startswith("http"):
                                    if is_valid_content_image(data_src):
                                        images.append(data_src)
                            except Exception as e:
                                pass
                    except Exception as e:
                        print(f"⚠️ 提取图片失败：{e}")
                    
                    break  # 找到第一个匹配的选择器就退出
            
            if not selector_used:
                print(f"⚠️ 警告：所有选择器都失败了，URL: {url}")
            
            content = "\n".join(content_lines)
            
            print(f"   提取到 {len(content_lines)} 行文本，{len(images)} 张图片")
            
            return title, content, images
        
        except Exception as e:
            print(f"❌ Playwright 执行失败：{e}")
            return "", "", []
        
        finally:
            await browser.close()


async def fetch_multiple_posts(urls, max_concurrent=3):
    """
    并发获取多个帖子的内容
    
    Args:
        urls: URL 列表
        max_concurrent: 最大并发数
    
    Returns:
        list: [{"url": str, "title": str, "content": str, "images": list}, ...]
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def fetch_with_semaphore(url):
        async with semaphore:
            title, content, images = await fetch_post_content_with_retry(url)
            return {
                "url": url,
                "title": title,
                "content": content,
                "images": images,
            }
    
    tasks = [fetch_with_semaphore(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 过滤异常结果
    valid_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"❌ URL {urls[i]} 获取失败：{result}")
        else:
            valid_results.append(result)
    
    return valid_results


def main():
    """
    主函数
    
    用法 1（搜索 + 提取）:
        python test_zhihu_content.py <access_secret> <keyword> <max_results> --fetch-content
    
    用法 2（从 stdin 读取）:
        echo '{"accessSecret": "xxx", "results": [...]}' | python test_zhihu_content.py --from-stdin
    """
    # 模式 2：从 stdin 读取
    if "--from-stdin" in sys.argv:
        try:
            input_data = sys.stdin.read()
            data = json.loads(input_data)
            access_secret = data.get("accessSecret", "")
            results = data.get("results", [])
            
            if not access_secret or not results:
                print(json.dumps({"success": False, "error": "缺少 accessSecret 或 results"}, ensure_ascii=False))
                sys.exit(1)
            
            print(f"从 stdin 读取到 {len(results)} 条结果，开始提取正文...", file=sys.stderr)
            
            # 并发获取
            urls = [r.get("url", "") for r in results if r.get("url")]
            if not urls:
                print(json.dumps({"success": False, "error": "没有可用的 URL"}, ensure_ascii=False))
                sys.exit(1)
            
            content_results = asyncio.run(fetch_multiple_posts(urls, max_concurrent=3))
            
            # 合并结果
            final_results = []
            for i, result in enumerate(results):
                content_result = content_results[i] if i < len(content_results) else {}
                final_results.append({
                    "title": result.get("title", ""),
                    "author": result.get("author", "") or result.get("AuthorName", ""),
                    "url": result.get("url", "") or result.get("Url", ""),
                    "likes": result.get("likes", 0) or result.get("VoteUpCount", 0),
                    "comments": result.get("comments", 0) or result.get("CommentCount", 0),
                    "content_type": result.get("content_type", "") or result.get("ContentType", ""),
                    "content": content_result.get("content", result.get("content_text", "") or result.get("ContentText", "")),
                    "images": content_result.get("images", []),
                })
            
            output = {
                "success": True,
                "total": len(final_results),
                "results": final_results,
            }
            
            print(json.dumps(output, ensure_ascii=False))
            sys.exit(0)
            
        except json.JSONDecodeError as e:
            print(json.dumps({"success": False, "error": f"JSON 解析失败：{str(e)}"}, ensure_ascii=False))
            sys.exit(1)
        except Exception as e:
            print(json.dumps({"success": False, "error": f"未知错误：{str(e)}"}, ensure_ascii=False))
            sys.exit(1)
    
    # 模式 1：命令行参数
    if len(sys.argv) < 4:
        print("用法：python test_zhihu_content.py <access_secret> <keyword> <max_results> [--fetch-content]")
        print("示例：python test_zhihu_content.py 'xxx' '奥迪 Q5L' 5 --fetch-content")
        sys.exit(1)
    
    access_secret = sys.argv[1]
    keyword = sys.argv[2]
    max_results = int(sys.argv[3])
    fetch_content = "--fetch-content" in sys.argv
    
    print(f"开始搜索知乎，关键词：{keyword}, 最大结果数：{max_results}")
    
    # 步骤 1：搜索
    search_result = search_zhihu(access_secret, keyword, max_results)
    
    if not search_result["success"]:
        print(f"❌ 搜索失败：{search_result.get('error', '未知错误')}")
        sys.exit(1)
    
    results = search_result["results"]
    total = search_result["total"]
    
    print(f"✅ 搜索成功，找到 {total} 条结果\n")
    
    # 如果不需要获取正文，直接返回搜索结果
    if not fetch_content:
        output = {
            "success": True,
            "total": total,
            "results": results,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return
    
    # 步骤 2：获取正文内容（带图片）
    print(f"开始获取 {total} 条内容的正文和图片...\n")
    
    urls = [r["url"] for r in results if r.get("url")]
    
    if not urls:
        print("❌ 没有可用的 URL")
        sys.exit(1)
    
    # 并发获取
    content_results = asyncio.run(fetch_multiple_posts(urls, max_concurrent=3))
    
    # 合并搜索结果和正文内容
    final_results = []
    for i, result in enumerate(results):
        content_result = content_results[i] if i < len(content_results) else {}
        final_results.append({
            "title": result.get("title", ""),
            "author": result.get("author", ""),
            "url": result.get("url", ""),
            "likes": result.get("likes", 0),
            "comments": result.get("comments", 0),
            "content_type": result.get("content_type", ""),
            "content": content_result.get("content", result.get("content_text", "")),
            "images": content_result.get("images", []),
        })
    
    # 输出最终结果
    output = {
        "success": True,
        "total": len(final_results),
        "results": final_results,
    }
    
    print("\n" + "=" * 60)
    print("最终结果:")
    print("=" * 60)
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
