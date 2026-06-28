## 1. 数据库配置

- [x] 1.1 创建数据库迁移脚本，为 `internet_reference_config` 表添加 `platform` 字段
- [x] 1.2 创建数据库迁移脚本，为 `internet_reference_platforms` 表添加 `priority`、`rate_limit_per_hour`、`success_rate` 字段
- [x] 1.3 编写初始化 SQL 脚本，为三个平台（小红书、知乎、汽车之家）配置初始搜索词库
- [x] 1.4 编写初始化 SQL 脚本，设置三个平台的初始优先级（小红书 8、知乎 7、汽车之家 8）
- [x] 1.5 在 `internet-reference-storage.ts` 中实现 `getConfigByPlatform` 接口
- [x] 1.6 在 `internet-reference-storage.ts` 中实现 `updatePlatformPriority` 接口
- [x] 1.7 在 `internet-reference-storage.ts` 中实现 `recordSuccess` 接口

## 2. 搜索词选择优化

- [x] 2.1 在 `search-manager.ts` 中创建 `ISearchKeywordSelector` 接口定义
- [x] 2.2 实现 `PlatformAwareKeywordSelector` 类，包含三个平台的搜索词选择策略
- [x] 2.3 实现小红书搜索词选择逻辑：从预配置词库选择，避免频繁更换
- [x] 2.4 实现知乎搜索词选择逻辑：使用专业术语和问题形式
- [x] 2.5 实现汽车之家搜索词选择逻辑：使用单个高频论坛术语
- [x] 2.6 在 `search-manager.ts` 的 `search` 方法中集成搜索词选择器
- [x] 2.7 添加搜索词效果记录逻辑，记录搜索成功率和素材质量
- [x] 2.8 实现 `analyzeKeywordEffectiveness` 分析接口

## 3. AI 提示词分平台优化

- [x] 3.1 在 `content-generator.ts` 中创建 `IPromptBuilder` 接口定义
- [x] 3.2 实现 `XiaohongshuPromptBuilder` 类，生成小红书风格提示词
- [x] 3.3 实现 `ZhihuPromptBuilder` 类，生成知乎风格提示词
- [x] 3.4 实现 `AutohomePromptBuilder` 类，生成汽车之家风格提示词
- [x] 3.5 实现 `selectPromptStyle` 方法，根据参考素材来源选择提示词风格
- [x] 3.6 在 `generatePost` 方法中集成分平台提示词生成逻辑
- [x] 3.7 实现提示词模板管理功能，支持加载、变量替换、版本控制
- [x] 3.8 实现内容适配性检查功能，对生成内容进行平台风格评分

## 4. 智能平台选择

- [x] 4.1 在 `search-manager.ts` 中实现 `calculateBasePriorities` 方法
- [x] 4.2 在 `search-manager.ts` 中实现 `adjustByRateLimit` 方法
- [x] 4.3 在 `search-manager.ts` 中实现 `adjustBySuccessRate` 方法
- [x] 4.4 在 `search-manager.ts` 中实现 `weightedRandomSelect` 权重随机选择算法
- [x] 4.5 重构 `selectNextPlatform` 方法，集成优先级 + 轮询混合策略
- [x] 4.6 实现平台使用统计记录功能（查询次数、成功率、素材质量）
- [x] 4.7 实现每天零点的计数器重置功能
- [x] 4.8 实现 `getPlatformPriorities` 和 `updatePlatformPriority` 接口

## 5. 图片选择优化

- [x] 5.1 在 `hybrid-material-service.ts` 中实现 `selectImagesForPlatform` 方法
- [x] 5.2 实现小红书图片选择逻辑：优先选择高清、精美、有滤镜的图片
- [x] 5.3 实现知乎图片选择逻辑：优先选择信息图、数据图、示意图
- [x] 5.4 实现汽车之家图片选择逻辑：优先选择实拍图、细节图、改装图
- [x] 5.5 实现图片质量评分功能（清晰度、美观度、信息量）
- [x] 5.6 实现图片关键词提取和匹配功能
- [x] 5.7 实现图片降级策略（高清图不足、平台偏好图不足、无图降级）
- [x] 5.8 在 `selectHybridMaterials` 方法中集成图片选择优化逻辑

## 6. 缓存和配置管理

- [x] 6.1 实现 Redis 配置缓存，过期时间设置为 5 分钟
- [x] 6.2 实现配置刷新接口，支持手动清除缓存
- [x] 6.3 在配置更新时自动清除 Redis 缓存
- [x] 6.4 实现配置同步延迟的监控和告警

## 7. 测试和验证

- [ ] 7.1 为搜索词选择器编写单元测试（覆盖三个平台）
- [ ] 7.2 为提示词构建器编写单元测试（覆盖三个平台）
- [ ] 7.3 为平台选择算法编写单元测试（覆盖各种场景）
- [ ] 7.4 为图片选择器编写单元测试（覆盖三个平台）
- [ ] 7.5 进行集成测试，验证整个发帖流程
- [ ] 7.6 进行 A/B 测试，对比优化前后的发帖效果
- [ ] 7.7 验证数据库配置更新的热加载功能

## 8. 文档和部署

- [x] 8.1 编写数据库迁移说明文档
- [x] 8.2 编写配置管理接口 API 文档
- [ ] 8.3 更新 README.md，说明新增的分平台优化功能
- [x] 8.4 编写部署清单，包括数据库迁移、配置更新、服务重启步骤
- [x] 8.5 编写回滚方案，包括数据库回滚、代码回退步骤
