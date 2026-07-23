# Implementation Plan: AI Provider Vision Support

## Overview

为现有 AI Provider 基础设施扩展多模态（Vision）能力。按存储层 → 配置类型 → AI Client → FallbackChain → 素材处理器 → 前端的顺序递进实现，确保每步可编译、可测试。

## Tasks

- [x] 1. 存储层与配置类型变更
  - [x] 1.1 扩展 `ai-provider-storage.ts` 支持 `supports_vision` 字段
    - `AIProviderRecord` 接口新增 `supports_vision: boolean`
    - `AIProviderConfig` 接口新增 `supportsVision?: boolean`
    - `createTable` DDL 包含 `supports_vision TINYINT(1) DEFAULT 0`
    - `initialize` 方法检测字段不存在时执行 `ALTER TABLE`，失败则抛异常阻止初始化
    - `getEnabledProviders`/`getAllProviders`/`getProviderByName` SELECT 加入 `supports_vision`，映射为 `supportsVision`
    - `saveProvider`/`saveProviders` INSERT/UPDATE 包含 `supports_vision`
    - _需求: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x] 1.2 同步 `config.ts` 中的 `AIProviderConfig` 类型
    - 新增 `supportsVision?: boolean` 可选属性
    - _需求: 1.4_

  - [x]* 1.3 属性测试：Provider supportsVision 读写 round-trip
    - **Property 1: Provider supportsVision 读写 round-trip**
    - **验证: 需求 1.2, 1.3**

- [x] 2. AI Client 多模态消息支持
  - [x] 2.1 扩展 `GenerateContentOptions` 接口并实现 Vision 消息构造
    - `GenerateContentOptions` 新增 `images?: string[]` 和 `requireVision?: boolean`
    - 实现 `buildUserMessage(text, images?)` 函数：无图时返回纯文本格式，有图时构造 OpenAI Vision content 数组
    - 实现 `validateBase64Images(images)` 函数：超过 5 张抛错，含非法 base64 字符抛错并指明索引
    - 修改 `generateContent` 中 FallbackChain 调用，传递 `requireVision` 参数
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 2.2 属性测试：Vision 消息格式构造正确性
    - **Property 2: Vision 消息格式构造正确性**
    - **验证: 需求 2.2**

  - [x]* 2.3 属性测试：非法 base64 输入校验
    - **Property 3: 非法 base64 输入校验**
    - **验证: 需求 2.4**

- [x] 3. FallbackChain Vision Provider 过滤
  - [x] 3.1 扩展 `FallbackChain.execute` 方法支持 `requireVision` 参数
    - `execute` 签名新增 `requireVision?: boolean` 参数（默认 false）
    - 当 `requireVision=true` 时，过滤 `supportsVision !== true` 的 provider
    - 无可用 vision provider 时立即返回 `success: false`
    - _需求: 4.1, 4.2, 4.3, 4.4_

  - [x]* 3.2 属性测试：FallbackChain vision provider 过滤
    - **Property 5: FallbackChain vision provider 过滤**
    - **验证: 需求 4.1**

- [x] 4. 检查点
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 5. 素材处理器 Vision 集成
  - [x] 5.1 实现 `prepareImageForVision` 函数
    - 使用 sharp 将图片压缩至长边 ≤ 2048px、JPEG quality 85
    - 转 base64，超过 20MB 返回 null 并记录 warn 日志
    - 读取/编码异常返回 null 并记录 error 日志
    - _需求: 3.4, 3.5, 3.6_

  - [x] 5.2 改造 `generateDescription` 和 `generateTags` 支持传图
    - 当 `enableVision=true` 且有可用 vision provider 时，调用 `prepareImageForVision` 获取 base64
    - 通过 `generateContent({ ..., images: [base64], requireVision: true, timeout: 60000 })` 发起调用
    - 降级逻辑：vision provider 不可用 / 图片处理失败 → 纯文件名推测 + warn/error 日志
    - _需求: 3.1, 3.2, 3.3, 3.7_

  - [x]* 5.3 属性测试：图片压缩尺寸约束
    - **Property 4: 图片压缩尺寸约束**
    - **验证: 需求 3.4**

- [x] 6. 前端管理界面
  - [x] 6.1 Admin Panel AI Provider 表单新增"支持多模态"开关
    - 新增/编辑表单中添加 checkbox 控件，默认关闭
    - 保存时将 `supportsVision` 随其他字段一并提交
    - 加载配置时根据后端返回值设置开关状态
    - provider 卡片中显示 Vision 标识（`👁 Vision`）
    - 保存失败时恢复开关状态并显示错误提示
    - _需求: 5.1, 5.2, 5.3, 5.4_

- [x] 7. 最终检查点
  - 确保所有测试通过，如有疑问请向用户确认。

## Notes

- 标记 `*` 的任务为可选，可跳过以加速 MVP
- 每个任务引用具体需求条目，确保可追溯
- 属性测试使用 `fast-check` 库，验证设计文档中定义的 Correctness Properties
- 单元测试验证具体边界和降级场景

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["6.1"] }
  ]
}
```
