#!/bin/bash

# 实际网关测试脚本
GATEWAY_URL="https://higpt.hxfssc.com:8088"
API_KEY="LqgltIIdlFVQFdi5EMa98HtRVXzq6KGA"

echo "=========================================="
echo "HiGPT OpenAI Gateway 实际环境测试"
echo "网关地址：${GATEWAY_URL}"
echo "=========================================="
echo ""

# 测试 1: Qwen3.5（新别名）
echo "测试 1: Qwen3.5（新别名）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-5",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100
  }' \
  --max-time 30 \
  -w "\nHTTP 状态码：%{http_code}\n"
echo ""
echo ""

# 测试 2: DeepSeek V4-Pro（新别名，网关自动添加参数）
echo "测试 2: DeepSeek V4-Pro（新别名，网关自动添加 chat_template_kwargs）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100
  }' \
  --max-time 30 \
  -w "\nHTTP 状态码：%{http_code}\n"
echo ""
echo ""

# 测试 3: DeepSeek V4-Pro（旧别名 deepseek，向后兼容）
echo "测试 3: DeepSeek V4-Pro（旧别名 deepseek，向后兼容）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100
  }' \
  --max-time 30 \
  -w "\nHTTP 状态码：%{http_code}\n"
echo ""
echo ""

# 测试 4: DeepSeek V4-Pro（手动指定 thinking: true）
echo "测试 4: DeepSeek V4-Pro（手动指定 thinking: true）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100,
    "chat_template_kwargs": {"thinking": true}
  }' \
  --max-time 30 \
  -w "\nHTTP 状态码：%{http_code}\n"
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
