# Implementation Plan: 发帖功能优化

## Overview

基于设计文档，将发帖优化功能拆分为6个核心模块的增量实现。每个模块独立可降级，按依赖顺序逐步实现：先建立基础设施（类型定义、辅助函数），再实现各独立服务，最后串联完整流程。测试框架使用 Jest + fast-check，所有属性测试紧跟对应实现。

## Tasks

- [x] 1. 基础类型定义与辅助函数
  - [x] 1.1 定义全局类型接口和数据模型
    - 在 `src/types/posting-optimization.ts` 中定义 GlobalPostPrompt、HotTopic、MatchedTopic、ReferencePost、PostSummary、PublishOptions 等接口
    - 扩展 `src/api/types.ts` 中的 PublishPostResponse 添加可选字段
    - _Requirements: 1.2, 2.5, 3.1, 4.1, 5.2_

  - [x] 1.2 实现 vrfCode 生成函数和 contentJson 构建函数
    - 在 `src/utils/publish-helpers.ts` 中实现 `generateVrfCode(deviceId: string): string` 和 `buildContentJson(content: string): string`
    - vrfCode 使用 Protobuf 编码（字段1=deviceId, 字段2=时间戳, 字段3=随机签名Base64, 字段4="1"）
    - contentJson 构建为 `[{content, inlineStyleEntities:[], blocktype:"block_normal_text"}]` 格式
    - _Requirements: 5.3_

  - [x] 1.3 编写 contentJson 构建正确性属性测试
    - **Property 8: contentJson 构建正确性（Round-Trip）**
    - 验证任意有效字符串经 buildContentJson 后输出为有效JSON、解析后为数组、第一个元素 content 字段等于原始内容
    - **Validates: Requirements 5.3**

  - [x] 1.4 编写 vrfCode 编码结构正确性属性测试
    - **Property 9: vrfCode 编码结构正确性**
    - 验证任意 deviceId 经 generateVrfCode 后输出为有效 Base64、解码后包含 deviceId、包含合法时间戳、包含固定值"1"
    - **Validates: Requirements 5.3**

- [x] 2. 全局发帖人设提示模块
  - [x] 2.1 实现 GlobalPromptService
    - 创建 `src/services/global-prompt-service.ts`
    - 实现 load()：从 `data/global-prompt.json` 读取配置，文件不存在或损坏返回 null 并记录日志
    - 实现 save()：验证通过后写入文件
    - 实现 validate()：检查 personalInfo 各字段 <= 50 字符、styleDescription <= 500 字符
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 1.8_

  - [x] 2.2 编写全局人设字段长度验证属性测试
    - **Property 1: 全局人设字段长度验证**
    - 使用 fast-check 生成任意长度字符串，验证 validate 函数对 <= 50/500 字符通过、超出拒绝
    - **Validates: Requirements 1.2, 1.6, 1.7**

  - [x] 2.3 修改 ContentGenerator 注入全局人设
    - 修改 `src/ai/prompts.ts` 中的 `buildPostSystemPrompt`，当 GlobalPostPrompt 存在时将人设信息作为首要指令注入系统提示词
    - 修改 `src/ai/content-generator.ts` 的 `generatePost` 函数签名，增加 `options?: PostGenerationOptions` 参数
    - 确保 GlobalPostPrompt 内容出现在 AnalysisSummary.styleDescription 之前
    - _Requirements: 1.1, 1.4_

  - [x] 2.4 编写 Prompt 构建顺序属性测试
    - **Property 2: Prompt 构建顺序（人设优先注入）**
    - 验证构建的系统提示词中 GlobalPostPrompt 内容的位置索引小于 styleDescription 的位置索引
    - **Validates: Requirements 1.4**

  - [x] 2.5 实现 Web 管理界面全局人设 API
    - 新增 `GET /api/global-prompt` 和 `PUT /api/global-prompt` 路由
    - PUT 请求校验 styleDescription 不超过500字符，失败返回400错误
    - 成功保存后返回200和成功消息
    - _Requirements: 1.5, 1.6, 1.7_

- [x] 3. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 4. 智能话题关联模块
  - [x] 4.1 扩展 RealApiClient 实现热门话题查询
    - 在 `src/api/real-client.ts` 中添加 `getHotTopics(token, page?, pageSize?)` 方法
    - 调用 `GET /cnapi/v1/community/topic/hot`，传入 current、pageSize、nonce、timestamp
    - 解析响应返回 HotTopic[] 列表，处理超时和错误
    - _Requirements: 2.1, 5.4_

  - [x] 4.2 实现 TopicMatcher 服务
    - 创建 `src/services/topic-matcher.ts`
    - 实现 `fetchHotTopics(token)`：调用 RealApiClient.getHotTopics，10秒超时
    - 实现 `matchTopics(title, content, candidates)`：调用 AI 大模型进行语义匹配，输入为帖子内容+候选话题列表，输出为匹配话题（0-5个）
    - 构建话题匹配 prompt，让 AI 返回 JSON 格式的匹配结果
    - 热门话题API失败或AI调用失败时返回空列表
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_

  - [x] 4.3 编写话题关联数量上限属性测试
    - **Property 3: 话题关联数量上限**
    - 验证 TopicMatcher 处理后的输出列表长度 0 <= length <= 5，即使 AI 返回超过5个
    - **Validates: Requirements 2.3**

- [x] 5. 智能图文发帖模块
  - [x] 5.1 实现 ImageSelector 服务
    - 创建 `src/services/image-selector.ts`
    - 实现关键词分词逻辑（按中文字符边界和标点分割主题方向文本）
    - 实现目录名称包含匹配：遍历素材库目录，检查目录名是否包含关键词
    - 多目录命中时优先选取命中关键词数最多的目录
    - 超过9张图片时随机选取9张，无匹配时返回空数组
    - 当 materialPaths 非空时直接使用指定路径，跳过智能匹配
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 5.2 编写图片选取数量约束属性测试
    - **Property 4: 图片选取数量约束**
    - 验证非空候选集返回 1-9 张，空候选集返回空数组
    - **Validates: Requirements 3.1, 3.2**

  - [x] 5.3 编写关键词目录匹配优先级属性测试
    - **Property 5: 关键词目录匹配优先级**
    - 验证命中关键词数量多的目录优先于命中少的目录
    - **Validates: Requirements 3.3**

  - [x] 5.4 扩展 RealApiClient 实现图片上传
    - 在 `src/api/real-client.ts` 中添加 `uploadImages(token, imagePaths)` 方法
    - 调用 `POST /mapi/attachment/v1/batch_upload`，以 multipart/form-data 格式上传
    - 最多上传9张图片，单张不超过10MB
    - 返回 `{urls: string[], failed: number}`，部分失败时仅返回成功的 URL
    - 检查响应头中 Token 续期
    - _Requirements: 3.4, 3.7, 5.1, 5.7, 5.8_

- [x] 6. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 7. 主题复用与内容去重模块
  - [x] 7.1 扩展 TopicService 支持复用
    - 修改 `src/web/services/topics-service.ts` 中的 Topic 接口，新增 useCount、maxUseCount、postHistory 字段
    - 修改 `getNextAvailableTopic`：判断条件从 `status === 'unused'` 改为 `useCount < maxUseCount`
    - 新增 `incrementUseCount(id, postSummary)` 方法：useCount +1 并记录 postSummary
    - 修改 `createTopic`：默认 useCount=0, maxUseCount=1
    - 确保向后兼容：已有 topics.json 中无 useCount 字段时默认按旧逻辑处理
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_

  - [x] 7.2 编写主题可用性不变量属性测试
    - **Property 6: 主题可用性不变量**
    - 验证 useCount < maxUseCount 等价于主题在候选列表中
    - **Validates: Requirements 4.2, 4.3**

  - [x] 7.3 编写使用计数递增属性测试
    - **Property 7: 使用计数递增**
    - 验证初始 useCount=n 时成功发帖后 useCount=n+1
    - **Validates: Requirements 4.7**

  - [x] 7.4 实现内容去重逻辑
    - 修改 `src/ai/content-generator.ts` 中的 `generatePost`：当 options.topicHistory 非空时，将历史摘要注入 prompt 要求 AI 避免重复
    - 在 `src/services/auto-post.ts` 中添加标题去重校验：比对新生成标题与历史标题，重复时最多重试2次
    - _Requirements: 4.4, 4.5, 4.8_

  - [x] 7.5 扩展 Web API 支持 maxUseCount 修改
    - 新增 `PATCH /api/topics/:id/max-use-count` 路由
    - 接受 `{maxUseCount: number}` 请求体（取值范围 1-100）
    - _Requirements: 4.6_

- [x] 8. 完整发帖流程实现模块
  - [x] 8.1 扩展 RealApiClient 实现发帖功能
    - 修改 `src/api/real-client.ts` 中的 `publishPost` 方法
    - 调用 `POST /cnapi/v1/community/subject/publish`，构建完整请求体
    - 包含 type=0、topicList、momentDto（imgUrlList+content+contentJson）、vrfCode、ipRegion、confirmPublish=false
    - 使用 `src/utils/publish-helpers.ts` 中的 generateVrfCode 和 buildContentJson
    - 处理响应：code=0 返回 {success:true, postId: data.id}，否则返回 {success:false}
    - 检查响应头 Token 续期
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 5.7_

  - [x] 8.2 改造 AutoPostService 完整发帖流程
    - 修改 `src/services/auto-post.ts` 串联所有新模块
    - 流程：读取 GlobalPrompt → 获取主题 → 生成内容（含去重） → 选取图片 → 上传图片 → 匹配话题 → 发帖
    - 各环节错误时按渐进降级策略处理
    - 发帖成功后：incrementUseCount、recordPostHistory
    - _Requirements: 1.1, 3.7, 5.5, 5.8_

- [x] 9. 自由发帖模式（互联网参考）模块
  - [x] 9.1 实现 InternetReferenceService
    - 创建 `src/services/internet-reference-service.ts`
    - 实现频率限制器：维护时间窗口内的查询计数（每小时不超过10次）
    - 实现 `search(keywords?)`：使用 AI 大模型或搜索 API 查询参考帖子
    - 每次返回不超过5篇参考帖子
    - 超时或错误时返回空数组
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.8_

  - [x] 9.2 编写频率限制不变量属性测试
    - **Property 11: 频率限制不变量**
    - 验证1小时窗口内前10次 canQuery() 返回 true，第11次返回 false，窗口重置后重新允许
    - **Validates: Requirements 6.8**

  - [x] 9.3 实现抄袭检测函数
    - 在 `src/utils/plagiarism-detector.ts` 中实现 `detectPlagiarism(content, references): boolean`
    - 检测生成内容中是否存在与任一参考素材连续相同 >= 30 字符的片段
    - _Requirements: 6.4_

  - [x] 9.4 编写内容原创性检测属性测试
    - **Property 10: 内容原创性检测**
    - 验证存在 >= 30 字符连续相同片段时返回 true，否则返回 false
    - **Validates: Requirements 6.4**

  - [x] 9.5 集成自由发帖模式到 AutoPostService
    - 修改 `src/services/auto-post.ts` 中的 `postFreeStyle` 方法
    - 无可用主题时调用 InternetReferenceService 获取参考
    - 将参考素材传入 ContentGenerator，生成后检测抄袭
    - 查询失败/频率超限时回退到社区分析模式
    - 记录发帖历史摘要供后续去重
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7_

  - [x] 9.6 添加互联网参考配置到 config/default.yaml
    - 新增 `internetReference` 配置段：enabled、searchKeywords、maxResults、timeout、rateLimitPerHour、platform
    - _Requirements: 6.2, 6.8_

- [x] 10. Final checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- Checkpoints 确保增量验证
- 属性测试验证设计文档中的11个正确性属性
- 单元测试验证具体示例和边界条件
- 所有模块遵循渐进降级策略，单点故障不阻塞核心发帖流程
- 已有的 topics.json 数据结构变更需向后兼容

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1", "9.6"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "4.1", "5.1", "7.1", "9.1", "9.3"] },
    { "id": 3, "tasks": ["2.4", "4.2", "5.2", "5.3", "5.4", "7.2", "7.3", "9.2", "9.4"] },
    { "id": 4, "tasks": ["4.3", "7.4", "7.5", "8.1"] },
    { "id": 5, "tasks": ["8.2", "9.5"] }
  ]
}
```
