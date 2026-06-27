## 上下文

- HiGPT（公司内网）在标准 OpenAI 形态基础上额外要求 `user_key`（URL query），且其地址仅在公司内网可访问。
- 大量第三方应用仅支持标准 OpenAI 配置项（`base_url` + `api_key`），无法追加 query 参数或自定义 header，因此无法直连 HiGPT。
- 家庭网络有一台群晖 NAS，具备可直通公司内网的代理：
  - SOCKS: `192.168.50.50:1080`
  - HTTP: `192.168.59.50:10800`
- 本仓库是一个 Node.js/TypeScript 项目，已使用 Express 提供 Web 服务（见 `src/web/server.ts`），并已使用 `openai` SDK 在业务逻辑中调用模型。

## 目标 / 非目标

**目标：**

- 在 NAS 上提供一个对外可访问的 OpenAI 兼容接口（HTTP），使第三方软件能够以“标准 OpenAI”方式调用。
- 网关对内通过 NAS 代理访问 HiGPT，并自动注入 `user_key`，屏蔽非标准调用差异。
- 最小可用范围优先覆盖：
  - `GET /v1/models`
  - `POST /v1/chat/completions`
- 具备可配置的安全边界（至少一个网关 API Key 校验），避免网关裸奔暴露在外网。

**非目标：**

- 不追求 100% 覆盖 OpenAI 全部接口（如 Assistants、Files、Realtime、Images 等）。
- 不实现复杂的多租户（多用户 keys、配额分配、审计）体系；仅提供单租户/单 Key 的可用实现。
- 不在本阶段做“公司内网到外网”的通用隧道化方案（如 VPN、FRP）；只做应用层网关。

## 决策

### 1) 以“OpenAI 兼容网关”作为独立模块接入现有 Express 服务

**选择：**在现有 Web 服务中新增一组路由（例如 `src/web/routes/openai-gateway-routes.ts`），由同一进程对外提供 `/v1/*` 接口；部署时沿用现有 Docker/Compose。

**理由：**

- 仓库已有 Express、日志、配置与 Docker 化基础，复用成熟的启动与运维方式。
- 将网关能力纳入同一配置体系（`config/default.yaml` 与现有 `src/utils/config.ts`）便于 NAS 部署时集中管理。

**备选：**

- 单独新建一个独立服务（单独 entrypoint）。隔离更强，但需要额外的构建/部署脚手架与端口管理。

### 2) “外部 OpenAI key” 与 “内部 HiGPT 认证” 解耦

**选择：**

- 外部：网关校验 `Authorization: Bearer <GATEWAY_API_KEY>`（或配置多个 Key，但默认单 Key）。
- 内部：网关使用服务端配置的 `HIGPT_API_KEY`（Bearer）+ `HIGPT_USER_KEY`（query）访问 HiGPT。

**理由：**

- 第三方软件普遍只能配置一个 `api_key`，用它做网关鉴权最符合 OpenAI 使用习惯。
- 内部认证信息不暴露给外部调用方，减少泄露风险与配置复杂度。

**备选：**

- 直接复用外部 key 作为内部 key（透传）。风险大且不满足必须注入 `user_key` 的差异屏蔽目标。

### 3) 上游请求采用“可插拔代理”HTTP 客户端

**选择：**上游请求优先使用 Node 的 `fetch` 或 `axios`，并支持通过代理 agent 访问内网。代理配置以一个 URL 表达（例如 `socks5://192.168.50.50:1080` 或 `http://192.168.59.50:10800`）。

**理由：**

- 需要同时支持 SOCKS 与 HTTP 代理，且在 NAS 场景中代理是关键基础设施。
- 统一为“代理 URL”配置更易理解与运维。

**备选：**

- 只支持 HTTP 代理：实现简单但不满足现有 SOCKS 可用的前提。
- 让用户在客户端自己走代理：大量软件无法配置代理或无法只对单个 baseURL 生效。

### 4) 请求/响应保持“尽量透明”，但允许做最小适配

**选择：**

- 对 `POST /v1/chat/completions`：请求体尽量原样转发，仅做：
  - model 映射（允许别名，例如 `higpt` → `qwen3-5-397b`）
  - 强制追加 `user_key` 到上游 query
  - 统一上游 baseURL 与 path（HiGPT 透传 OpenAI 路径）
- 响应体尽量原样返回；只在必要时统一错误结构为 OpenAI 风格（`{ error: { message, type, code } }`）。

**理由：**

- 兼容性来自“行为接近标准 OpenAI”，透明转发能最大化覆盖第三方 SDK/客户端的隐式假设。

**备选：**

- 完全重构响应字段（例如把 `reasoning_content` 合并到 `content`）：会改变语义且可能破坏下游对扩展字段的使用。

## 风险 / 权衡

- 外网暴露风险 → 默认强制网关 API Key；日志脱敏（不记录 Authorization、`HIGPT_*`）；可选加入简单 rate limit
- 代理链路不稳定（家庭网络/公司内网波动）→ 明确超时、重试策略；对外返回可理解的错误信息
- 上游协议差异（HiGPT 可能有非标准字段/限流/错误码）→ 在网关层统一错误映射，保留上游 `request_id`/trace 信息（若有）
- 流式响应（SSE）兼容性复杂 → MVP 可先不支持或仅透传；后续再补齐并在规范中明确

## 迁移计划

1. 在代码中新增 OpenAI 网关路由与上游适配器
2. 增加配置项（见规范）：HiGPT baseURL/apiKey/user_key、代理 URL、外部网关 key、端口与超时
3. 在 NAS 上以 Docker Compose 启动服务，外网侧将第三方软件的 baseURL 指向 NAS 暴露地址
4. 回滚：停用网关路由或回退镜像版本；不影响现有自动签到/评论/发帖功能

## 待确认问题

- 外网访问方式：是否已有公网域名/反向代理（如群晖反代、Nginx、Cloudflare Tunnel），以及是否需要 TLS 终止在网关内完成
- 是否必须支持 `stream: true`（SSE）以兼容更多客户端（如 Open WebUI、LangChain 部分链路）
- 网关是否需要支持多上游（例如同时代理 GPT-5 外网地址与 HiGPT 内网地址）做统一入口
