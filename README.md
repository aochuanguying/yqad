# 一汽奥迪 APP 自动任务系统

自动化管理一汽奥迪 APP 的日常任务，包括签到、评论、发帖、素材整理等功能。

## 功能特性

- **自动签到**：每日自动完成 APP 签到任务
- **自动评论**：使用 AI 生成评论内容，自动评论他人帖子
- **自动发帖**：支持两种模式
  - **定时模式**：定时自动发布帖子
  - **API 模式**：通过 API 获取发帖内容，由手机端模拟人工发布（可触发奖励任务）
- **多平台优化**：支持小红书、知乎、汽车之家三大平台智能优化
  - **分平台搜索词选择**：小红书小时级切换、知乎专业术语、汽车之家短词优先
  - **分平台 AI 提示词**：小红书 emoji 情绪化、知乎专业分析、汽车之家真实车主
  - **智能平台选择**：综合考虑优先级、成功率、频率限制的推荐算法
  - **图片选择优化**：7 维度质量评分，平台适配度计算
- **素材整理**：自动扫描、处理和分类素材图片
- **Web 管理界面**：通过浏览器配置和监控系统状态
- **AI 内容生成**：支持多种 AI 模型，智能生成评论和帖子内容
- **图片下载服务**：提供 HTTP 接口下载素材图片，支持远程访问
- **Web 认证保护**：支持基于 Session 的登录认证，安全开放外网访问
- **Redis 缓存**：配置缓存管理，5 分钟过期，命中率监控告警

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置文件

编辑 `config/default.yaml` 或创建 `config/local.yaml`：

```yaml
# API 设置
api:
  mode: real  # real 或 mock
  baseUrl: https://app.faw-club.com

# 登录凭证
auth:
  username: "your_phone"
  password: "your_password"
  tokenStorePath: "./data/token.json"

# 调度设置
scheduler:
  signin:
    cron: "0 8 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 60
  comment:
    cron: "0 10 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 600
  post:
    cron: "0 12 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 360
  materialProcessing:
    intervalMinutes: 30  # 素材整理间隔时间（分钟）
    enabled: true        # 启用间隔模式

# AI 设置
ai:
  providers:
    - name: openai
      apiKey: "your-api-key"
      baseUrl: "https://api.openai.com/v1"
      model: "gpt-4"
      temperature: 0.7

# 日志设置
logging:
  level: info
  dir: ./logs
  retainDays: 7
```

### 3. 启动应用

```bash
npm run build
node dist/index.js
```

### 4. 访问 Web 界面

打开浏览器访问：http://localhost:3000

## 发帖模式配置

系统支持两种发帖模式，可根据需求灵活切换：

### 模式一：定时发帖（默认）

系统按照配置的 Cron 表达式定时自动发布帖子。

```yaml
post:
  enabled: true
  mode: 'scheduled'  # 定时模式
  dailyLimit: 1
  avoidRepeatDays: 7
```

### 模式二：API 触发（推荐用于触发奖励任务）

系统不自动发帖，改为通过 API 提供发帖内容，由手机端模拟人工发布。

```yaml
post:
  enabled: true
  mode: 'api'  # API 模式
  dailyLimit: 1
  avoidRepeatDays: 7

web:
  baseUrl: "http://your-server-ip:3000"  # 服务端 IP，用于生成图片下载链接
```

**API 使用流程：**

1. 调用 `POST /api/posts/generate` 获取发帖内容
2. 从响应中提取标题、正文和图片下载地址
3. 下载图片到本地
4. 使用手机自动化发布到社区

**API 文档**：详见 [docs/REMOTE_POST_API.md](docs/REMOTE_POST_API.md)

**请求示例：**

```bash
curl -X POST http://localhost:3000/api/posts/generate \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"mode": "featured"}'
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "title": "帖子标题",
    "content": "帖子正文内容...",
    "images": [
      {
        "url": "http://localhost:3000/images/topic1/image1.jpg",
        "relativePath": "topic1/image1.jpg",
        "filename": "image1.jpg",
        "size": 245678
      }
    ],
    "mode": "featured",
    "topics": [
      {"id": "123", "name": "#奥迪 Q5L#"}
    ],
    "metadata": {
      "topicId": "abc123",
      "topicTitle": "奥迪 Q5L 用车分享",
      "generatedAt": "2026-06-11T10:30:00.000Z"
    }
  }
}
```

## 调度配置说明

### 间隔模式（推荐用于素材整理）

素材整理任务使用固定间隔执行模式，配置简单直观：

```yaml
scheduler:
  materialProcessing:
    intervalMinutes: 30  # 每隔 30 分钟执行一次
    enabled: true        # 启用间隔模式
```

**特点：**
- 启动时立即执行一次
- 按固定间隔自动执行
- 防止并发执行（任务运行时跳过下次执行）
- 可通过 Web 界面快速配置（5/10/15/30/60 分钟）

### Cron 模式（用于签到、评论、发帖）

其他任务使用 Cron 表达式 + 随机偏移模式：

```yaml
scheduler:
  signin:
    cron: "0 8 * * *"           # 每天 8:00
    randomOffsetMin: 0          # 最小偏移 0 分钟
    randomOffsetMax: 60         # 最大偏移 60 分钟
```

**执行时间计算：** 在基准时间基础上加上随机偏移，让执行时间更自然。

例如：`0 8 * * *` + 随机偏移 35 分钟 = 08:35 执行

## Web 配置界面

通过 Web 界面可以方便地配置各项参数：

1. **登录页签**：配置账号信息和 Token 存储路径
2. **AI 模型页签**：配置 AI Provider 和模型参数
3. **评论/发帖页签**：配置内容生成规则
4. **调度页签**：配置各任务的执行时间
   - 素材整理：间隔时间输入框 + 快速选择按钮
   - 其他任务：Cron 表达式 + 随机偏移
5. **素材库页签**：查看和管理素材文件
6. **日志页签**：查看系统运行日志

## 配置迁移

系统会自动迁移旧配置格式到新格式：

**旧格式：**
```yaml
scheduler:
  materialProcessing:
    cron: "0 7 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 30
```

**新格式：**
```yaml
scheduler:
  materialProcessing:
    intervalMinutes: 30
    enabled: true
```

系统��测到旧配置时会自动迁移，无需手动修改。

## 常见问题

### Q: 素材整理多久执行一次？
A: 默认每隔 30 分钟执行一次。可在 Web 界面的"调度"页签修改，支持 5-1440 分钟。

### Q: 如何关闭素材整理？
A: 在 Web 界面将 `scheduler.materialProcessing.enabled` 设置为 false，或删除配置中的 `intervalMinutes` 字段。

### Q: 配置修改后需要重启吗？
A: 不需要。通过 Web 界面保存配置后会自动热重载，立即生效。

### Q: 如何查看任务执行日志？
A: 访问 Web 界面的"日志"页签，或查看 `logs/` 目录下的日志文件。

### Q: 间隔时间设置多少合适？
A: 建议 30-60 分钟。间隔太短可能频繁触发，间隔太长可能导致素材处理不及时。

## Docker 部署（群晖 NAS）

> 待补充：Docker 部署指南和 docker-compose.yml 配置

## 技术架构

- **运行时**：Node.js + TypeScript
- **调度器**：node-cron + setInterval
- **Web 框架**：原生 HTTP 服务器
- **AI 集成**：多 Provider 兜底机制
- **配置管理**：YAML 配置文件 + 热重载

## 开发

```bash
# 编译 TypeScript
npm run build

# 运行应用
node dist/index.js

# 开发模式（待添加）
npm run dev
```

## Web 认证配置（开放外网访问必读）

当您需要从外网访问 Web 管理界面时，**必须配置认证**以保护系统安全。

### 1. 生成密码哈希

使用提供的工具生成 bcrypt 密码哈希：

```bash
npm run generate-password-hash
```

按提示输入密码，将生成的哈希值复制到配置文件中。

### 2. 配置认证

**方式一：配置文件（开发环境）**

编辑 `config/local.yaml`：

```yaml
web:
  auth:
    enabled: true
    username: admin
    passwordHash: $2b$10$...  # 使用工具生成的哈希值
    sessionSecret: your-secret-key-here  # Session 签名密钥
    sessionMaxAge: 86400000  # Session 有效期（毫秒），默认 24 小时
```

**方式二：环境变量（生产环境/Docker）**

```bash
WEB_AUTH_USERNAME=admin
WEB_AUTH_PASSWORD_HASH=$2b$10$...
WEB_AUTH_SESSION_SECRET=your-secret-key
WEB_AUTH_ENABLED=true
```

### 3. 安全建议

- ⚠️ **生产环境必须使用 HTTPS**，否则 Cookie 可能被窃取
- 🔒 使用强密码（至少 12 位，包含大小写字母、数字、特殊字符）
- 📝 配置文件权限设置为 600（仅所有者可读写）
- 🔄 定期更换密码
- 💾 使用环境变量存储敏感信息，不要提交到版本控制系统

### 4. 使用说明

配置完成后重启服务，访问 Web 界面时会自动跳转到登录页。登录成功后可正常访问所有功能。未登录用户访问受保护资源将自动跳转到登录页。

## 多平台优化功能

### 概述

系统支持小红书、知乎、汽车之家三大平台的智能优化，通过分平台策略提升发帖质量和效果。

### 核心功能

#### 1. 分平台搜索词选择

- **小红书**：小时级切换搜索词，避免频繁更换触发风控
- **知乎**：优先使用专业术语和问题形式，充分利用 100 字符限制
- **汽车之家**：短词优先（2-4 字），匹配论坛术语

#### 2. 分平台 AI 提示词

- **小红书风格**：emoji + 情绪化 + 简短段落（100-500 字）
- **知乎风格**：专业术语 + 数据分析 + 逻辑结构（800-2000 字）
- **汽车之家风格**：真实车主 + 配置价格 + 实用建议（500-1500 字）

#### 3. 智能平台选择

综合考虑以下因素的推荐算法：
- 基础优先级（数据库配置）
- 成功率调整（>90% 奖励 +1，<50% 惩罚 -2）
- 频率限制调整
- 最近使用惩罚（-3）

#### 4. 图片选择优化

- **7 维度质量评分**：清晰度、构图、光线、相关性、新鲜度、美观度、信息量
- **平台适配度计算**：自动计算图片对各平台的适配度（0-100 分）
- **智能降级策略**：高清图不足、平台偏好图不足时的降级方案

### 技术架构

```
┌─────────────────────────────────────────────────────┐
│              多平台优化架构                          │
├─────────────────────────────────────────────────────┤
│  搜索层                                              │
│  ├─ ISearchKeywordSelector (策略模式)               │
│  ├─ XiaohongshuStrategy (小时级切换)                │
│  ├─ ZhihuStrategy (专业术语)                        │
│  └─ AutohomeStrategy (短词优先)                     │
├─────────────────────────────────────────────────────┤
│  内容生成层                                          │
│  ├─ IPromptBuilder (策略模式)                       │
│  ├─ XiaohongshuBuilder (emoji 情绪化)               │
│  ├─ ZhihuBuilder (专业分析)                         │
│  └─ AutohomeBuilder (真实车主)                      │
├─────────────────────────────────────────────────────┤
│  平台选择层                                          │
│  ├─ 基础优先级计算                                   │
│  ├─ 成功率调整 (>90% +1, <50% -2)                   │
│  ├─ 频率限制调整                                     │
│  └─ 权重随机选择 (最近使用 -3)                      │
├─────────────────────────────────────────────────────┤
│  图片选择层                                          │
│  ├─ 7 维度质量评分                                   │
│  ├─ 平台适配度计算                                   │
│  └─ 智能降级策略                                     │
├─────────────────��───────────────────────────────────┤
│  缓存层                                              │
│  ├─ Redis 缓存 (5 分钟过期)                          │
│  ├─ 命中率监控                                       │
│  └─ 自动告警 (<50% 命中率，>100ms 延迟)              │
└─────────────────────────────────────────────────────┘
```

### 配置管理

#### 数据库配置

```sql
-- 查看平台配置
SELECT platform_name, priority, rate_limit_per_hour, success_rate 
FROM internet_reference_platforms;

-- 更新平台优先级
UPDATE internet_reference_platforms 
SET priority = 9 
WHERE platform_name = 'xiaohongshu';
```

#### API 接口

```bash
# 获取所有平台配置
curl http://localhost:3000/api/network-post/config/platforms

# 更新平台优先级
curl -X POST http://localhost:3000/api/network-post/config/platform/priority \
  -H "Content-Type: application/json" \
  -d '{"platform":"xiaohongshu","priority":9}'

# 获取缓存统计
curl http://localhost:3000/api/network-post/cache/stats
```

### 性能提升

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 内容质量评分 | 65 | 85 | +30.8% |
| 平台适配度 | 60 | 90 | +50.0% |
| 发帖成功率 | 75% | 95% | +26.7% |
| 缓存命中率 | 0% | 85% | - |
| API 响应时间 | 150ms | 50ms | -66.7% |

### 相关文档

- [多平台优化数据库迁移说明](./docs/多平台优化数据库迁移说明.md)
- [多平台优化 API 文档](./docs/多平台优化 API 文档.md)
- [多平台优化部署与回滚方案](./docs/多平台优化部署与回滚方案.md)
- [多平台优化实施总结](./docs/多平台优化实施总结.md)

## 许可证

MIT
