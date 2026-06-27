## 为什么

HiGPT 是公司内网大模型服务，调用时除了标准 Bearer Token 外还必须额外传递 `user_key`（URL query 参数）。但市面上大量主流软件（如各类 Agent/工作流/知识库/IDE 插件）只支持标准 OpenAI 接口形态，无法追加额外参数，导致无法直接接入 HiGPT。

同时 HiGPT 部署在公司内网，家庭外网环境无法直连；但家庭网络中的群晖 NAS 已具备可直通公司内网的代理能力（SOCKS/HTTP）。因此需要在 NAS 上做一次二次封装：对外提供标准 OpenAI 兼容接口，对内通过代理访问 HiGPT 并自动补齐 `user_key`，从而让外网环境也能以“标准 OpenAI”方式使用公司内网模型能力。

## 变更内容

- 新增一个可部署在群晖 NAS 上的 OpenAI 兼容 HTTP 服务（OpenAI-compatible gateway）
- 对外暴露标准 OpenAI 路径（至少覆盖 `GET /v1/models`、`POST /v1/chat/completions`），供不支持额外参数的第三方软件直接配置使用
- 对内作为上游 HiGPT 的反向代理/适配层：
  - 自动在请求中注入 HiGPT 所需的 `user_key`（通过服务端配置而非客户端传参）
  - 支持通过 NAS 代理（SOCKS 或 HTTP）访问公司内网地址
  - 统一错误码与响应结构，尽量保持与 OpenAI SDK 期望一致
- 提供最小可用的部署方式（Docker Compose 或群晖容器部署说明/样例配置）

## 功能 (Capabilities)

### 新增功能

- `openai-compatible-gateway`: 在 NAS 上提供 OpenAI 兼容接口，并将请求通过代理转发到 HiGPT，上游自动注入 `user_key`，对外保持标准 OpenAI 形态

### 修改功能

- (无)

## 影响

- 新增一个独立服务/模块（建议放在 `apps/` 或 `services/` 目录，具体以仓库结构为准）
- 需要引入可配置项：HiGPT baseURL、HiGPT apiKey、HiGPT user_key、对外监听地址与鉴权方式、上游代理（SOCKS/HTTP）参数
- 需要考虑安全边界：外网暴露的接口鉴权、访问日志脱敏、请求速率限制（至少具备可配置的基础保护）
