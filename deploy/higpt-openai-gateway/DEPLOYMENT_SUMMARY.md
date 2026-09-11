# HiGPT Gateway Linux 部署总结（v2ray WebSocket 集成版）

## 部署方案概述

本方案实现了在 Linux 服务器上部署 HiGPT OpenAI 兼容网关，**与 v2ray 共用 443 端口**，通过 Nginx 反向代理和 WebSocket 技术实现流量分发，不影响 v2ray 现有功能。

## 关键特性

- ✅ **443 端口复用** - Nginx 统一监听 443，分发流量到 HiGPT 网关和 v2ray
- ✅ **WebSocket 传输** - v2ray 改为 WebSocket 模式，路径为 `/v2ray/`
- ✅ **路径访问网关** - 通过 `/higpt/` 路径访问网关
- ✅ **HTTPS 加密** - Let's Encrypt SSL 证书
- ✅ **一键部署** - 自动化部署脚本（支持仅部署网关或网关+v2ray）
- ✅ **健康检查** - 完整的健康检查脚本

## 部署文件清单

```
deploy/higpt-openai-gateway/
├── docker-compose.yml          # Docker Compose 配置（已修改为绑定 127.0.0.1）
├── .env.example                # 环境变量模板
├── deploy.sh                   # 一键部署脚本（支持 v2ray 配置）
├── health-check.sh             # 健康检查脚本
├── nginx.conf.example          # Nginx 配置模板
├── README.md                   # 部署文档（已更新）
├── DEPLOYMENT_SUMMARY.md       # 部署总结（本文档）
├── config/
│   └── local.yaml.example      # 本地配置模板
└── app/
    └── ...                     # 应用源代码
```

## 架构说明

```
                    互联网
                       │
                       ▼
              ┌────────────────┐
              │  Nginx:443     │  ← Nginx 统一监听 443（TLS 终止）
              │  (TLS 终止)     │
              └───────┬────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│  /higpt/*     │           │  /v2ray/*     │
│  转发到网关    │           │  转发到 v2ray  │
│ 127.0.0.1:3000│           │ 127.0.0.1:10000│
└───────────────┘           └───────┬───────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │   v2ray        │
                           │ (WS 模式，本地端口)│
                           └────────────────┘
```

## 部署步骤

### 前置条件

1. **服务器已安装 Nginx**（如未安装，脚本会自动安装）
2. **服务器已安装 v2ray**（如需要配置 v2ray）
3. 有可用的域名并已解析到服务器（`hx.hxfssc.com`）
4. 服务器防火墙允许 80/443 端口
5. **Docker 和 Docker Compose**（如未安装，脚本会自动安装）

### 一键部署（推荐）

```bash
# 1. 上传项目文件到服务器
scp -r deploy/higpt-openai-gateway/ user@server:/opt/

# 2. SSH 登录服务器
ssh user@server
cd /opt/higpt-openai-gateway

# 3. 执行一键部署脚本
# 选项 A: 仅部署 HiGPT 网关（v2ray 保持原配置）
sudo ./deploy.sh -d hx.hxfssc.com -e admin@example.com

# 选项 B: 部署 HiGPT 网关 + 配置 v2ray WebSocket（推荐）
sudo ./deploy.sh -d hx.hxfssc.com -e admin@example.com -v

# 4. 编辑配置文件，填写实际的 API 密钥
vim .env
vim config/local.yaml

# 5. 重启容器
docker-compose restart

# 6. 运行健康检查
sudo ./health-check.sh -d hx.hxfssc.com
```

### 访问方式

- **HiGPT 网关**: `https://hx.hxfssc.com/higpt/v1`
- **API Key**: `.env` 中的 `GATEWAY_API_KEY`
- **Model**: `higpt`（默认别名）或 `qwen3-5-397b`

### v2ray 客户端配置

部署后，v2ray 客户端需要更新配置：

```json
{
  "address": "hx.hxfssc.com",
  "port": 443,
  "protocol": "vmess",
  "uuid": "你的 UUID（脚本自动保留原 UUID）",
  "alterId": 0,
  "security": "auto",
  "streamSettings": {
    "network": "ws",
    "security": "tls",
    "wsSettings": {
      "path": "/v2ray/"
    }
  }
}
```

**关键变更：**
1. ✅ 地址改为域名：`hx.hxfssc.com`
2. ✅ 端口改为：`443`
3. ✅ 传输协议：`WebSocket`
4. ✅ 路径：`/v2ray/`
5. ✅ 安全：`tls`

## 技术细节

### v2ray 配置变更

脚本会自动将 v2ray 从直接监听 443 改为 WebSocket 模式：

**原配置：**
```json
{
  "inbounds": [{
    "port": 443,
    "protocol": "vmess",
    ...
  }]
}
```

**新配置：**
```json
{
  "inbounds": [{
    "port": 10000,
    "listen": "127.0.0.1",
    "protocol": "vmess",
    "streamSettings": {
      "network": "ws",
      "wsSettings": {
        "path": "/v2ray/"
      }
    }
  }]
}
```

### Nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name hx.hxfssc.com;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/hx.hxfssc.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hx.hxfssc.com/privkey.pem;
    
    # HiGPT 网关路径
    location /higpt/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;
    }
    
    # v2ray WebSocket 路径
    location /v2ray/ {
        proxy_pass http://127.0.0.1:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 测试

### 测试 HiGPT 网关

```bash
GATEWAY_URL="https://hx.hxfssc.com"
API_KEY="your_gateway_api_key"

curl -X POST "${GATEWAY_URL}/higpt/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "higpt",
    "messages": [{"role": "user", "content": "你好"}],
    "max_tokens": 100
  }'
```

### 测试 v2ray 连接

使用 v2ray 客户端连接，确认可以正常上网。

## 维护命令

```bash
# 查看 HiGPT 网关日志
docker-compose logs -f

# 查看 v2ray 日志
sudo journalctl -u v2ray -f
sudo tail -f /var/log/v2ray/error.log

# 重启容器
docker-compose restart

# 重启 v2ray
sudo systemctl restart v2ray

# 停止服务
docker-compose down

# 更新证书
sudo certbot renew --dry-run

# 健康检查
sudo ./health-check.sh -d hx.hxfssc.com

# 检查 Nginx 配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload
```

## 故障排查

### 1. v2ray 无法连接

```bash
# 检查 v2ray 服务状态
sudo systemctl status v2ray

# 检查端口监听
sudo ss -tlnp | grep 10000

# 查看 v2ray 日志
sudo tail -f /var/log/v2ray/error.log

# 测试 WebSocket 路径
curl -i -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Host: hx.hxfssc.com" \
  https://hx.hxfssc.com/v2ray/
```

### 2. 网关无法访问

```bash
# 检查容器状态
docker ps

# 检查端口监听
sudo ss -tlnp | grep 3000

# 查看网关日志
docker-compose logs
```

### 3. Nginx 配置错误

```bash
# 测试配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 4. SSL 证书问题

```bash
# 检查证书有效期
sudo openssl x509 -in /etc/letsencrypt/live/hx.hxfssc.com/fullchain.pem -noout -dates

# 手动续期
sudo certbot renew --force-renewal
```

### 5. API 返回 401

- 检查 `.env` 文件中的 `GATEWAY_API_KEY` 是否正确
- 检查 `config/local.yaml` 中的 `gatewayApiKey` 是否匹配
- 重启容器：`docker-compose restart`

## 安全建议

1. **防火墙配置**：仅开放 80/443 端口
2. **API 密钥保护**：使用强随机密钥（`openssl rand -hex 32`）
3. **WebSocket 路径保密**：`/v2ray/` 路径不要泄露
4. **定期更新证书**：配置自动续期 cron 任务
5. **日志监控**：定期检查 Nginx、v2ray 和 Docker 日志
6. **限制访问**：可在 Nginx 层配置 IP 白名单

## 部署脚本选项说明

```bash
# 显示帮助
./deploy.sh -h

# 仅部署 HiGPT 网关
./deploy.sh -d hx.hxfssc.com -e admin@example.com

# 部署网关 + 配置 v2ray WebSocket
./deploy.sh -d hx.hxfssc.com -e admin@example.com -v
```

**参数说明：**
- `-d, --domain`: 域名（必填）
- `-e, --email`: 邮箱，用于 Let's Encrypt 通知（必填）
- `-v, --v2ray`: 同时配置 v2ray WebSocket（可选）
- `-h, --help`: 显示帮助信息

## 回滚方案

如果部署失败或需要回滚：

```bash
# 1. 恢复 v2ray 配置（如果配置了 v2ray）
sudo cp /usr/local/etc/v2ray/config.json.bak.* /usr/local/etc/v2ray/config.json
sudo systemctl restart v2ray

# 2. 移除 Nginx 配置
sudo rm /etc/nginx/conf.d/higpt-gateway.conf
sudo nginx -s reload

# 3. 停止容器
docker-compose down

# 4. 删除部署目录
sudo rm -rf /opt/higpt-gateway
```

## 参考资料

- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)
- [Nginx WebSocket 代理配置](https://www.nginx.com/blog/websocket-nginx/)
- [v2ray WebSocket 配置](https://www.v2ray.com/en/configuration/transport.html)
