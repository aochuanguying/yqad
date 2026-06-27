# 大模型API接口文档

> **注意**：本文档从飞书导出的 HTML 解析生成。由于飞书文档使用虚拟滚动，部分内容（如第1节 DeepSeek V4-Flash 的基础信息、请求头、请求参数等）在导出 HTML 中不可见，仅提取了 DOM 中实际存在的内容。

## 1. DeepSeek V4-Flash

> 以下内容为 DeepSeek V4-Flash 的调用示例（代码块前6行因虚拟列表被隐藏）。

```sql
 "chat_template_kwargs": {"thinking": true},
 "messages": [
 {
 "role": "system",
 "content": "You are a helpful assistant."
 },
 {
 "role": "user",
 "content": "你是谁？"
 }
 ]
}'
```

#### 响应格式

- 流式返回，每条数据以 `data: ` 开头
- 包含**思考内容（reasoning）**和**回答内容（content）**分片
- 最终返回结束标识

#### 响应字段

| 字段名 | 说明 |
| --- | --- |
| id | 会话唯一标识 |
| model | 模型名称 |
| choices[0].delta.reasoning | 模型思考过程 |
| choices[0].delta.content | 模型回答内容 |
| finish_reason | 结束标识 |

## 2. DeepSeek V4-Pro

#### 基础信息

- **接口地址**：`[xxxxx](https://xxxxx)`
- **请求方式**：POST
- **传输格式**：JSON
- **鉴权方式**：Bearer Token 请求头

#### 请求头

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| Content-Type | String | 是 | 固定值：`application/json` |
| Authorization | String | 是 | 格式：`Bearer {token}` |

#### 请求参数

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| model | String | 是 | 模型名称，固定值：**`deepseek-v4-pro`** |
| stream | Boolean | 否 | 流式输出开关，可选值：true/false，true为开启流式输出，false为关闭，不传默认false（关闭流式输出） |
| thinking | Object | 否 | 思考模式配置，不传默认关闭；子字段：`type`（`enabled`/`disabled`） ，举例：<br>"thinking": {<br>"type": "enabled"<br>}, |
| reasoning_effort | String | 否 | 推理强度，仅思考模式生效：`high`（默认）/ `max`（深度推理）<br>举例："reasoning_effort": "max", |
