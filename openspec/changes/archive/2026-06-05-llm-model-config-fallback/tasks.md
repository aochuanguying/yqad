## 1. 类型与配置扩展

- [x] 1.1 在 `src/utils/config.ts` 中新增 `AIProviderConfig` 接口，包含 `name`、`apiKey`、`baseUrl`、`model`、`temperature?`、`maxTokens?` 字段（不再需要 `queryParams`，HiGPT 已通过网关代理为标准接口）
- [x] 1.2 在 `AIConfig` 类型中新增可选字段 `providers?: AIProviderConfig[]`
- [x] 1.3 在 `loadConfig` 返回后（或单独的 `normalizeAIConfig` 函数中）实现向后兼容归一化：若 `providers` 不存在，则将顶层 `ai.*` 字段包装为单元素数组

## 2. 配置文件更新

- [x] 2.1 更新 `config/default.yaml`，将两套注释配置合并为 `ai.providers` 数组，GPT 为第一个元素（主力），HiGPT 网关为第二个元素（备用，使用 NAS 网关地址如 `http://<NAS>:3000/v1`，模型 `higpt`，标准 OpenAI 接口格式）
- [x] 2.2 保留顶层 `ai.*` 字段注释说明，提示用户可使用旧格式（向后兼容）

## 3. AI 客户端重写

- [x] 3.1 在 `src/ai/client.ts` 中废弃 `openaiClient` 单例，改为按提供商索引缓存 `Map<number, OpenAI>` 实例（或按需创建）
- [x] 3.2 新增 `getProviderClient(provider: AIProviderConfig): OpenAI` 函数，根据提供商配置创建/获取对应的 `OpenAI` 实例（所有提供商均为标准 baseUrl + apiKey，无需 defaultQuery）
- [x] 3.3 重写 `generateContent` 函数：遍历 `providers` 数组，对每个提供商执行 `withRetry`（最多2次），捕获失败错误并记录 `warn` 日志后继续下一个，全部失败时抛出聚合错误
- [x] 3.4 在成功调用时以 `info` 级别记录：使用的提供商 baseUrl、模型名称、生成内容长度
- [x] 3.5 在 fallback 切换时以 `warn` 级别记录：原提供商 baseUrl、失败原因摘要、切换目标提供商 baseUrl
- [x] 3.6 更新 `resetAIClient` 函数，清除所有缓存的提供商实例

## 4. 测试验证

- [x] 4.1 在 `tests/` 中新增或更新 AI 客户端单元测试：验证单提供商成功调用路径
- [x] 4.2 新增测试：主力提供商失败时自动切换到备用提供商
- [x] 4.3 新增测试：所有提供商均失败时抛出聚合错误
- [x] 4.4 新增测试：旧版单一 `ai.*` 配置格式向后兼容归一化
- [x] 4.5 运行 `npm test` 确认所有测试通过
