#!/bin/bash

# 本地测试脚本
# 用法：./test-local.sh

set -e

echo "=== HiGPT Gateway 本地测试 ==="
echo ""

# 1. 检查配置
echo "1. 检查配置文件..."
if [ ! -f "config/local.yaml" ]; then
  echo "⚠️  未找到 config/local.yaml，将使用 default.yaml"
else
  echo "✓ 找到 config/local.yaml"
fi

# 2. 启动网关（后台运行）
echo ""
echo "2. 启动网关..."
node dist/index.js &
GATEWAY_PID=$!
sleep 2

# 检查是否启动成功
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo "❌ 网关启动失败"
  exit 1
fi
echo "✓ 网关已启动 (PID: $GATEWAY_PID)"

# 3. 测试健康检查
echo ""
echo "3. 测试健康检查..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if [ "$HEALTH_RESPONSE" = '{"ok":true}' ]; then
  echo "✓ 健康检查通过: $HEALTH_RESPONSE"
else
  echo "❌ 健康检查失败: $HEALTH_RESPONSE"
  kill $GATEWAY_PID
  exit 1
fi

# 4. 测试鉴权
echo ""
echo "4. 测试鉴权（无 token 应返回 401）..."
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/v1/models)
if [ "$AUTH_RESPONSE" = "401" ]; then
  echo "✓ 鉴权测试通过 (HTTP $AUTH_RESPONSE)"
else
  echo "⚠️  鉴权测试异常 (HTTP $AUTH_RESPONSE)"
fi

# 5. 测试模型列表（带 token）
echo ""
echo "5. 测试模型列表（需要有效 token）..."
# 注意：这里需要一个有效的 token，实际测试时请替换
GATEWAY_API_KEY="${GATEWAY_API_KEY:-test-key}"
MODELS_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/v1/models \
  -H "Authorization: Bearer $GATEWAY_API_KEY")
HTTP_CODE=$(echo "$MODELS_RESPONSE" | tail -n1)
BODY=$(echo "$MODELS_RESPONSE" | head -n-1)
echo "HTTP $HTTP_CODE: $BODY"

# 6. 清理
echo ""
echo "6. 停止网关..."
kill $GATEWAY_PID
wait $GATEWAY_PID 2>/dev/null || true
echo "✓ 网关已停止"

echo ""
echo "=== 测试完成 ==="
