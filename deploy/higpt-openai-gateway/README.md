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
- Model：`qwen`（→ qwen3-5-397b）或 `glm`（→ histar-ultra）

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
- Model：`qwen`（→ qwen3-5-397b）或 `glm`（→ histar-ultra）

### 测试

```bash
# 使用 test-real.sh 脚本测试
GATEWAY_URL="https://higpt.yourdomain.com"
API_KEY="your_gateway_api_key"

curl -X POST "${GATEWAY_URL}/higpt/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen",
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

## 管理页：多上游在线配置（/admin/）

- 地址：`https://<域名>/admin/` 或 `http://<内网IP>/admin/`；仅 `admin.allowedCidrs`（默认内网网段）可访问，需管理员密码（`admin.password` / `ADMIN_PASSWORD`）。
- 可配置多套上游：地址（baseUrl）、`user_key`（以 URL 参数 `?user_key=` 传递）、API Key（以 `Authorization: Bearer` 传递）、代理、超时、启用。
- 模型路由：客户端 `model` → 指定上游 + 上游实际模型，并可设置默认思考开关。
- 保存后立即生效，无需重启；进行中的请求不受影响。配置存 `config/upstreams.json`（600），每次保存自动备份 `upstreams.json.bak.<时间>`（保留最近 20 份）。
- 密钥在页面掩码显示，留空=不修改，勾“清空”=删除。两人同时编辑时后保存者会收到冲突提示（409），需重新加载。
- 首次启动时若 `upstreams.json` 不存在，用 yaml 中的 `higpt` + `modelAliases` 自动生成（上游 id=`higpt`）。之后以该文件为准。
- 回滚：用 `upstreams.json.bak.*` 覆盖 `upstreams.json`，在管理页点“从文件重新加载”（或重启容器）。

## 网关 API Key（调用方凭证）

- 调用方以 `Authorization: Bearer <网关 Key>` 调用 `/v1/*`（chat / embeddings / rerank / models），校验通过才转发；上游的 user_key、API Key 由网关按上游配置附加，调用方无需也无法接触。
- 在管理页“网关 API Key”中管理：生成（明文**只显示一次**）、停用 / 启用、改名、删除，立即生效，无需重启。可同时存在多个 Key，便于按调用方分发。
- 存储：`upstreams.json` 的 `apiKeys`，只存 SHA-256，明文不落盘。至少保留一个启用的 Key（停用 / 删除最后一个会被拒绝）。
- 迁移：首次启动若 `apiKeys` 为空，把 yaml 的 `gatewayApiKey` 导入为“默认”Key，现有调用方不受影响；之后 yaml 的 `gatewayApiKey` 不再使用。
- 更换 Key：生成新 Key → 发给调用方 → 在列表看“最近使用 / 调用次数”（自网关启动统计），确认旧 Key 不再被使用 → 停用旧 Key（观察一段时间无误后删除）。

## 思考（推理）开关

上游（`qwen3-5-397b`、`histar-ultra`/GLM-5.2）唯一都认的开关是 `chat_template_kwargs.enable_thinking`。网关把常见写法统一翻译成它，并从请求体移除其它别名（避免上游误读，例如 GLM 收到 `thinking_budget` 会回答失控）。

| 优先级 | 写法 | 来源 | 开 | 关 |
|---|---|---|---|---|
| 1 | `chat_template_kwargs.enable_thinking` | vLLM / SGLang（Qwen3） | `true` | `false` |
| 2 | `chat_template_kwargs.thinking` | vLLM DeepSeek-V3.1 | `true` | `false` |
| 3 | `enable_thinking` | 阿里云百炼 DashScope、硅基流动 | `true` | `false` |
| 4 | `thinking: {"type": ...}` | 智谱 GLM、火山方舟、Anthropic、Kimi | `enabled` | `disabled`（`auto` = 未指定） |
| 5 | `reasoning: {...}` | OpenRouter | `enabled:true` / `effort` / `max_tokens>0` | `enabled:false` / `max_tokens:0` |
| 6 | `reasoning_effort` | OpenAI | `low`/`medium`/`high`/`xhigh` | `none`/`minimal` |
| 7 | `thinking_budget` | DashScope / Gemini | `>0` 或 `-1` | `0` |
| 8 | 都没传 | 管理页模型路由的 **默认思考** 开关（默认关） | | |

- 多个写法同时出现时按优先级取第一个；以上字段放在 `extra_body` 里同样识别。布尔值也接受 `"true"/"false"`、`1/0`。
- 取值非法（如 `reasoning_effort: "ultra"`）返回 400，不静默忽略。
- 只控制开/关：`effort`、`budget_tokens`、`thinking_budget` 的数值不下发（上游不支持推理深度控制，实测无效）。
- 响应原样透传：开启思考时返回 `reasoning_content`。
- 响应头 `x-gateway-thinking: on|off;source=<生效的写法>` 便于排查。
