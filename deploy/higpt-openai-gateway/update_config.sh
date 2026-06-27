#!/bin/bash

# 更新网关配置文件并重启容器

SERVER="wangfuwei@10.30.5.33"
PASSWORD="Wfw7539148@"

# 创建新的配置文件
cat > /tmp/local.yaml << 'EOF'
gatewayApiKey: LqgltIIdlFVQFdi5EMa98HtRVXzq6KGA
higpt:
  baseUrl: https://inner-apisix.hisense.com/higpt-new/v1
  apiKey: LqgltIIdlFVQFdi5EMa98HtRVXzq6KGA
  userKey: u4tehcn8qlzv00ubqr7wlybiq4tz2zjq
  timeoutMs: 120000
modelAliases:
  qwen: qwen3-5-397b
  deepseek: deepseek-v4-pro
EOF

# 上传配置文件
sshpass -p "$PASSWORD" scp /tmp/local.yaml $SERVER:/opt/higpt-gateway/config/local.yaml

# 重启容器
sshpass -p "$PASSWORD" ssh $SERVER "cd /opt/higpt-gateway && docker-compose restart"

echo "配置已更新，容器已重启"
