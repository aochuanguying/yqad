#!/usr/bin/env ts-node
/**
 * 探针：检查知乎开放平台 API 是否有 HTML content 字段或图片字段
 * 用法：npx ts-node -r dotenv/config scripts/test_zhihu_raw_response.ts
 */

import { NetworkPostConfigStorage } from '../src/storage/mysql/network-post-config-storage';
import { initializeMySQL } from '../src/utils/mysql-connection-manager';

async function main() {
  await initializeMySQL();

  const storage = NetworkPostConfigStorage.getInstance();
  const config = await storage.getConfig();
  const accessSecret = config?.zhihuAccessSecret || process.env.ZHIHU_ACCESS_SECRET || '';

  if (!accessSecret) {
    console.log('未找到 Access Secret');
    process.exit(1);
  }

  process.env.ZHIHU_ACCESS_SECRET = accessSecret;

  const timestamp = Math.floor(Date.now() / 1000);
  // 搜索一个图片丰富的关键词
  const url = `https://developer.zhihu.com/api/v1/content/zhihu_search?Query=${encodeURIComponent('奥迪 Q5L 内饰 实拍')}&Count=3`;

  console.log(`请求: ${url}\n`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessSecret}`,
      'X-Request-Timestamp': timestamp.toString(),
      'Content-Type': 'application/json',
    },
  });

  const data: any = await response.json();
  const items = data.Data?.Items || [];

  if (items.length === 0) {
    console.log('无结果');
    process.exit(0);
  }

  // 检查每条结果的所有字段，特别关注可能包含图片的字段
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n=== 结果 ${i + 1}: ${item.Title} ===`);
    
    // 列出所有字段
    const allKeys = Object.keys(item);
    console.log('所有字段:', allKeys.join(', '));
    
    // 检查 ContentText 中是否包含 HTML 标签（如图片）
    const contentText = item.ContentText || '';
    const hasImgTag = /<img|<figure|<picture/i.test(contentText);
    const hasHtmlTag = /<[a-z][\s\S]*>/i.test(contentText);
    console.log(`ContentText 包含 <img> 标签: ${hasImgTag}`);
    console.log(`ContentText 包含 HTML 标签: ${hasHtmlTag}`);
    
    // 检查是否有其他可能包含图片的字段
    for (const key of allKeys) {
      const val = item[key];
      if (typeof val === 'string' && val.length > 0) {
        // 检查是否包含图片 URL
        if (/https?:\/\/.*\.(jpg|jpeg|png|gif|webp)/i.test(val)) {
          console.log(`  [图片URL] ${key}: ${val.substring(0, 120)}`);
        }
        // 检查是否包含 HTML img 标签
        if (/<img/i.test(val)) {
          console.log(`  [含<img>] ${key}: (长度=${val.length})`);
        }
      }
    }
    
    // 打印 ContentText 前 300 字符
    console.log(`\nContentText 前300字符:`);
    console.log(contentText.substring(0, 300));
    console.log('---');
  }
}

main().catch(console.error);
