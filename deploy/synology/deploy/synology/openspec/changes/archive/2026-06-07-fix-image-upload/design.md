## 上下文

当前图片上传功能位于 `src/api/real-client.ts` 的 `uploadImages` 方法中。参考文档 `docs/api-reference.md` 第 5 节"图片上传"明确规定了接口契约：

**请求：**
- 接口：`POST /mapi/attachment/v1/batch_upload`
- Content-Type: `multipart/form-data`
- 必需表单字段：`componentName`、`fileType`、`privatePermanent`、`serviceName`、`publicRead`、`files`

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "preSignedUrl": "https://cdn.example.com/image.jpg"
    }
  ]
}
```

**问题：**
- 当前实现仅传递了 `files` 字段，缺少其他 5 个业务字段
- 响应解析仅支持 `url`、`cdnUrl`、`imageUrl`，遗漏了 `preSignedUrl`
- 导致接口返回 `code=400 参数错误`，精华贴发布失败

**约束：**
- 必须保持现有 API 签名不变
- 必须使用 `form-data` 库构建 multipart 请求
- 必须保持与现有错误处理和日志逻辑的兼容性

## 目标 / 非目标

**目标：**
- 补齐 multipart 表单的 5 个业务字段
- 支持解析响应中的 `preSignedUrl` 字段
- 添加单元测试验证修复正确性
- 保持代码简洁，不引入额外复杂度

**非目标：**
- 不修改图片压缩或预处理逻辑
- 不改变上传接口的错误处理机制
- 不引入新的依赖库
- 不修改 mapi 通道的认证逻辑

## 决策

### 1. 表单字段硬编码 vs 可配置

**决策：** 硬编码 5 个业务字段的值

**理由：**
- 这些字段是接口契约的一部分，不会动态变化
- 硬编码代码更简洁，可读性更好
- 避免不必要的配置复杂度

**替代方案：**
- 方案 A：通过构造函数参数传入 → 增加 API 复杂度，无实际收益
- 方案 B：从配置文件读取 → 过度设计，这些值几乎不会变化

### 2. URL 解析优先级

**决策：** 按 `preSignedUrl` → `url` → `cdnUrl` → `imageUrl` 的顺序解析

**理由：**
- `preSignedUrl` 是接口文档明确返回的字段，优先级最高
- 保留其他字段支持作为向后兼容的 fallback
- 使用逻辑或链式解析，代码简洁

**替代方案：**
- 仅支持 `preSignedUrl` → 风险高，如果接口返回其他字段会失败
- 配置化优先级 → 过度设计

### 3. 测试策略

**决策：** 使用 Jest mock 验证 FormData 字段追加和响应解析

**理由：**
- 无需真实网络请求，测试快速可靠
- 可以精确验证每个字段是否被正确追加
- 可以模拟各种响应格式验证解析逻辑

**替代方案：**
- 集成测试（真实上传） → 依赖网络和 token，不稳定
- 跳过测试 → 无法保证修复正确性

## 风险 / 权衡

### 风险 1：字段值可能随接口版本变化
**缓解措施：** 这些字段是业务语义字段，变化概率低。如果变化，参考文档会先更新，届时同步修改代码即可。

### 风险 2：`preSignedUrl` 可能不是唯一返回字段
**缓解措施：** 保留 `url`、`cdnUrl`、`imageUrl` 作为 fallback，确保向后兼容。

### 风险 3：multipart 字段顺序可能影响接口行为
**缓解措施：** 先追加业务字段，再追加文件字段，符合常规 multipart 构建顺序。如果仍有问题，需进一步排查接口实现细节。

### 权衡：代码复用 vs 简洁性
- 未提取独立的 `buildUploadForm` 函数，直接在 `uploadImages` 中构建 FormData
- 牺牲了少量代���复用性，换取更低的复杂度和更清晰的调用链
- 当前方法体长度仍在可接受范围内
