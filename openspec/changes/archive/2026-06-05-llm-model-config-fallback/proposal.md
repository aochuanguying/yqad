## 为什么

当前系统的 LLM 模型配置为静态单一配置——仅支持一个 API 端点和模型。当主力 GPT 模型因网络不可达、密钥失效或服务故障而失败时，整个 AI 内容生成能力将完全瘫痪，无法降级到备用的 HiGPT 模型，导致当日任务（评论、发帖）全部跳过。

## 变更内容

- **新增**：多提供商模型配置结构，支持在配置文件中声明主备模型列表（`ai.providers[]`），首个为主力，后续为降级备选
- **新增**：AI 客户端自动 Fallback 机制——当主力模型调用失败（网络错误、认证失败、服务不可用）时，自动按顺序切换到下一个配置的提供商重试
- **修改**：`config/default.yaml` 的 `ai` 配置块，从单一配置改为 `providers` 数组，首个条目为 GPT（优先），第二个条目为 HiGPT 网关（备用，通过 NAS 部署的 OpenAI 兼容网关访问，标准接口无需额外参数）
- **修改**：`src/ai/client.ts` 的 `generateContent` 函数，加入多提供商迭代逻辑
- **修改**：日志输出，清晰记录当前使用的是哪个提供商、以及 fallback 切换事件

## 功能 (Capabilities)

### 新增功能

- `llm-model-fallback`: AI 客户端多提供商 Fallback 能力——按优先级尝试各提供商，失败则自动切换，全部失败时抛出聚合错误

### 修改功能

- `ai-content-gen`: 模型调用的容错需求升级——原"最多重试2次后跳过"调整为"先在当前提供商重试，全部提供商均失败后再跳过"

## 影响

- `config/default.yaml`：`ai` 配置结构变更（向后兼容，若保留旧格式则自动适配为单提供商模式）
- `src/ai/client.ts`：核心调用逻辑重写，影响所有使用 `generateContent` 的调用方（`content-generator.ts`）
- `src/utils/config.ts`：类型定义需扩展以支持 `providers` 数组结构
- HiGPT 备用提供商通过 NAS 上的 OpenAI 兼容网关（`deploy/higpt-openai-gateway`）访问，接口已标准化，无需 `queryParams` 等特殊参数
- 无 API 接口变更，无外部依赖新增
