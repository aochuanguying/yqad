## 为什么

当前互联网发帖系统虽然支持知乎、小红书、汽车之家三个平台，但在搜索词选择、AI 提示词、平台选择策略等方面缺乏针对性优化，导致生成的内容风格单一、搜索效率低下、平台适配性差。需要根据各平台特点进行深度优化，提升发帖质量和效果。

## 变更内容

1. **新增分平台搜索词优化策略**：针对三个平台的技术实现差异和用户搜索习惯，实现智能搜索词选择逻辑
2. **新增分平台 AI 提示词优化策略**：根据平台内容风格（小红书种草风、知乎专业风、汽车之家车主风），实现差异化内容生成
3. **优化平台选择策略**：基于发帖目的、内容类型、目标受众，实现智能平台推荐和轮询机制
4. **优化图片选择策略**：根据平台图片偏好（小红书精美风、知乎信息图、汽车之家实拍图），实现智能图片匹配
5. **优化配置管理**：在数据库中分平台配置搜索词库、优先级、频率限制等参数

## 功能 (Capabilities)

### 新增功能

- `platform-aware-search`: 根据平台技术实现和用户习惯智能选择搜索词
- `platform-style-generator`: 根据平台内容风格生成差异化的 AI 提示词
- `smart-platform-selector`: 基于发帖目的和受众智能推荐平台
- `platform-image-matcher`: 根据平台图片偏好智能选择素材图片

### 修改功能

- `internet-reference-service`: 搜索词选择逻辑从单一策略改为分平台策略
- `content-generator`: AI 提示词从通用模板改为分平台模板
- `hybrid-material-service`: 图片选择从质量优先改为平台风格优先
- `search-manager`: 平台选择从简单轮询改为智能推荐 + 轮询混合策略

## 影响

**受影响的代码**:
- `src/services/internet-reference-service.ts`: 搜索词选择逻辑重构
- `src/services/internet-search/search-manager.ts`: 平台选择策略优化
- `src/ai/content-generator.ts`: AI 提示词分平台适配
- `src/services/hybrid-material-service.ts`: 图片选择策略优化
- `src/storage/mysql/internet-reference-storage.ts`: 配置管理增强

**受影响的数据库表**:
- `internet_reference_config`: 新增 platform 字段，分平台配置搜索词
- `internet_reference_platforms`: 新增 priority 字段，支持动态优先级

**API 变更**:
- 无破坏性变更，现有 API 向后兼容

**依赖项**:
- 无新增外部依赖
- 需要更新数据库配置（提供 SQL 脚本）
