# HiGPT OpenAI 兼容网关（仅网关版）

该目录是“只包含 HiGPT 网关”的最小可部署产物，不包含签到/评论/发帖等业务代码。

## 目录结构

```
deploy/higpt-openai-gateway/
  docker-compose.yml
  .env.example
  config/
    local.yaml.example
  app/
    Dockerfile
    package.json
    package-lock.json
    tsconfig.json
    src/
```

## 在群晖 Project（方式 A）部署

将整个 `deploy/higpt-openai-gateway/` 上传到 NAS：

```
/volume1/docker/higpt/
  docker-compose.yml
  .env
  config/
    local.yaml
  logs/
  app/
    ...
```

然后在 Container Manager → Project 选择 `/volume1/docker/higpt` 创建并启动。

如果你发现一直返回 401（Unauthorized），通常是 Project 没有把 `.env` 注入容器。此目录的 `docker-compose.yml` 已包含 `env_file: .env`，请确保：

- `/volume1/docker/higpt/.env` 存在
- Project 重建/重启后容器环境变量里能看到 `GATEWAY_API_KEY`

## 访问方式

- Base URL：`http://<NAS>:3000/v1`
- API Key：`.env` 里的 `GATEWAY_API_KEY`
- Model：`higpt`（默认别名）或 `qwen3-5-397b`

## 在 Linux 服务器部署（推荐）

### 前置条件

- 已安装 Nginx（如未安装，脚本会自动安装）
- 有可用的域名并已解析到服务器
- 服务器开放 80 和 443 端口
- **Docker 和 Docker Compose**（如未安装，脚本会自动安装）

### 一键部署（推荐）

```bash
# 1. 上传项目文件到服务器
scp -r deploy/higpt-openai-gateway/ user@server:/opt/

# 2. 进入部署目录
ssh user@server
cd /opt/higpt-openai-gateway

# 3. 执行一键部署脚本
# 选项 A: 仅部署 HiGPT 网关
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

### 手动部署

```bash
# 1. 创建部署目录
sudo mkdir -p /opt/higpt-gateway
cd /opt/higpt-gateway

# 2. 复制项目文件
# （上传或拷贝整个 higpt-openai-gateway 目录到此）

# 3. 配置环境变量
cp .env.example .env
vim .env  # 编辑实际的 API 密钥

# 4. 配置 local.yaml
mkdir -p config
cp config/local.yaml.example config/local.yaml
vim config/local.yaml

# 5. 启动 Docker 容器
docker-compose up -d --build

# 6. 配置 Nginx（参考 nginx.conf.example）
sudo cp nginx.conf.example /etc/nginx/conf.d/higpt-gateway.conf
sudo vim /etc/nginx/conf.d/higpt-gateway.conf  # 替换 <DOMAIN> 为实际域名
sudo nginx -t
sudo nginx -s reload

# 7. 申请 SSL 证书
sudo mkdir -p /var/www/certbot
sudo certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d higpt.yourdomain.com

# 8. 重载 Nginx（加载 SSL 证书）
sudo nginx -s reload
```

### 访问方式

- Base URL：`https://higpt.yourdomain.com/higpt/v1`
- API Key：`.env` 里的 `GATEWAY_API_KEY`
- Model：`higpt`（默认别名）或 `qwen3-5-397b`

### 测试

```bash
# 使用 test-real.sh 脚本测试
GATEWAY_URL="https://higpt.yourdomain.com"
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

### 维护

```bash
# 查看日志
docker-compose logs -f

# 重启容器
docker-compose restart

# 停止服务
docker-compose down

# 更新证书（自动续期）
sudo certbot renew --dry-run

# 健康检查
sudo ./health-check.sh -d higpt.yourdomain.com
```
