# Requirements Document

## Introduction

对一汽奥迪APP自动任务系统的发帖功能进行优化升级。主要包括：引入全局发帖人设提示（Global Post Prompt）以统一内容风格，支持根据帖子内容智能关联APP热门话题，优先生成图文帖并智能匹配素材图片，以及允许发帖主题重复使用但内容不可重复且设置最大复用次数。

## Glossary

- **Auto_Post_Service**: 自动发帖服务，负责每日定时发帖任务的调度和执行
- **Global_Post_Prompt**: 全局发帖人设提示，包含用户个人信息和内容风格要求，所有帖子生成时均参考此配置
- **Content_Generator**: 内容生成器，调用AI大模型生成帖子标题和正文
- **Topic_Service**: 主题管理服务，负责发帖主题的CRUD和状态管理
- **Topic_Matcher**: 话题匹配器，根据帖子内容从APP热门话题中智能匹配关联话题
- **Image_Selector**: 图片选择器，根据帖子内容从素材库中智能选取贴合的图片
- **Real_API_Client**: 真实API客户端，负责与一汽奥迪APP服务端通信（图片上传、发帖、话题查询）
- **Post_History**: 发帖历史记录，记录每次发帖的主题、内容摘要和时间戳，用于去重校验
- **Material_Library**: 素材库，存储用户上传的图片素材，按目录组织
- **Web_Management_UI**: Web管理界面，运行在端口3000，提供系统配置和主题管理功能
- **Internet_Reference_Service**: 互联网参考服务，从小红书等平台查询相关帖子作为自由发帖的参考素材

## Requirements

### Requirement 1: 全局发帖人设提示

**User Story:** 作为系统管理员，我希望通过Web管理界面配置一个全局发帖人设提示，以便所有AI生成的帖子内容都符合统一的个人风格和身份设定。

#### Acceptance Criteria

1. WHEN Auto_Post_Service 执行发帖任务时，THE Auto_Post_Service SHALL 从 data/global-prompt.json 文件中读取最新的 Global_Post_Prompt 配置并传递给 Content_Generator
2. THE Global_Post_Prompt SHALL 包含以下字段：用户个人信息（车型、性别、年龄段，各字段最大长度50字符）和内容风格描述（最大长度500字符）
3. IF Global_Post_Prompt 配置为空或 data/global-prompt.json 文件不存在，THEN THE Content_Generator SHALL 仅使用社区风格分析结果（AnalysisSummary 中的 styleDescription）生成帖子内容，不注入人设信息
4. THE Content_Generator SHALL 将 Global_Post_Prompt 作为AI系统提示词的首要指令注入，当 Global_Post_Prompt 与社区风格分析结果冲突时，以 Global_Post_Prompt 的描述为准覆盖对应内容
5. THE Web_Management_UI SHALL 提供 Global_Post_Prompt 的编辑界面，包含用户个人信息各字段的独立输入框和内容风格描述的多行文本输入区域，支持管理员查看和修改人设配置
6. WHEN 管理员通过Web界面保存 Global_Post_Prompt 时，THE Web_Management_UI SHALL 校验内容风格描述字段不超过500字符，校验通过后将配置持久化到 data/global-prompt.json 文件，并向管理员显示保存成功的反馈提示
7. IF 管理员提交的 Global_Post_Prompt 内容风格描述超过500字符，THEN THE Web_Management_UI SHALL 拒绝保存并显示错误提示，指明字段超出长度限制
8. IF Auto_Post_Service 读取 data/global-prompt.json 文件失败（文件损坏或读取异常），THEN THE Auto_Post_Service SHALL 记录错误日志并按 Global_Post_Prompt 为空的逻辑继续执行发帖任务

### Requirement 2: 智能话题关联

**User Story:** 作为系统管理员，我希望发帖时能自动关联APP中适合的热门话题，以便帖子获得更多曝光和互动。

#### Acceptance Criteria

1. WHEN 帖子内容生成完成后，THE Topic_Matcher SHALL 调用热门话题API获取当前热门话题列表，并在10秒内完成请求
2. THE Topic_Matcher SHALL 将帖子标题和正文内容连同候选话题列表（包含话题名称和热度）一并提交给AI大模型，由AI判断并返回与帖子内容语义相关的话题
3. THE Topic_Matcher SHALL 关联零个到最多5个话题，AI返回超过5个时仅保留前5个
4. IF AI大模型判定没有与帖子内容相关的候选话题，THEN THE Topic_Matcher SHALL 返回空列表，帖子以无话题方式发布
5. WHEN Topic_Matcher 返回非空话题列表时，THE Real_API_Client SHALL 在发帖请求的 topicList 字段中携带匹配到的话题，每个话题包含 name（格式为"#话题名称#"）和 id 字段
6. THE Topic_Matcher SHALL 使用AI大模型进行语义匹配，输入为帖子完整内容和候选话题列表，输出为匹配话题的ID和名称列表
7. IF 热门话题API请求失败或超时，THEN THE Topic_Matcher SHALL 返回空列表，帖子以无话题方式继续发布流程

### Requirement 3: 智能图文发帖

**User Story:** 作为系统管理员，我希望系统优先发布图文帖子并自动选取贴合内容的图片，以便帖子质量更高、更容易成为精华帖。

#### Acceptance Criteria

1. WHEN Image_Selector 通过关键词匹配找到至少1张素材图片时，THE Image_Selector SHALL 选取1至9张图片随帖子一起发布；若匹配结果超过9张，则随机选取9张
2. WHEN Image_Selector 通过关键词匹配未找到任何素材图片时，THE Auto_Post_Service SHALL 发布纯文字帖子
3. THE Image_Selector SHALL 将帖子主题方向文本进行分词，以每个词作为关键词与素材库目录名称进行包含匹配，命中的目录下所有直属图片视为候选图片；当多个目录命中时，优先选取命中关键词数最多的目录下的图片
4. THE Real_API_Client SHALL 在发帖前将选中的图片通过 POST /mapi/attachment/v1/batch_upload（multipart/form-data）上传至CDN，获取公开访问URL
5. THE Real_API_Client SHALL 在发帖请求的 imgUrlList 字段中携带已上传图片的CDN URL列表
6. WHEN 主题配置中已指定素材路径（materialPaths）时，THE Image_Selector SHALL 仅使用指定路径下的素材图片，不再进行关键词智能匹配
7. IF 图片上传过程中部分图片上传失败，THEN THE Real_API_Client SHALL 仅使用已成功上传的图片URL继续发帖；若全部图片上传失败，则以纯文字方式发布帖子

### Requirement 4: 主题复用与内容去重

**User Story:** 作为系统管理员，我希望发帖主题可以重复使用但帖子内容不会重复，以便减少主题维护工作量同时保证内容多样性。

#### Acceptance Criteria

1. THE Topic_Service SHALL 为每个主题维护使用计数（useCount，初始值为0）和最大复用次数（maxUseCount，取值范围1至100）字段
2. IF 主题的 useCount 小于 maxUseCount，THEN THE Topic_Service SHALL 将该主题视为可用状态，纳入 getNextAvailableTopic 的候选范围
3. IF 主题的 useCount 达到 maxUseCount，THEN THE Topic_Service SHALL 将该主题标记为已耗尽，不再分配使用
4. WHEN 使用某主题发帖时，THE Auto_Post_Service SHALL 将该主题下所有历史帖子的内容摘要（每条不超过200字符）传递给 Content_Generator 作为去重参考
5. THE Content_Generator SHALL 确保新生成的帖子标题与同主题下的历史帖子标题不相同，且正文内容在主题角度、论述重点或叙事结构上与历史帖子有明显差异
6. THE Topic_Service SHALL 支持通过 Web_Management_UI 设置和修改每个主题的 maxUseCount（默认值为1，保持向后兼容）
7. WHEN 主题发帖成功后，THE Topic_Service SHALL 将 useCount 加1，并记录本次发帖的内容摘要（包含标题和正文前200字符的截取）
8. IF Content_Generator 生成的内容与同主题历史帖子标题相同，THEN THE Auto_Post_Service SHALL 重新请求生成，最多重试2次，若仍重复则跳过该主题并记录警告日志

### Requirement 5: 完整发帖流程实现

**User Story:** 作为系统管理员，我希望系统能够完成真实的发帖操作（包括图片上传和话题关联），以便帖子能够实际发布到一汽奥迪APP社区。

#### Acceptance Criteria

1. THE Real_API_Client SHALL 实现图片上传功能，调用 `/mapi/attachment/v1/batch_upload` 端点以 multipart/form-data 格式将本地图片上传至CDN，每次上传最多 9 张图片，单张图片不超过 10MB，并从响应中提取返回的 CDN URL 列表供发帖请求使用
2. THE Real_API_Client SHALL 实现发帖功能，调用 `/cnapi/v1/community/subject/publish` 端点发布帖子，请求体包含 type（固定为0）、topicList（关联话题ID列表）、momentDto（含 imgUrlList、content、contentJson）、vrfCode、ipRegion 和 confirmPublish（固定为false）字段
3. THE Real_API_Client SHALL 构建 contentJson 字段为结构化富文本 JSON（包含文本段落和图片引用），vrfCode 字段为 Base64 编码的 Protobuf 数据（包含 deviceId、当前时间戳、随机签名和固定值"1"），ipRegion 从配置文件读取
4. THE Real_API_Client SHALL 实现热门话题查询功能，调用 `/cnapi/v1/community/topic/hot` 端点获取可关联的话题列表，传入 current、pageSize（默认不超过20）、nonce 和 timestamp 参数，并返回话题ID和名称的结构化列表
5. IF 图片上传全部失败或上传端点返回非零 code，THEN THE Auto_Post_Service SHALL 跳过图片，以纯文字方式（imgUrlList 为空数组）继续发帖，并记录警告日志说明图片上传失败原因
6. IF 发帖请求返回非零 code，THEN THE Real_API_Client SHALL 记录包含错误 code 和 message 的错误日志，并返回 `{success: false, postId: ''}` 结果
7. WHEN Real_API_Client 收到图片上传或发帖请求的响应时，THE Real_API_Client SHALL 检查响应头中的 x-access-token 字段，若存在新 Token 则通过 TokenRenewalCallback 触发 Token 续期保存
8. IF 部分图片上传成功而部分失败，THEN THE Auto_Post_Service SHALL 仅使用上传成功的图片 CDN URL 继续发帖，并记录警告日志说明失败图片数量

### Requirement 6: 自由发帖模式（互联网参考）

**User Story:** 作为系统管理员，我希望在没有可用主题时系统能从互联网（如小红书）查找相关帖子作为参考来生成内容，以便自由模式下也能产出高质量帖子。

#### Acceptance Criteria

1. WHEN 没有可用的预配置主题时，THE Auto_Post_Service SHALL 进入自由发帖模式并调用 Internet_Reference_Service
2. THE Internet_Reference_Service SHALL 使用可配置的搜索关键词（默认包含"奥迪"及车型相关词）从互联网平台（如小红书）查询相关帖子作为参考素材
3. THE Content_Generator SHALL 基于互联网参考素材进行整合和改写，生成符合 Global_Post_Prompt 人设的原创帖子内容
4. THE Content_Generator SHALL 确保生成的内容中不包含与任一参考素材连续相同超过30个字符的片段，不得完整复制原文句子或段落
5. WHEN 互联网查询在配置的超时时间内未返回结果或返回错误时，THE Auto_Post_Service SHALL 回退到基于社区分析数据的自由生成模式
6. THE Internet_Reference_Service SHALL 每次查询返回不超过5篇参考帖子，供AI选择性参考
7. THE Auto_Post_Service SHALL 将本次互联网参考模式生成的帖子内容摘要记录到 Post_History 中，后续生成时将最近发帖历史传递给 Content_Generator 以避免内容重复
8. THE Internet_Reference_Service SHALL 对同一平台的查询频率限制为每小时不超过10次，避免因频繁请求被封禁
