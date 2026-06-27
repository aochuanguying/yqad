# real-api-client 增量规范

## 变更概述

修复 `uploadImages` 方法的接口契约不匹配问题，确保 multipart 表单包含所有必需字段，并支持解析响应中的 `preSignedUrl`。

## 变更详情

### 修改的方法

`uploadImages(token: string, imagePaths: string[]): Promise<UploadResult>`

### 变更内容

#### 1. multipart 表单字段

**之前：**
```typescript
const form = new FormData();
for (const filePath of validPaths) {
  form.append('files', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: this.getMimeType(fileName),
  });
}
```

**之后：**
```typescript
const form = new FormData();
form.append('componentName', 'userComplaint');
form.append('fileType', 'img');
form.append('privatePermanent', 'false');
form.append('serviceName', 'user');
form.append('publicRead', 'true');

for (const filePath of validPaths) {
  form.append('files', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: this.getMimeType(fileName),
  });
}
```

#### 2. 响应 URL 解析

**之前：**
```typescript
const url = item?.url || item?.cdnUrl || item?.imageUrl || '';
```

**之后：**
```typescript
const url = item?.preSignedUrl || item?.url || item?.cdnUrl || item?.imageUrl || '';
```

### 接口契约

**请求：**
- 方法：`POST`
- 路径：`/mapi/attachment/v1/batch_upload`
- Content-Type: `multipart/form-data`
- Headers: `x-access-token`, `Content-Type` (from form-data)
- 表单字段：
  - `componentName`: `"userComplaint"` (string)
  - `fileType`: `"img"` (string)
  - `privatePermanent`: `"false"` (string)
  - `serviceName`: `"user"` (string)
  - `publicRead`: `"true"` (string)
  - `files`: file streams (multiple)

**响应：**
```typescript
{
  code: number;
  data: Array<{
    preSignedUrl?: string;
    url?: string;
    cdnUrl?: string;
    imageUrl?: string;
  }>;
}
```

**返回值：**
```typescript
{
  urls: string[];        // 成功上传的 CDN URL 列表
  failed: number;        // 失败的文件数量
  total: number;         // 尝试上传的文件总数
}
```

### 测试要求

1. **FormData 字段验证**
   - 验证 5 个业务字段被正确追加
   - 验证每个文件都被追加到表单

2. **URL 解析验证**
   - 验证 `preSignedUrl` 优先被解析
   - 验证 fallback 字段（`url`、`cdnUrl`、`imageUrl`）仍被支持

3. **错误处理**
   - 验证接口返回 `code !== 0` 时的错误处理
   - 验证文件不存在时的跳过逻辑

## 向后兼容性

- API 签名保持不变
- 返回值结构保持不变
- 错误处理逻辑保持不变
- 仅增加字段和解析支持，无破坏性变更
