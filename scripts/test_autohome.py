#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
汽车之家论坛搜索测试脚本
方案：爬取奥迪相关论坛的帖子列表页，提取标题、链接、作者等信息

论坛 ID 映射（奥迪相关）：
- 692: 奥迪A4L
- 812: 奥迪Q5/Q5L
- 18:  奥迪A6L
- 146: 奥迪A3
- 159: 奥迪Q3
- 3170: 奥迪Q7
- 3641: 奥迪A8
"""

import json
import sys
import time
import random
import requests
from bs4 import BeautifulSoup
import re


# 奥迪相关论坛 ID 列表
AUDI_FORUM_IDS = [692, 812, 18, 146, 159, 3170, 3641]


def parse_cookie(cookie_str):
    """解析 Cookie 字符串为字典"""
    cookie_dict = {}
    for item in cookie_str.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    return cookie_dict


def crawl_forum_page(forum_id, page, headers, cookies):
    """
    爬取单个论坛页面
    
    URL 格式: https://club.autohome.com.cn/bbs/forum-c-{forum_id}-{page}.html
    """
    url = f"https://club.autohome.com.cn/bbs/forum-c-{forum_id}-{page}.html"
    
    try:
        response = requests.get(url, headers=headers, cookies=cookies, timeout=15)
        
        if response.status_code != 200:
            return []
        
        soup = BeautifulSoup(response.text, "html.parser")
        results = []
        
        # 查找帖子列表 - 汽车之家论坛的帖子在 <dl> 或 <li> 中
        # 尝试多种选择器
        post_items = []
        
        # 方法1: 查找包含 thread 链接的 a 标签的父元素
        thread_links = soup.find_all("a", href=re.compile(r"/bbs/thread/[a-f0-9]+/\d+"))
        
        seen_urls = set()
        for link in thread_links:
            href = link.get("href", "")
            if href in seen_urls:
                continue
            seen_urls.add(href)
            
            title = link.get_text(strip=True)
            
            # 过滤掉太短的标题和非帖子链接
            if not title or len(title) < 5:
                continue
            
            # 过滤掉置顶帖标记
            if title in ["图文", "视频", "置顶"]:
                continue
            
            # 确保 URL 完整
            if href.startswith("//"):
                full_url = "https:" + href
            elif href.startswith("/"):
                full_url = "https://club.autohome.com.cn" + href
            else:
                full_url = href
            
            # 去掉 # 后面的锚点
            full_url = full_url.split("#")[0]
            
            # 提取作者 - 在链接附近查找
            author = ""
            parent = link.parent
            if parent:
                # 尝试在父元素中找作者链接
                author_link = parent.find("a", href=re.compile(r"/i\.autohome\.com\.cn/"))
                if author_link:
                    author = author_link.get_text(strip=True)
            
            # 提取图片
            image_urls = []
            if parent:
                img_tags = parent.find_all("img")
                for img in img_tags:
                    src = img.get("src") or img.get("data-src") or ""
                    if src and src.startswith("http"):
                        image_urls.append(src)
            
            result = {
                "title": title,
                "content": title,  # 列表页没有正文，用标题代替
                "url": full_url,
                "author": author,
                "replies": 0,
                "views": 0,
                "imageUrls": image_urls[:3],
                "publishTime": "",
            }
            
            results.append(result)
        
        return results
        
    except Exception:
        return []


def search_autohome_forum(keyword, max_results, cookie_str=None):
    """
    搜索汽车之家论坛
    
    策略：爬取奥迪相关论坛的帖子列表，按关键词过滤
    """
    results = []
    seen_urls = set()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.autohome.com.cn/",
        "Connection": "keep-alive",
        "Cache-Control": "max-age=0",
    }
    
    cookies = parse_cookie(cookie_str) if cookie_str else {}
    
    # 遍历奥迪相关论坛
    for forum_id in AUDI_FORUM_IDS:
        if len(results) >= max_results:
            break
        
        # 每个论坛只爬第1页
        try:
            page_results = crawl_forum_page(forum_id, 1, headers, cookies)
            
            # 按关键词过滤
            for item in page_results:
                if len(results) >= max_results:
                    break
                
                # 去重
                if item["url"] in seen_urls:
                    continue
                seen_urls.add(item["url"])
                
                # 关键词匹配（不区分大小写）
                if keyword.lower() in item["title"].lower():
                    results.append(item)
            
            # 随机休眠（测试连接时减少休眠）
            if len(results) < max_results:
                if max_results <= 5:
                    time.sleep(random.uniform(0.2, 0.5))
                else:
                    time.sleep(random.uniform(1, 2))
                
        except Exception:
            continue
    
    return {
        "success": True,
        "results": results,
        "total": len(results)
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少关键词参数"}))
        sys.exit(1)
    
    keyword = sys.argv[1]
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    cookie = sys.argv[3] if len(sys.argv) > 3 else ""
    
    # 测试连接时减少休眠时间（0.5-1 秒），正常使用 1-3 秒
    if max_results <= 5:
        time.sleep(random.uniform(0.5, 1))
    else:
        time.sleep(random.uniform(1, 3))
    
    result = search_autohome_forum(keyword, max_results, cookie)
    print(json.dumps(result, ensure_ascii=False))
