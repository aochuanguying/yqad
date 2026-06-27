## 为什么

图片上传接口返回 `code=400 参数错误`，导致精华图文贴发布失败。根因是 multipart 表单缺少必需的业务字段，且响应中的 `preSignedUrl` 未被正确解析。

## 变更内容

**修复：**
- 在 `uploadImages` 方法中补齐 5 个必需的 multipart 表单字段（`componentName`、`fileType`、`privatePermanent`、`serviceName`、`publicRead`）
- 在 URL 解析逻辑中增加对 `preSignedUrl` 字段的支持
- 添加单元测试验证表单字段追加和响应解析

**无破坏性变更。**

## 功能 (Capabilities)

### 新增功能

无新增功能。

### 修改功能

- `real-api-client`: 修复 `uploadImages` 方法的接口契约不匹配问题

## 影响

**受影响的代码：**
- `src/api/real-client.ts`：`uploadImages` 方法
- `tests/real-api-client.test.ts`：增加表单字段验证和 `preSignedUrl` 解析测试

**API 变更：**
- 无。API 行为保持不变，仅修复内部实现以符合接口契约

**依赖：**
- 无新增依赖

**系统：**
- 一汽奥迪 APP 真实 API 图片上传功能
