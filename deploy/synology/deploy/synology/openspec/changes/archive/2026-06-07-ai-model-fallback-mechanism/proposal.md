# 需求文档

## 简介

对现有 AI 模型调用机制进行全面增强，构建统一的多级兜底体系。当前系统虽已支持多 provider 的 fallback，但缺少：
- 精细化的超时控制（仅有单一 requestTimeout）
- 速率限制保护（无请求频率限制，易触发 API 限流）
- 统一的错误分类与处理策略
- 可配置的兜底策略（重试次数、fallback 顺序、超时时间等集中管理）

本次变更将构建一个完整的 AI 模型兜底机制，同时服务于回帖（AutoCommentService）和发帖（AutoPostService），确保 AI 调用的高可用性和稳定性。

## 术语表

- **AI_Model_Fallback**: AI 模型兜底机制，包含多级 fallback、超时控制、速率限制、错误处理的综合体系
- **Provider**: AI 服务提供商（如 GPT、HiGPT）
- **Fallback_Chain**: 有序的 provider 调用链，按优先级依次尝试
- **Rate_Limiter**: 速率限制器，控制单位时间内的请求次数
- **Timeout_Policy**: 超时策略，定义不同场景下的超时阈值
- **Error_Classifier**: 错误分类器，将错误分为可重试/不可重试、临时/永久等类别
- **Circuit_Breaker**: 熔断器，当某 provider 连续失败时暂时屏蔽，避免无效调用
- **AutoCommentService**: 自动回帖服务，调用 generateContent 生成评论内容
- **AutoPostService**: 自动发帖服务，调用 generateContent 生成帖子内容

## 需求

### 需求 1: 多级 Fallback 策略

**用户故事:** 作为系统运维人员，我希望配置多级 fallback 策略，以便在主力 provider 不可用时自动切换到备用 provider，确保 AI 调用不中断。

#### 验收标准

1. 系统必须支持配置有序的 fallback chain，按优先级依次尝试各 provider
2. 当某 provider 调用失败时，系统必须根据错误分类判断是否可重试或切换到下一个 provider
3. 系统必须支持两种 fallback 模式：
   - **快速失败模式**: 某 provider 失败后立即切换到下一个，不重试（适用于实时性要求高的场景）
   - **稳健模式**: 某 provider 失败后重试 1-3 次再切换到下一个（适用于稳定性要求高的场景）
4. 系统必须记录每次 fallback 事件，包括：触发原因、原 provider、目标 provider
5. 当所有 provider 均失败时，系统必须抛出包含完整错误链的聚合错误

### 需求 2: 超时控制

**用户故事:** 作为系统运维人员，我希望为不同场景配置不同的超时策略，以便在响应速度和成功率之间取得平衡。

#### 验收标准

1. 系统必须支持三级超时配置：
   - **全局默认超时**: 适用于所有 AI 调用，默认 30 秒
   - **Provider 级别超时**: 覆盖全局配置，针对特定 provider 设置
   - **场景级别超时**: 根据调用场景（评论/发帖/分析）动态设置
2. 系统必须区分两种超时类型：
   - **连接超时**: 建立连接的超时，默认 5 秒
   - **读取超时**: 等待响应的超时，默认 25 秒
3. 系统必须支持动态超时调整：当某 provider 连续 3 次响应时间超过阈值时，自动增加其超时时间 20%
4. 超时事件必须被记录，包括：provider、场景、实际耗时、超时阈值

### 需求 3: 速率限制

**用户 Story:** 作为系统运维人员，我希望限制单位时间内的 AI 调用次数，以避免触发 API 提供商的限流机制。

#### 验收标准

1. 系统必须支持令牌桶算法实现速率限制
2. 系统必须支持配置以下速率限制参数：
   - **tokensPerMinute**: 每分钟允许的请求数，默认 60
   - **burstSize**: 突发请求数，默认 10
   - **enabled**: 是否启用速率限制，默认 true
3. 当速率限制触发时，系统必须：
   - 等待直到有可用 token
   - 记录警告日志，说明等待时长
   - 不视为调用失败，不计入 fallback 判断
4. 系统必须支持白名单机制：某些 provider 可跳过速率限制（如内网部署的 HiGPT）
5. 速率限制状态必须可查询：当前 token 数、上次补充时间、触发次数

### 需求 4: 统一错误处理

**用户故事:** 作为系统运维人员，我希望统一分类和处理 AI 调用错误，以便制定针对性的兜底策略。

#### 验收标准

1. 系统必须将错误分为以下类别：
   - **NetworkError**: 网络错误（超时、连接失败、DNS 解析失败）→ 可重试
   - **RateLimitError**: 限流错误（HTTP 429）→ 等待后重试，不计入 fallback
   - **AuthError**: 认证错误（HTTP 401/403）→ 不可重试，立即 fallback
   - **ServerError**: 服务端错误（HTTP 5xx）→ 可重试，最多 2 次
   - **ClientError**: 客户端错误（HTTP 4xx，除 401/403/429）→ 不可重试，立即 fallback
   - **EmptyResponseError**: 空响应 → 可重试，最多 1 次
   - **UnknownError**: 未知错误 → 可重试，最多 1 次
2. 系统必须提供错误分类器函数，输入原始错误，输出错误类别和重试建议
3. 对于可重试错误，系统必须在重试前执行指数退避：delay = baseDelay * 2^(attempt-1)
4. 对于不可重试错误，系统必须立即切换到下一个 provider，不浪费重试次数
5. 系统必须记录所有错误，包括：类别、原始错误信息、处理动作（重试/fallback/跳过）

### 需求 5: 可配置的兜底策略

**用户故事:** 作为系统管理员，我希望通过配置文件灵活调整兜底策略，以便根据不同环境优化 AI 调用行为。

#### 验收标准

1. 配置文件必须支持以下兜底策略配置：
```yaml
ai:
  fallback:
    enabled: true                    # 是否启用 fallback 机制
    mode: 'robust'                   # 'fast' | 'robust'
    maxRetries: 2                    # 每个 provider 最大重试次数
    baseDelay: 2000                  # 重试基础延迟 (ms)
    maxDelay: 10000                  # 重试最大延迟 (ms)
    providerOrder: ['gpt', 'higpt']  # fallback 顺序
  timeout:
    global: 30000                    # 全局默认超时 (ms)
    connect: 5000                    # 连接超时 (ms)
    read: 25000                      # 读取超时 (ms)
    dynamicAdjustment: true          # 是否启用动态超时调整
  rateLimit:
    enabled: true
    tokensPerMinute: 60
    burstSize: 10
    whitelist: ['higpt']             # 不限流的 provider
  circuitBreaker:
    enabled: true
    failureThreshold: 5              # 连续失败次数阈值
    resetTimeout: 60000              # 熔断恢复时间 (ms)
```
2. 系统必须支持场景级别的策略覆盖：
   - 评论生成：使用快速失败模式，超时 15 秒
   - 帖子生成：使用稳健模式，超时 60 秒
   - 内容分析：使用稳健模式，超时 30 秒
3. 系统必须提供策略验证功能：启动时检查配置合理性，冲突时报警告

### 需求 6: 服务于回帖和发帖

**用户故事:** 作为系统用户，我希望回帖和发帖功能都能受益于兜底机制，确保每日任务稳定执行。

#### 验收标准

1. AutoCommentService 调用 generateContent 时必须：
   - 使用评论场景的超时策略（15 秒）
   - 使用快速失败模式（减少等待时间）
   - 记录每次调用的 provider 和耗时
2. AutoPostService 调用 generateContent 时必须：
   - 使用发帖场景的超时策略（60 秒）
   - 使用稳健模式（确保生成质量）
   - 记录每次调用的 provider 和耗时
3. 两个服务必须共享同一个兜底机制实现，不重复造轮子
4. 两个服务必须能独立配置场景级别的策略
5. 兜底机制必须对业务代码透明，不侵入 AutoCommentService 和 AutoPostService 的核心逻辑

### 需求 7: 监控与可观测性

**用户故事:** 作为系统运维人员，我希望监控 AI 调用的健康状态，以便及时发现和解决问题。

#### 验收标准

1. 系统必须记录以下指标：
   - 每个 provider 的调用次数、成功次数、失败次数
   - 每个 provider 的平均响应时间、P95 响应时间
   - fallback 触发次数、原因分布
   - 速率限制触发次数、平均等待时间
   - 熔断器状态变化历史
2. 系统必须提供健康检查接口：返回各 provider 的当前状态（正常/警告/熔断）
3. 系统必须支持告警：当某 provider 连续失败 5 次或熔断器触发时，记录错误日志
4. 系统必须定期（每小时）输出统计报告：各 provider 的可用性、成功率、平均耗时
