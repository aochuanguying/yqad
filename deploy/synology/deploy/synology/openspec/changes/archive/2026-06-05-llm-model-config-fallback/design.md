## 上下文

当前 `src/ai/client.ts` 使用单例 `OpenAI` 客户端，从 `config.ai` 读取固定的单组配置（`apiKey`、`baseUrl`、`model`）。一旦该提供商不可用，`withRetry` 的重试都在同一个端点上进行，无法切换到备用模型。

项目实际有两个可用的 LLM 服务：
- **GPT（主力）**：外网 OpenAI 兼容服务（`http://47.104.95.133:16781/v1`），模型 `gpt-5.4-mini`
- **HiGPT 网关（备用）**：公司内网 HiGPT 已通过 NAS 部署的 OpenAI 兼容网关代理（`deploy/higpt-openai-gateway`），暴露为标准 OpenAI 接口（`http://<NAS>:3000/v1`），模型别名 `higpt`，无需 `queryParams` 等额外参数

配置文件 `config/default.yaml` 目前通过注释在两套配置间切换，无法实现自动降级。

## 目标 / 非目标

**目标：**
- 支持在配置中声明有序的提供商列表（`ai.providers[]`）
- 主力提供商失败后自动 fallback 到下一个，不需要人工干预
- 失败判定范围：网络错误、HTTP 4xx/5xx、认证失败、空响应
- 日志清晰记录：当前使用的提供商、切换事件、所有提供商耗尽时的聚合错误
- 向后兼容旧版单一 `config.ai` 配置格式

**非目标：**
- 运行时动态切换提供商（无需热重载）
- 多提供商并发/竞速调用
- 提供商健康检查心跳
- 基于成本或延迟的智能路由

## 决策

### 决策1：配置结构采用 `providers` 数组，向后兼容旧格式

**选择**：`config.ai` 新增可选的 `providers: []` 数组字段，每个元素包含完整的提供商配置（`name`、`apiKey`、`baseUrl`、`model`、`temperature`、`maxTokens`）。由于 HiGPT 已通过网关代理为标准 OpenAI 接口，所有提供商配置格式统一，不再需要 `queryParams` 字段。若 `providers` 不存在，则将现有的顶层 `ai.*` 字段自动包装为单元素数组，保持向后兼容。

**替代方案**：完全废弃旧格式——拒绝，会破坏现有 `config/local.yaml` 部署。

### 决策2：Fallback 在 `generateContent` 内按提供商顺序迭代

**选择**：`generateContent` 内部维护提供商列表，对每个提供商执行原有的 `withRetry`（最多2次），若该提供商所有重试均失败，则捕获错误继续尝试下一个，全部失败后抛出聚合错误。

**替代方案**：在 `withRetry` 内部注入 fallback 逻辑——拒绝，会污染通用重试工具，且耦合过重。

### 决策3：每个提供商创建独立的 `OpenAI` 实例，不复用单例

**选择**：废弃当前的 `openaiClient` 单例缓存，改为在调用时按需创建（或从 Map 中按提供商索引缓存）各自的 `OpenAI` 实例。

**理由**：不同提供商的 `baseURL` 不同，无法共用一个实例。由于 HiGPT 已通过网关代理为标准 OpenAI 接口，所有提供商均为纯 `baseURL + apiKey` 配置，实例创建逻辑统一。

### 决策4：向后兼容适配在 `loadConfig` / 类型层处理

**选择**：在 `src/utils/config.ts` 的 `AIConfig` 类型中新增 `providers?: AIProviderConfig[]`，并在 `loadConfig` 返回后做一次归一化（normalization），确保调用方始终拿到 `providers` 数组，不需要每处调用点都判断旧格式。`queryParams` 字段保留为可选以兼容旧配置，但新的 `providers` 格式中不再推荐使用。

## 风险 / 权衡

- **内网不可达风险** → ~~HiGPT 在外网环境无法访问~~。已通过 NAS 部署的 OpenAI 兼容网关解决，HiGPT 网关和主力 GPT 服务均为外网可达。唯一风险是 NAS 本身离线，可接受（家庭 NAS 正常在线）。
- **延迟增加** → Fallback 会在主力提供商失败并重试后才切换，最坏情况下延迟约 6-15 秒（2次重试 × 2-5秒延迟）。可接受：任务为后台调度，非实时。
- **配置迁移** → 现有 `config/local.yaml` 不需要修改（向后兼容），但建议用户迁移到 `providers` 数组格式以获得完整 fallback 能力。

## 迁移计划

1. 更新 `src/utils/config.ts`：扩展类型，添加归一化函数
2. 更新 `config/default.yaml`：将两套注释配置合并为 `providers` 数组
3. 重写 `src/ai/client.ts`：多提供商迭代逻辑，废弃单例
4. 更新 `config/local.yaml.example`（如有）为新格式示例
5. 无需数据库迁移，无需停机

## Open Questions

- 无（当前范围已明确）
