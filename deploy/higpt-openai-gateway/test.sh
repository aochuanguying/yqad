#!/bin/bash
# 网关冒烟测试（当前模型：qwen → qwen3-5-397b，glm → histar-ultra）
# 用法：GATEWAY_URL=http://localhost:3000 GATEWAY_API_KEY=xxx ./test.sh
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
API_KEY="${GATEWAY_API_KEY:-YOUR_GATEWAY_KEY}"

chat() { # $1=说明 $2=model $3=额外 JSON 字段（可空） $4=额外请求头（可空）
  echo "== $1"
  curl -s -X POST "${GATEWAY_URL}/v1/chat/completions" \
    -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" ${4:+-H "$4"} \
    -d "{\"model\":\"$2\",\"messages\":[{\"role\":\"user\",\"content\":\"1+1等于几？\"}],\"max_tokens\":512$3}" \
    --max-time 120 -D - -o /tmp/higpt-test.json | grep -iE "^HTTP"
  head -c 400 /tmp/higpt-test.json; echo; echo
}

curl -s "${GATEWAY_URL}/v1/models" -H "Authorization: Bearer ${API_KEY}"; echo; echo
chat "qwen（默认思考关）" qwen
chat "glm（默认思考关）" glm
chat "qwen 调用方开启思考（返回 reasoning_content）" qwen ',"chat_template_kwargs":{"enable_thinking":true}'

echo "== qwen 流式"
curl -s -N -X POST "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" \
  -d '{"model":"qwen","stream":true,"messages":[{"role":"user","content":"你好"}],"max_tokens":64}' --max-time 120 | tail -3
echo
rm -f /tmp/higpt-test.json
