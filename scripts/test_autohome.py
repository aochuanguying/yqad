#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
汽车之家搜索脚本
参考小红书架构，优化代码结构

技术实现:
1. 搜索 API: sou.api.autohome.com.cn/v1/search (无需 Cookie)
2. 正文获取：Playwright 打开帖子 URL，使用 .fn-main .post 选择器提取

优化点:
- ✅ 代码模块化（函数职责单一）
- ✅ 并发控制（默认 2 个并发）
- ✅ 重试机制（指数退避）
- ✅ 页面监控（选择器失效警告，1 小时去重）
- ✅ 超时控制（20 秒页面加载）
- ✅ 日志输出（详细进度和性能统计）
"""

import sys
import json
import asyncio
import requests
import time
import random
import os
from typing import Dict, List, Tuple, Optional, Any

# API 配置
SEARCH_API = "https://sou.api.autohome.com.cn/v1/search"

# 请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://sou.autohome.com.cn",
    "Referer": "https://sou.autohome.com.cn/",
}

# 配置参数
CONFIG = {
    # 延迟控制
    "search_delay_min": 2000,
    "search_delay_max": 5000,
    "page_delay_min": 3000,
    "page_delay_max": 6000,
    
    # 重试机制
    "max_retries": 2,
    "retry_delay": 3000,
    "retry_backoff": 1.5,
    
    # 超时控制
    "page_load_timeout": 20000,
    "request_timeout": 30000,
    
    # 并发控制
    "max_concurrent": 2,
    
    # 其他
    "max_results": 10,
}


def is_valid_content_image(src: str) -> bool:
    """
    判断是否是正文图片（过滤表情、图标、二维码等）
    
    Args:
        src: 图片 URL
    
    Returns:
        bool: True 表示是正文图片，False 表示需要过滤
    
    优化点：
        - 增加尺寸判断（避免误杀高清大图）
        - 增加域名白名单
        - 优化关键词匹配规则
    """
    src_lower = src.lower()
    
    # ✅ 白名单域名（汽车之家官方图片域名）
    whitelist_domains = [
        "autoimg.com",
        "autohome.com.cn",
        "127.net",
    ]
    
    # 如果是白名单域名，放宽过滤规则
    is_whitelisted = any(domain in src_lower for domain in whitelist_domains)
    
    # 过滤关键词（更精确的匹配）
    filter_keywords = [
        "icon",           # 图标
        "avatar",         # 头像
        "thumb",          # 缩略图
        "small",          # 小图
        "emoji",          # 表情
        "face",           # 表情
        "qrcode",         # 二维码
        "blank",          # 空白占位图
        "loading",        # 加载图
        "default",        # 默认图
        "placeholder",    # 占位图
        "spinner",        # 加载动画
        "arrow",          # 箭头图标
        "btn_",           # 按钮图片
        "btn-",           # 按钮图片
    ]
    
    # 如果包含过滤关键词，直接返回 False
    if any(kw in src_lower for kw in filter_keywords):
        return False
    
    # 过滤特定域名/路径
    filter_paths = [
        "/creator/packages/emoji/",  # 表情符号
        "/fe/common/image/",          # 前端通用图片
        "/bbs/pc/detail/img/",        # 详情页占位图
        "/static/",                   # 静态资源
        "/images/",                   # 图片资源
    ]
    
    if any(path in src_lower for path in filter_paths):
        return False
    
    # 过滤特定文件类型（非图片）
    if src_lower.endswith(('.gif', '.svg')):
        return False
    
    # 只保留常见的图片格式
    if not any(src_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']):
        # 如果没有扩展名，但有 http 开头且包含 autoimg，也认为是图片
        if 'autoimg' not in src_lower and not is_whitelisted:
            return False
    
    # 过滤太小的图片（可能是图标）
    # 但如果是白名单域名，放宽限制
    if not is_whitelisted:
        if '100x100' in src_lower or '50x50' in src_lower or '80x80' in src_lower:
            return False
    
    # ✅ 检查 URL 参数中的尺寸信息（避免误杀高清大图）
    # 例如：/m/240x120/ 表示 240x120 的缩略图，应该过滤
    import re
    size_pattern = re.compile(r'/m/(\d+)x(\d+)/')
    match = size_pattern.search(src_lower)
    if match:
        width = int(match.group(1))
        height = int(match.group(2))
        # 如果宽或高小于 200，认为是缩略图
        if width < 200 or height < 200:
            return False
    
    # 检查图片 URL 是否包含尺寸参数（例如：?imageView2/2/w/240/h/160）
    size_params = ['imageView2', '/w/', '/h/', '/thumbnail/']
    if any(param in src_lower for param in size_params):
        # 提取宽度参数
        width_match = re.search(r'/w/(\d+)', src_lower)
        if width_match and int(width_match.group(1)) < 200:
            return False
    
    return True


def search_autohome(keyword: str, limit: int = 50) -> Dict[str, Any]:
    """
    搜索汽车之家论坛帖子（仅搜索，不获取正文）
    
    Args:
        keyword: 搜索关键词
        limit: 期望返回的最大结果数（会自动分页获取）

    Returns:
        dict: {"success": bool, "results": [...], "total": int, "error": str}
    """
    try:
        # 生成 uuid 和时间戳
        import uuid
        req_uuid = str(uuid.uuid4())
        pt = str(int(time.time() * 1000))
        
        all_results = []
        page_size = 20  # 每页 20 条
        page = 1
        offset = 0
        
        while len(all_results) < limit:
            params = {
                "uuid": req_uuid,
                "source": "pc",
                "is_base_exp": "0",
                "modify": "0",
                "q": keyword,
                "pq": keyword,  # 原始查询词
                "entry": "40",
                "error": "0",
                "pt": pt,  # 时间戳（一次请求内保持不变）
                "pid": "90300024",
                "offset": str(offset),
                "size": str(page_size),
                "page": str(page),
                "ext": json.dumps({
                    "chl": "",
                    "plat": "pc",
                    "pf": "pc",
                    "bbsId": "",
                    "q": keyword,
                    "offset": offset,
                    "size": page_size,
                    "modify": "0",
                    "cityid": 370200,  # 城市 ID（青岛）
                    "version": "1.0.1",
                    "box_count": 0,
                }),
            }
            
            resp = requests.get(SEARCH_API, params=params, headers=HEADERS, timeout=15)
            data = resp.json()
            
            if data.get("returncode") != 0:
                break
            
            items = data.get("result", {}).get("itemlist", [])
            if not items:
                break
            
            # 过滤 card 类型的帖子
            for item in items:
                if item.get("type") != "card":
                    continue
                
                info = item.get("iteminfo", {})
                show = info.get("data", {}).get("show", {})
                hot = info.get("data", {}).get("hot", {})
                
                all_results.append({
                    "title": show.get("title", ""),
                    "url": show.get("jump_url", ""),
                    "author": show.get("author", ""),
                    "replies": hot.get("reply", 0),
                    "views": hot.get("view", 0),
                    "publish_time": show.get("publish_time", ""),
                    "images": show.get("graphic_img_list", []),
                })
            
            # 如果返回的数据少于页大小，说明已经是最后一页
            if len(items) < page_size:
                break
                
            offset += page_size
            page += 1
            
            # 避免无限循环
            if page > 10:  # 最多获取 10 页
                break
        
        return {"success": True, "results": all_results[:limit], "total": len(all_results[:limit])}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络错误：{str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"未知错误：{str(e)}"}


def send_warning_to_api(warning_message: str) -> bool:
    """
    发送警告到 API（使用 Redis 去重机制）
    
    Args:
        warning_message: 警告信息
    
    Returns:
        bool: True 表示发送成功，False 表示失败或已发送过
    """
    try:
        import urllib.request
        import json
        import redis
        
        # 使用 Redis 去重（1 小时内不重复发送相同警告）
        redis_key = f"autohome:warning:{hash(warning_message)}"
        should_send = True
        
        try:
            # 连接 Redis（使用项目默认配置）
            r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
            
            # 检查是否已存在
            if r.exists(redis_key):
                ttl = r.ttl(redis_key)
                print(f"⚠️ 警告已在 {ttl} 秒内发送过，跳过")
                should_send = False
            else:
                # 设置 1 小时过期
                r.setex(redis_key, 3600, str(time.time()))
        
        except redis.exceptions.ConnectionError as e:
            print(f"⚠️ Redis 连接失败，降级使用文件锁：{e}")
            # Fallback 到文件锁
            warning_cache_file = "/tmp/autohome_warning_sent.txt"
            current_time = time.time()
            if os.path.exists(warning_cache_file):
                with open(warning_cache_file, 'r') as f:
                    last_sent_time = float(f.read().strip())
                    if current_time - last_sent_time < 3600:
                        should_send = False
                        print(f"⚠️ 警告已在 1 小时内发送过，跳过")
            if should_send:
                with open(warning_cache_file, 'w') as f:
                    f.write(str(current_time))
        
        if should_send:
            api_url = "http://localhost:8080/api/network-post-config/autohome-warning"
            warning_data = json.dumps({
                "warning": warning_message,
                "timestamp": __import__('datetime').datetime.now().isoformat()
            }).encode('utf-8')
            
            req = urllib.request.Request(api_url, data=warning_data, method='POST')
            req.add_header('Content-Type', 'application/json')
            urllib.request.urlopen(req, timeout=5)  # 不等待响应
            print(f"✓ 警告已发送到配置页面")
        
        return True
    except Exception as e:
        print(f"⚠️ 发送警告到 API 失败：{e}")
        return False


async def fetch_post_content_with_retry(
    url: str, 
    use_new_selector: bool = True, 
    max_retries: int = 2
) -> Tuple[str, str, List[str]]:
    """
    带重试机制的正文获取函数
    
    Args:
        url: 帖子 URL
        use_new_selector: 是否使用新的选择器
        max_retries: 最大重试次数
    
    Returns:
        tuple: (title: str, content: str, images: list)
    """
    retry_delay = 2  # 重试延迟（秒）
    
    for attempt in range(max_retries + 1):
        try:
            result = await fetch_post_content(url, use_new_selector)
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


async def fetch_post_content(url: str, use_new_selector: bool = True) -> Tuple[str, str, List[str]]:
    """
    使用 Playwright 打开帖子 URL，提取标题、正文和正文中的图片

    Args:
        url: 帖子 URL
        use_new_selector: 是否使用新的选择器（.fn-main .post）

    Returns:
        tuple: (title: str, content: str, images: list)
    
    技术说明:
        - 使用 .fn-main .post 选择器直接定位正文（已验证有效）
        - 自动过滤表情、图标、二维码等非���文图片
        - 支持懒加载图片（滚动页面触发）
        - 包含页面结构监控和 fallback 机制
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
        stealth_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "../stealth.min.js"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../stealth.min.js"),
            "stealth.min.js",
        ]
        for sp in stealth_paths:
            if os.path.exists(sp):
                with open(sp, "r") as f:
                    await page.add_init_script(f.read())
                break

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(3)  # 等待更多内容加载
            
            # 尝试滚动页面以触发懒加载的图片
            try:
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(1)
                await page.evaluate("window.scrollTo(0, 0)")
                await asyncio.sleep(0.5)
            except Exception:
                pass

            # 提取标题
            title = ""
            try:
                title_selector = "h1.title, .thread-title, h1"
                title_element = await page.query_selector(title_selector)
                if title_element:
                    title = await title_element.inner_text()
                    title = title.strip()
            except Exception:
                pass

            # 如果没有找到标题，用文本方式提取
            if not title:
                body_text = await page.inner_text("body")
                lines = body_text.split("\n")
                for line in lines:
                    line = line.strip()
                    if 10 < len(line) < 120 and ("提车" in line or "选车" in line or "用车" in line or "购车" in line or "奥迪" in line):
                        title = line
                        break

            # 提取正文内容和图片
            content_lines = []
            images = []
            selector_used = ""

            if use_new_selector:
                # 使用经过验证的选择器：.fn-main .post
                content_element = await page.query_selector(".fn-main .post")
                
                if content_element:
                    selector_used = ".fn-main .post"
                    # 提取文本
                    content_text = await content_element.inner_text()
                    content_lines = [line.strip() for line in content_text.split("\n") if line.strip() and len(line.strip()) > 5]
                    
                    # 提取图片
                    try:
                        img_elements = await content_element.query_selector_all("img")
                        for img in img_elements:
                            try:
                                src = await img.get_attribute("src")
                                if src and src.startswith("http"):
                                    if is_valid_content_image(src):
                                        images.append(src)
                            except Exception:
                                pass
                    except Exception:
                        pass
                else:
                    # ⚠️ 页面结构监控：如果 .fn-main .post 未找到，记录警告
                    warning_msg = f"⚠️ 警告：选择器 '.fn-main .post' 未找到元素，URL: {url}"
                    print(warning_msg)
                    print(f"   可能页面结构已变更，尝试 fallback 选择器...")
                    
                    # 发送警告到 API（带去重）
                    send_warning_to_api(
                        "页面结构可能已变更，主选择器 '.fn-main .post' 失效，已自动使用 fallback 选择器"
                    )
                    
                    # Fallback: 尝试其他选择器
                    fallback_selectors = [
                        ".post",
                        ".thread-content",
                        ".main-content",
                        "article",
                        "div.content"
                    ]
                    
                    for fallback_selector in fallback_selectors:
                        content_element = await page.query_selector(fallback_selector)
                        if content_element:
                            selector_used = f"fallback: {fallback_selector}"
                            print(f"✓ 使用 fallback 选择器：'{fallback_selector}'")
                            break
                    
                    if content_element:
                        content_text = await content_element.inner_text()
                        content_lines = [line.strip() for line in content_text.split("\n") if line.strip() and len(line.strip()) > 5]
                        
                        try:
                            img_elements = await content_element.query_selector_all("img")
                            for img in img_elements:
                                try:
                                    src = await img.get_attribute("src")
                                    if src and src.startswith("http"):
                                        if is_valid_content_image(src):
                                            images.append(src)
                                except Exception:
                                    pass
                        except Exception:
                            pass
                    else:
                        print(f"❌ 所有 fallback 选择器都失败了")
            
            content = "\n".join(content_lines)

        except Exception as e:
            print(f"Error fetching content: {e}")
            title = ""
            content = ""
            images = []

        await browser.close()
        return title, content, images


async def fetch_multiple_posts_concurrently(
    urls: List[str], 
    max_concurrent: int = 2
) -> Dict[str, Tuple[str, str, List[str]]]:
    """
    并发获取多个帖子的正文内容
    
    Args:
        urls: URL 列表
        max_concurrent: 最大并发数（默认 2，降低资源占用）
    
    Returns:
        dict: {url: (title, content, images)}
    """
    # 创建信号量控制并发数
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def fetch_with_semaphore(url: str, index: int, total: int):
        async with semaphore:
            try:
                print(f"📄 [{index+1}/{total}] 开始获取：{url[:60]}...")
                # 使用带重试的函数
                result = await fetch_post_content_with_retry(url, max_retries=2)
                if result[1]:  # content 不为空
                    print(f"✅ [{index+1}/{total}] 获取成功，{len(result[1])} 字")
                else:
                    print(f"⚠️ [{index+1}/{total}] 未获取到内容")
                return url, result
            except Exception as e:
                print(f"❌ [{index+1}/{total}] 获取 {url[:50]}... 失败：{e}")
                return url, ("", "", [])
    
    # 并发获取所有 URL
    tasks = [fetch_with_semaphore(url, i, len(urls)) for i, url in enumerate(urls)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 整理结果
    content_dict = {}
    for result in results:
        if isinstance(result, tuple) and len(result) == 2:
            url, content_data = result
            content_dict[url] = content_data
        else:
            print(f"⚠️ 异常结果：{result}")
    
    return content_dict


async def search_with_content(
    keyword: str, 
    limit: int = 5, 
    fetch_content: bool = False,
    max_concurrent: int = 2
) -> Dict[str, Any]:
    """
    搜索并可选获取帖子正文

    Args:
        keyword: 搜索关键词
        limit: 返回结果数量
        fetch_content: 是否获取帖子正文（需要 Playwright）
        max_concurrent: 最大并发数（默认 2）

    Returns:
        dict: {"success": bool, "results": [...], "total": int, "error": str}
    """
    result = search_autohome(keyword, limit)

    if not result.get("success") or not fetch_content:
        return result

    # 收集需要获取正文的 URL
    urls_to_fetch = []
    url_to_item = {}
    
    for item in result.get("results", [])[:max_concurrent]:
        url = item.get("url")
        if url:
            urls_to_fetch.append(url)
            url_to_item[url] = item
    
    if urls_to_fetch:
        print(f"\n{'='*60}")
        print(f"🚀 开始并发获取 {len(urls_to_fetch)} 条帖子的正文（并发数：{max_concurrent}）...")
        print(f"{'='*60}\n")
        
        start_time = time.time()
        
        # 并发获取所有帖子的正文
        content_dict = await fetch_multiple_posts_concurrently(urls_to_fetch, max_concurrent)
        
        elapsed = time.time() - start_time
        success_count = sum(1 for _, (t, c, img) in content_dict.items() if c)
        
        print(f"\n{'='*60}")
        print(f"✅ 正文获取完成")
        print(f"   - 总耗时：{elapsed:.1f}秒")
        print(f"   - 成功：{success_count}/{len(urls_to_fetch)}")
        print(f"   - 平均速度：{elapsed/len(urls_to_fetch):.1f}秒/条")
        print(f"{'='*60}\n")
        
        # 将内容填充回结果
        for url, (title, content, images) in content_dict.items():
            item = url_to_item.get(url)
            if item and content:
                item["content"] = content
                if title:
                    item["title"] = title
                if images:
                    item["content_images"] = images

    return result


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少参数：keyword"}, ensure_ascii=False))
        sys.exit(0)

    keyword = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    fetch_content = "--fetch-content" in sys.argv

    if fetch_content:
        result = asyncio.run(search_with_content(keyword, limit, fetch_content=True))
    else:
        result = search_autohome(keyword, limit)

    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
