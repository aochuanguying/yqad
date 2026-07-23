# Requirements Document

## Introduction

为 AI Provider 配置扩展多模态（vision）支持能力。当前素材整理流程中，AI 生成描述和标签仅基于文件名和元数据文字推断，未将图片内容实际传递给大模型。本功能通过在 AI Provider 配置中新增多模态支持标识字段，使素材整理流程能够根据 `enableVision` 开关和 provider 能力，将图片以 base64 编码传递给支持 vision 的模型，实现真正的视觉分析；在没有 vision provider 可用时，降级为当前的纯文件名推测方式。

## Glossary

- **AI_Provider**：系统中配置的大模型服务提供商实例，存储在 MySQL `ai_providers` 表中
- **Vision_Provider**：标记为支持多模态（vision）的 AI_Provider
- **素材处理器（Material_Processor）**：负责提取图片元数据、AI 生成描述和标签的服务模块
- **AI_Client**：统一的 AI 服务客户端，负责调用大模型 API 并管理兜底链路
- **enableVision**：素材处理配置中的开关字段，控制是否启用视觉分析
- **FallbackChain**：AI 调用的兜底链路，按优先级尝试多个 provider
- **前端配置管理界面（Admin_Panel）**：Web 端管理后台，用于查看和修改各项系统配置

## Requirements

### 需求 1：AI Provider 多模态字段扩展

**用户故事：** 作为系统管理员，我希望能在 AI Provider 配置中标识某个模型是否支持多模态，以便系统在需要视觉分析时选择正确的 provider。

#### 验收标准

1. THE AI_Provider 数据表 SHALL 包含 `supports_vision` 字段，类型为 `TINYINT(1)`，默认值为 `0`（表示 false），字段注释为"是否支持多模态"
2. THE AI_Provider 存储层 SHALL 在创建表的 DDL 中包含 `supports_vision` 字段，并在所有返回 `AIProviderConfig` 的查询方法（`getEnabledProviders`、`getAllProviders`、`getProviderByName`）的 SELECT 列表中包含该字段
3. THE AI_Provider 存储层的 `saveProvider` 和 `saveProviders` 方法 SHALL 在写入时持久化 `supportsVision` 字段值
4. THE AI_Provider 配置接口 SHALL 在 `src/storage/mysql/ai-provider-storage.ts` 和 `src/utils/config.ts` 两处的 `AIProviderConfig` 类型中均暴露 `supportsVision` 可选布尔属性（类型为 `boolean`，可选，默认值视为 `false`）
5. WHEN AI_Provider 存储层初始化时检测到 `supports_vision` 字段不存在, THE AI_Provider 存储层 SHALL 自动执行 `ALTER TABLE ai_providers ADD COLUMN supports_vision TINYINT(1) DEFAULT 0` 添加该字段
6. IF `ALTER TABLE` 添加 `supports_vision` 字段执行失败, THEN THE AI_Provider 存储层 SHALL 记录错误日志并抛出异常，阻止存储层标记为初始化完成

### 需求 2：AI Client 多模态消息支持

**用户故事：** 作为开发者，我希望 AI Client 能够发送包含图片内容的多模态消息，以便支持 vision 的模型可以分析图片。

#### 验收标准

1. THE AI_Client 的 `GenerateContentOptions` 接口 SHALL 包含可选的 `images` 字段，类型为 base64 编码字符串数组，每次请求最多传递 5 张图片，单张图片 base64 编码后大小不超过 10MB
2. IF `images` 字段存在且非空, THEN THE AI_Client SHALL 将 user message 构造为 OpenAI Vision API 的 content 数组格式，包含一个 `type: "text"` 元素和每张图片对应的 `type: "image_url"` 元素，其中 `image_url.url` 值为 `data:image/jpeg;base64,{base64字符串}` 格式，`detail` 字段设为 `auto`
3. IF `images` 字段不存在或为空数组, THEN THE AI_Client SHALL 保持当前的纯文本 message 格式（`{ role: "user", content: string }`）不变
4. IF `images` 数组中包含非法 base64 字符串（含有非 base64 合法字符）, THEN THE AI_Client SHALL 抛出错误，错误信息指明无效图片的索引位置，且不发送请求到 AI Provider
5. THE AI_Client SHALL 支持 `image/jpeg`、`image/png`、`image/gif`、`image/webp` 四种图片 MIME 类型，开发者通过 base64 字符串前无需携带 data URI 前缀，系统默认使用 `image/jpeg` 作为 MIME 类型

### 需求 3：素材处理器视觉分析集成

**用户故事：** 作为系统管理员，我希望素材整理时能利用 AI 视觉能力分析图片内容，以生成更准确的描述和标签。

#### 验收标准

1. WHEN `enableVision` 配置为 `true` 且 ai_providers 表中存在 enabled=1 且 supports_vision=1 的记录, THE Material_Processor SHALL 读取图片文件并将其以 base64 编码后作为 image_url 类型的 content 传递给 AI_Client，同时在 userPrompt 中附带文件名和元数据信息
2. WHEN `enableVision` 配置为 `true` 但 ai_providers 表中不存在 enabled=1 且 supports_vision=1 的记录, THE Material_Processor SHALL 降级为当前的纯文件名推测方式并记录一条 warn 级别日志，日志内容包含降级原因
3. WHEN `enableVision` 配置为 `false`, THE Material_Processor SHALL 使用当前的纯文件名推测方式，不读取图片文件内容
4. WHEN 图片需要进行 Vision 分析时, THE Material_Processor SHALL 将图片压缩至长边不超过 2048px、JPEG quality 为 85 后再进行 base64 编码，确保编码后数据不超过 20MB
5. IF 压缩后的 base64 数据仍超过 20MB, THEN THE Material_Processor SHALL 降级为纯文件名推测方式并记录一条 warn 级别日志，日志内容包含文件路径和实际数据大小
6. IF 图片文件读取或编码过程中发生异常, THEN THE Material_Processor SHALL 降级为纯文件名推测方式并记录一条 error 级别日志，日志内容包含文件路径和错误信息
7. WHILE `enableVision` 为 `true` 且使用 Vision_Provider 调用时, THE Material_Processor SHALL 将单次 Vision 请求的超时时间设置为 60 秒

### 需求 4：Vision Provider 选择与兜底

**用户故事：** 作为系统管理员，我希望系统在进行视觉分析时优先选用支持 vision 的 provider，并在所有 vision provider 不可用时自动降级。

#### 验收标准

1. WHEN FallbackChain 的 `execute` 方法被调用且 `requireVision` 参数为 `true` 时, THE FallbackChain SHALL 仅在 `supports_vision` 为 `true` 的 provider 中按 `providerOrder` 配置顺序依次尝试，跳过所有未标记 `supports_vision` 的 provider
2. IF `requireVision` 参数为 `true` 且所有 Vision_Provider 均调用失败, THEN THE FallbackChain SHALL 返回 `success: false` 的结果，由调用方 Material_Processor 降级为纯文件名推测方式并记录错误日志
3. THE FallbackChain 的 `execute` 方法 SHALL 接受可选的 `requireVision` 布尔参数，默认值为 `false`；当该参数为 `false` 或未指定时，按现有逻辑在所有已配置 provider 中执行兜底
4. IF `requireVision` 参数为 `true` 但当前无任何 provider 标记为 `supports_vision`, THEN THE FallbackChain SHALL 立即返回 `success: false` 的结果且不发起任何 AI 调用

### 需求 5：前端管理界面支持

**用户故事：** 作为系统管理员，我希望能在前端配置管理界面中查看和设置 provider 的多模态支持属性。

#### 验收标准

1. THE Admin_Panel 的 AI Provider 配置表单 SHALL 在每个 provider 配置区域包含"支持多模态"开关控件，新增 provider 时该开关默认为关闭状态
2. WHEN 管理员修改"支持多模态"开关后保存, THE Admin_Panel SHALL 将 `supportsVision` 布尔字段随其他配置一并提交到后端
3. WHEN Admin_Panel 从后端加载 AI Provider 配置数据时, THE Admin_Panel SHALL 根据每个 provider 返回的 `supportsVision` 字段值设置对应开关控件的开启或关闭状态
4. IF 保存 `supportsVision` 配置时后端返回错误, THEN THE Admin_Panel SHALL 显示包含错误原因的提示信息，且开关控件恢复到保存前的状态
