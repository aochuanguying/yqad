# 群晖 NAS Docker 部署（OpenAI 兼容网关 / HiGPT 外网访问）

本文档用于把本项目部署到群晖 NAS，并对外提供标准 OpenAI 接口（`/v1/models`、`/v1/chat/completions`），由 NAS 通过代理访问公司内网 HiGPT，并自动注入 `user_key`。

---

## 1. 前置条件

- 群晖已安装 Container Manager（或 Docker 套件）
- NAS 到公司内网可达的代理二选一可用：
  - SOCKS：`192.168.50.50:1080`
  - HTTP：`192.168.59.50:10800`
- 你拥有 HiGPT 的：
  - `HIGPT_API_KEY`（Bearer token）
  - `HIGPT_USER_KEY`（query 参数）
- 你已规划外网接入方式（至少其一）：
  - 群晖反向代理（DSM 控制台）
  - 自建 Nginx（Docker）
  - Cloudflare Tunnel

---

## 2. 部署文件说明（已随仓库提供）

目录（推荐）：`deploy/higpt-openai-gateway/`（仅网关版）

- `docker-compose.yml`：NAS 项目编排文件（从项目源码构建镜像；要求 `Dockerfile` 位于 compose 同目录下的 `app/` 内）
- `.env.example`：环境变量模板（复制为 `.env` 使用）
- `config/local.yaml.example`：配置文件模板（复制为 `config/local.yaml` 使用）

建议部署目录结构（NAS 上）：

```
/volume1/docker/yqad/
  docker-compose.yml
  .env
  app/
    Dockerfile
    package.json
    package-lock.json
    src/
    config/
  config/
    local.yaml
  data/
  logs/
```

---

## 3. 方式 A：在群晖 Container Manager 中部署（推荐）

### 3.1 准备目录与文件

1) 在群晖「File Station」创建目录：`/volume1/docker/yqad/`

2) 将仓库里的部署文件复制到该目录：

- `deploy/nas-openai-gateway/docker-compose.yml` → `/volume1/docker/yqad/docker-compose.yml`
- `deploy/nas-openai-gateway/.env.example` → `/volume1/docker/yqad/.env`
- `deploy/nas-openai-gateway/config/local.yaml.example` → `/volume1/docker/yqad/config/local.yaml`

3) 将项目源码复制到 `/volume1/docker/yqad/app/`

必须包含 `Dockerfile`（以及 `package.json`、`src/`、`config/` 等）。否则会出现类似错误：

`unable to prepare context: ... lstat /volume1/Dockerfile: no such file or directory`

原因是：Container Manager 构建镜像时，build context 需要在 Project 目录内；如果只复制了 `docker-compose.yml`，但没有源码与 Dockerfile，Docker 就找不到构建上下文。

也可以在电脑上先生成最小 build context（只包含构建所需文件），再上传到 NAS：

```bash
node deploy/nas-openai-gateway/prepare-app.mjs
```

4) 创建运行目录：

- `/volume1/docker/yqad/data/`
- `/volume1/docker/yqad/logs/`

### 3.2 配置 .env（关键）

编辑 `/volume1/docker/yqad/.env`，至少设置：

- `OPENAI_GATEWAY_API_KEY`：对外访问网关用的 key（请设置强随机串）
- `HIGPT_API_KEY`、`HIGPT_USER_KEY`
- `HIGPT_PROXY_URL`：二选一
  - `socks5://192.168.50.50:1080`
  - `http://192.168.59.50:10800`

示例（不要照抄敏感值）：

```
OPENAI_GATEWAY_PORT=3000
OPENAI_GATEWAY_ENABLED=true
OPENAI_GATEWAY_API_KEY=your-strong-key

HIGPT_BASE_URL=https://inner-apisix.hisense.com/higpt-new/v1
HIGPT_API_KEY=your-higpt-api-key
HIGPT_USER_KEY=your-higpt-user-key
HIGPT_PROXY_URL=socks5://192.168.50.50:1080
HIGPT_TIMEOUT_MS=60000
```

### 3.3 在 Container Manager 创建 Project

1) 打开「Container Manager」→「Project」→「Create」
2) 选择 `docker-compose.yml` 所在目录：`/volume1/docker/yqad/`
3) 让其读取 compose 并启动

启动成功后，会生成容器：`higpt`

---

## 4. 方式 B：通过 SSH + docker compose 部署

在 NAS 开启 SSH 后执行：

```bash
cd /volume1/docker/yqad
docker compose up -d --build
docker compose ps
docker compose logs -n 200
```

---

## 5. 验证网关是否可用

### 5.1 局域网验证

```bash
curl -sS http://<NAS_LAN_IP>:3000/v1/models \
  -H "Authorization: Bearer <OPENAI_GATEWAY_API_KEY>"
```

应返回包含 `data[].id` 的 JSON。

### 5.2 Chat Completions 验证

```bash
curl -sS http://<NAS_LAN_IP>:3000/v1/chat/completions \
  -H "Authorization: Bearer <OPENAI_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"higpt",
    "messages":[{"role":"user","content":"用一句话介绍奥迪品牌的核心理念"}]
  }'
```

---

## 6. 第三方软件如何配置

- Base URL：`http://<你的NAS域名或IP>:3000/v1`
- API Key：填写 `OPENAI_GATEWAY_API_KEY`
- Model：`higpt`（默认别名）或 `qwen3-5-397b`

---

## 7. 外网访问建议（安全）

### 7.1 强烈建议

- 使用反向代理 + HTTPS
- 限制访问来源（IP 白名单、WAF、访问控制）
- `OPENAI_GATEWAY_API_KEY` 必须足够强，禁止使用短密码

### 7.2 群晖反向代理（思路）

在 DSM「控制面板」→「登录门户」→「高级」→「反向代理」中：

- 来源：`https://llm.example.com`
- 目标：`http://127.0.0.1:3000`

---

## 8. 常见问题排查

- 401：检查第三方软件是否带上了 `Authorization: Bearer <OPENAI_GATEWAY_API_KEY>`
- 502：通常是上游 HiGPT 不可达、代理不可用、或 HiGPT 鉴权失败
- 504：上游超时，调大 `HIGPT_TIMEOUT_MS` 或检查代理链路稳定性
