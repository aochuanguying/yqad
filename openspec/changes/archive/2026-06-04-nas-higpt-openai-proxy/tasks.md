## 1. 配置与安全边界

- [x] 1.1 为 OpenAI 网关新增配置项（HiGPT baseURL/apiKey/user_key、上游代理 URL、网关对外 API Key、超时等）
- [x] 1.2 实现网关鉴权中间件（校验 `Authorization: Bearer <gateway_api_key>`，失败返回 OpenAI 风格 401）
- [x] 1.3 规范化日志脱敏（确保不记录外部 Authorization 明文与 `HIGPT_*` 明文）

## 2. OpenAI 兼容路由

- [x] 2.1 新增 `GET /v1/models` 路由并返回 OpenAI 兼容结构（至少包含 data[].id）
- [x] 2.2 新增 `POST /v1/chat/completions` 路由并完成请求校验（`model`/`messages` 缺失时返回 400）
- [x] 2.3 实现模型别名映射（例如 `higpt` → `qwen3-5-397b`），并在 models 列表中体现

## 3. 上游 HiGPT 适配与代理

- [x] 3.1 实现 HiGPT 上游客户端（注入 `user_key` query，透传请求体与响应体）
- [x] 3.2 实现上游代理支持（HTTP + SOCKS），并以单一配置项选择代理类型与地址
- [x] 3.3 实现上游超时处理与错误映射（上游 401/403 → 502；超时 → 504；其余错误 → 502）

## 4. 测试

- [x] 4.1 为鉴权失败场景添加测试（缺少 Authorization、token 不匹配）
- [x] 4.2 为 `/v1/models` 添加测试（200，data[].id 存在）
- [x] 4.3 为 `/v1/chat/completions` 添加测试（请求转发、注入 user_key、错误映射、超时）

## 5. 部署与使用说明

- [x] 5.1 补充 NAS 部署示例（Docker Compose 环境变量/配置示例、端口暴露与反向代理建议）
- [x] 5.2 更新示例脚本（展示将 OpenAI SDK 的 baseURL 指向 NAS 网关并成功调用 HiGPT）
