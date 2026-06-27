# 大模型 API 接口文档

## 1. DeepSeek V4-Pro

### 基础信息

- **接口地址**: `https://xxxxx`
- **请求方式**: POST
- **传输格式**: JSON
- **鉴权方式**: Bearer Token 请求头

### 请求头

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Content-Type | String | 是 | 固定值：`application/json` |
| Authorization | String | 是 | 格式：`Bearer {token}` |

### 请求参数

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| model | String | 是 | 模型名称，固定值：`deepseek-v4-pro` |
| stream | Boolean | 否 | 流式输出开关，可选值：true/false，true 为开启流式输出，false 为关闭，不传默认 false（关闭流式输出） |
| chat_template_kwargs | Object | 否 | 扩展参数，`{"thinking": true}` 开启模型思考过程，`{"thinking": false}` 关闭思考过程，默认 false |
| messages | Array | 是 | 对话消息列表，用于承载上下文对话内容 |
| temperature | Number（浮点数） | 否 | 控制模型输出的随机性与创造性，取值范围 0.0–2.0，值越低回答越精准保守，值越高越发散创意，模型默认 1.0 |

### messages 子参数

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| role | String | 是 | 角色：`system`(系统指令)/`user`(用户提问) |
| content | String | 是 | 对话内容 |

---

## 2. Qwen3.5-397b

### 基础信息

- **接口地址**: `https://xxxxx`
- **请求方式**: POST
- **传输格式**: JSON
- **鉴权方式**: Bearer Token 请求头

### 请求头

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Content-Type | String | 是 | 固定值：`application/json` |
| Authorization | String | 是 | 格式：`Bearer {token}` |

### 请求参数

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| model | String | 是 | 模型名称：`qwen3-5-397b` |
| stream | Boolean | 否 | 流式输出开关 |
| messages | Array | 是 | 对话消息列表 |
| temperature | Number | 否 | 温度参数，控制随机性 |
| max_tokens | Number | 否 | 最大输出 token 数 |

### messages 子参数

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| role | String | 是 | 角色：`system`/`user`/`assistant` |
| content | String | 是 | 对话内容 |

---

## 3. 网关配置说明

### 当前配置（default.yaml）

```yaml
modelAliases:
  # 新别名（推荐）
  qwen3-5: qwen3-5-397b
  deepseek-v4-pro: deepseek-v4-pro
  # 旧别名（兼容）
  higpt: qwen3-5-397b
  deepseek: deepseek-v4-pro
  # *-raw 由网关自动推导（-raw 后缀），无需在此单独声明
```

### 使用示例

#### Qwen3.5-397b

```bash
# 标准模式（过滤思考过程）
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-5",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 原始模式（包含思考过程）
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-5-raw",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

#### DeepSeek V4-Pro

```bash
# 标准模式（过滤思考过程）
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好"}],
    "chat_template_kwargs": {"thinking": false}
  }'

# 原始模式（包含思考过程）
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro-raw",
    "messages": [{"role": "user", "content": "你好"}],
    "chat_template_kwargs": {"thinking": true}
  }'
```

---

## 4. 注意事项

1. **流式输出**: 由客户端 `stream` 参数控制，网关自动适配
2. **思考过程**: 
   - DeepSeek 使用 `chat_template_kwargs.thinking` 控制
   - 标准模式自动过滤 `reasoning_content` 字段
   - `-raw` 后缀模式保留原始响应
3. **超时配置**: 默认 120 秒，可根据需要调整
4. **重试机制**: 网络错误、超时、5xx 错误自动重试（最多 2 次）
