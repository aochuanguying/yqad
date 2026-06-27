# 图片上传错误调试记录

状态：OPEN

## 问题

发布精华图文贴时，图片上传接口返回 `code=400 message=参数错误`，导致帖子以 0 图降级发布。

## 已知现象

- 发帖内容生成成功。
- 本地素材能被选中。
- 上传接口 `/mapi/attachment/v1/batch_upload` 返回业务错误 `code=400`。
- 因图片 URL 为空，精华候选校验失败：图片不足。

## 假设

1. 上传接口路径或所属网关使用错误，当前调用的 `/mapi/attachment/v1/batch_upload` 不是发帖图片上传所需接口。
2. multipart 表单字段名或附加参数不符合真实接口要求。
3. 请求头缺少必需字段，例如设备、渠道、签名、业务来源或 token 相关字段。
4. 本地图片文件虽然是 `.jpg`，但编码、尺寸、渐进式 JPEG 或文件名格式不被接口接受。
5. 当前 token 能发帖但没有该上传接口权限，或上传接口需要不同 token/登录态。

## 下一步

- 不继续发布新帖。
- 只对上传流程做最小化证据采集。
- 先记录请求元信息与响应结构，不记录 token、密钥或图片二进制。

## 运行证据

### 证据 1：原图与压缩诊断图

- 原图：`IMG_1343.HEIC.jpg`，JPEG，4284x5712，3844219 bytes，progressive=true。
- 诊断图：`/tmp/audi-upload-diagnostic.jpg`，JPEG，1280x1707，677284 bytes，progressive=false。

结论：已构造小尺寸、非 progressive JPEG 用于排除素材编码/尺寸问题。

### 证据 2：同一诊断图不同字段与请求头组合

- `mapi-files`：HTTP 200，业务 `code=400`，`message=参数错误`。
- `mapi-file`：HTTP 200，业务 `code=400`，`message=参数错误`。
- `app-files`：HTTP 200，业务 `code=400`，`message=参数错误`。
- `app-file`：HTTP 200，业务 `code=400`，`message=参数错误`。

结论：仅把字段名从 `files` 改为 `file`，或在 app/mapi 基础请求头间切换，不能解决问题。

### 证据 3：Token 对错误形态的影响

- 有 token：HTTP 200，业务 `code=400`，`message=参数错误`。
- 无 token：HTTP 200，业务 `code=400`，`message=参数错误`。
- 错 token：HTTP 200，业务 `code=500`，`message=服务器开小差，请您稍后再试~`。

结论：上传接口没有表现为标准未授权错误；当前失败更像请求参数/接口契约不匹配，而不是普通 token 过期。

### 证据 4：代码库与历史日志

- 代码库中真实图片上传实现只有 `/mapi/attachment/v1/batch_upload` 一处。
- 历史日志中存在多次纯文字发帖成功，但没有发现任何 `图片上传成功` 记录。
- 当前项目没有一条可证明“真实图片上传链路曾成功”的本地历史证据。

结论：现有上传实现很可能从未被真实验证通过，不能作为已知正确接口契约。

## 当前判断

- 假设 4（图片尺寸/编码/渐进 JPEG 导致失败）：基本排除。小尺寸非 progressive JPEG 仍返回同样 `code=400`。
- 假设 2（仅字段名 `files/file` 错误）：基本排除。两种字段都失败。
- 假设 3（仅 app/mapi 基础头选择错误）：基本排除。两套基础头组合都失败。
- 假设 5（普通 token 过期）：不支持。发帖接口成功，上传接口有 token/无 token 都返回 `code=400`。
- 假设 1（接口路径或完整接口契约不匹配）：当前最可能。

## 需要继续确认的问题

- 一汽奥迪 App 当前真实发图流程是否不是 `/mapi/attachment/v1/batch_upload`。
- 上传前是否需要先申请 COS 临时凭证/上传策略，再直传 COS。
- `/mapi/attachment/v1/batch_upload` 是否要求额外业务字段，例如 bucket、scene、bizType、module、source、fileType、attachmentType。
- 是否缺少接口签名字段，导致后端统一返回 `参数错误`。

## 修复结果

- 根据 `docs/api-reference.md` 的图片上传章节，补齐 multipart form 业务字段：`componentName=userComplaint`、`fileType=img`、`privatePermanent=false`、`serviceName=user`、`publicRead=true`。
- 上传响应 URL 解析增加 `preSignedUrl`。
- 单元测试 `tests/real-api-client.test.ts` 已覆盖业务字段追加和 `preSignedUrl` 解析。
- 真实接口单张诊断图验证结果：`uploaded=1`，`failed=0`，`hasUrl=true`。

## 根因

当前上传请求只提交了 `files`，缺少接口要求的业务 form 字段，后端返回 `code=400 message=参数错误`。同时响应解析漏掉 `preSignedUrl`，即使上传成功也可能无法提取图片 URL。
