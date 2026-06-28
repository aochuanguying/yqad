#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
汽车之家搜索脚本
1. 使用 sou.api.autohome.com.cn 搜索 API 获取帖子列表
2. 使用 Playwright 打开帖子 URL 获取正文内容
"""

import sys
import json
import asyncio
import requests

SEARCH_API = "https://sou.api.autohome.com.cn/v1/search"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://sou.autohome.com.cn",
    "Referer": "https://sou.autohome.com.cn/",
}


def search_autohome(keyword, limit=5):
    """
    搜索汽车之家论坛帖子（仅搜索，不获取正文）

    Returns:
        dict: {"success": bool, "results": [...], "total": int, "error": str}
    """
    try:
        params = {
            "source": "pc",
            "q": keyword,
            "entry": "40",
            "pid": "90300024",
            "offset": "0",
            "size": str(limit),
            "page": "1",
            "ext": json.dumps({
                "plat": "pc",
                "pf": "pc",
                "q": keyword,
                "offset": 0,
                "size": limit,
            }),
        }

        resp = requests.get(SEARCH_API, params=params, headers=HEADERS, timeout=15)
        data = resp.json()

        if data.get("returncode") != 0:
            return {"success": False, "error": data.get("message", "API 返回错误")}

        items = data.get("result", {}).get("itemlist", [])
        results = []

        for item in items:
            if item.get("type") != "card":
                continue

            info = item.get("iteminfo", {})
            show = info.get("data", {}).get("show", {})
            hot = info.get("data", {}).get("hot", {})

            results.append({
                "title": show.get("title", ""),
                "url": show.get("jump_url", ""),
                "author": show.get("author", ""),
                "replies": hot.get("reply", 0),
                "views": hot.get("view", 0),
                "publish_time": show.get("publish_time", ""),
                "images": show.get("graphic_img_list", []),
            })

        return {"success": True, "results": results, "total": len(results)}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络错误：{str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"未知错误：{str(e)}"}


async def fetch_post_content(url):
    """
    使用 Playwright 打开帖子 URL，提取标题和正文

    Returns:
        (title: str, content: str)
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
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)

            body_text = await page.inner_text("body")
            lines = body_text.split("\n")

            # 提取标题：找第一个长度合适的行
            title = ""
            for line in lines:
                line = line.strip()
                if 10 < len(line) < 120 and ("提车" in line or "选车" in line or "用车" in line or "购车" in line or "奥迪" in line):
                    title = line
                    break

            # 提取正文：从标题后开始收集
            content_lines = []
            started = False
            skip_keywords = [
                "网站导航", "更多", "消息", "登录", "注册", "首页", "论坛",
                "口碑", "问大家", "论坛精选", "快速回复", "发布", "只看楼主",
                "热门标准", "回复", "Ctrl + Enter", "汽车之家温馨提示",
                "内容系网友发布", "+关注", "私信", "SUV", "精选推荐", "热门",
            ]

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # 跳过导航/UI 文本
                if line in skip_keywords:
                    continue
                if any(line.startswith(kw) for kw in ["奥迪", "品牌论坛"]):
                    continue
                if "论坛精选日报" in line:
                    continue

                # 找到标题行后开始收集
                if title and line == title:
                    started = True
                    continue

                if started and len(line) > 5:
                    # 遇到回复内容时停止
                    if line.startswith("来自于") or line.startswith("内容系网友"):
                        break
                    content_lines.append(line)

            content = "\n".join(content_lines)

        except Exception as e:
            title = ""
            content = ""

        await browser.close()
        return title, content


async def search_with_content(keyword, limit=5, fetch_content=False):
    """
    搜索并可选获取帖子正文

    Args:
        keyword: 搜索关键词
        limit: 返回结果数量
        fetch_content: 是否获取帖子正文（需要 Playwright）

    Returns:
        dict: {"success": bool, "results": [...], "total": int, "error": str}
    """
    result = search_autohome(keyword, limit)

    if not result.get("success") or not fetch_content:
        return result

    # 用 Playwright 获取前几条帖子的正文
    for item in result.get("results", [])[:3]:
        url = item.get("url")
        if url:
            try:
                title, content = await fetch_post_content(url)
                if content:
                    item["content"] = content
                    if title:
                        item["title"] = title
            except Exception:
                pass

    return result


def main():
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
