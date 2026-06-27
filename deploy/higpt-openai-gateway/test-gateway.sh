#!/bin/bash

# HiGPT 网关测试脚本

GATEWAY_URL="http://hx.hxfssc.com/higpt/v1"
API_KEY="LqgltIIdlFVQFdi5EMa98HtRVXzq6KGA"

echo "======================================"
echo "测试 Qwen 模型"
echo "======================================"

curl -X POST "${GATEWAY_URL}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "model": "qwen",
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍你自己"
      }
    ],
    "temperature": 0.7
  }' | jq '.'

echo ""
echo "======================================"
echo "测试 DeepSeek 模型"
echo "======================================"

curl -X POST "${GATEWAY_URL}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "model": "deepseek",
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍你自己"
      }
    ],
    "temperature": 0.7
  }' | jq '.'

echo ""
echo "======================================"
echo "测试健康检查"
echo "======================================"

curl -s "${GATEWAY_URL}/../health" | jq '.'

echo ""
