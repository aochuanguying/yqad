#!/bin/bash
# 检查 Cookie 使用记录

echo "=== 检查 Cookie 使用记录 ==="
echo ""

echo "1. 知乎配置："
curl -s "http://192.168.50.10:3090/api/cookie-configs/cookie-configs?platform=zhihu" \
  -H "Authorization: Bearer social-search-api-key-2026" | \
  python3 -m json.tool | grep -E '"id"|"label"|"useCount"'

echo ""
echo "2. 小红书配置："
curl -s "http://192.168.50.10:3090/api/cookie-configs/cookie-configs?platform=xiaohongshu" \
  -H "Authorization: Bearer social-search-api-key-2026" | \
  python3 -m json.tool | grep -E '"id"|"label"|"useCount"'

echo ""
echo "=== 完成 ==="
