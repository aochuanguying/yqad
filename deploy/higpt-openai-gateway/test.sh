#!/bin/bash

# 网关测试脚本
GATEWAY_URL="http://localhost:3000"
API_KEY="YOUR_GATEWAY_KEY"  # 替换为你的网关密钥

echo "=========================================="
echo "HiGPT OpenAI Gateway 测试脚本"
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
  }' | jq '.'
echo ""
echo ""

# 测试 2: Qwen3.5（旧别名 higpt）
echo "测试 2: Qwen3.5（旧别名 higpt，向后兼容）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "higpt",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100
  }' | jq '.'
echo ""
echo ""

# 测试 3: DeepSeek V4-Pro（新别名，自动添加参数）
echo "测试 3: DeepSeek V4-Pro（新别名，网关自动添加 chat_template_kwargs）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100
  }' | jq '.'
echo ""
echo ""

# 测试 4: DeepSeek V4-Pro（旧别名 deepseek）
echo "测试 4: DeepSeek V4-Pro（旧别名 deepseek，向后兼容）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100
  }' | jq '.'
echo ""
echo ""

# 测试 5: DeepSeek V4-Pro（手动指定 thinking 参数）
echo "测试 5: DeepSeek V4-Pro（手动指定 chat_template_kwargs）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
    "max_tokens": 100,
    "chat_template_kwargs": {"thinking": true}
  }' | jq '.'
echo ""
echo ""

# 测试 6: 流式输出测试（Qwen3.5）
echo "测试 6: 流式输出测试（Qwen3.5）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-5",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
echo ""
echo ""

# 测试 7: 流式输出测试（DeepSeek V4-Pro）
echo "测试 7: 流式输出测试（DeepSeek V4-Pro）"
echo "----------------------------------------"
curl -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
