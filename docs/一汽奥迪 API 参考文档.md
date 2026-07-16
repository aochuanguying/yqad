# 一汽奥迪 API 参考文档

> 最后更新：2026-07-07
> 
> **重要提示**：直接 API 发帖方式已废弃，当前使用 AutoJS 远程发帖方式。

---

## 目录

1. [认证方式](#1-认证方式)
2. [登录获取 Token](#2-登录获取-token)
3. [帖子列表（Feed）](#3-帖子列表 feed)
4. [发评论](#4-发评论)
5. [图片上传](#5-图片上传)
6. [发帖（社区动态）- ⚠️ 已废弃](#6-发帖社区动态---已废弃)
7. [话题列表](#7-话题列表)
8. [签到与任务](#8-签到与任务)
9. [会员信息查询](#9-会员信息查询)
10. [Token 续期](#10-token-续期)
11. [附录](#11-附录)

---

## 1. 认证方式

### Token 类型对比

| 特性 | 微信 Token (`cch=WECHAT`) | APP Token (`cch=APP`) |
|------|--------------------------|----------------------|
| 获取方式 | 微信小程序通道登录 | App 密码/验证码登录 |
| 有效期 | 83.3 小时（300000 秒） | 83.3 小时 |
| 帖子列表 | ✅ | ✅ |
| 发评论 | ✅ | ✅ |
| 会员信息 | ✅ | ✅ |
| 签到 | ❌（返回 signInStatus=0） | ✅（需配合 x-fawvw-sign） |
| user_info | ❌ 401 | ✅ |

### 通用 Headers（App 通道伪装）

所有 cnapi 接口使用以下 Headers：

```
x-access-token: <YOUR_TOKEN>
x-audi-did: AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1
x-channel: iOS
x-audi-entry: app
x-microservice-name: api-gateway
x-namespace-code: production
sv: 6.1.1
user-agent: AudiApp/506.1.1 (com.fawvw.audisuper; build:33; iOS 26.5.0) Alamofire/5.11.1
accept: application/json
content-type: application/json
x-lang: zh-CN
```

### mapi 通道 Headers

登录和会员信息接口使用 mapi 通道：

```
x-access-token: <YOUR_TOKEN>
x-channel: MINI_PROGRAM
x-microservice-name: audi-app-gateway-c
x-namespace-code: faw-audi-dev
x-timestamp: <毫秒时间戳>
content-type: application/json
```

### x-fawvw-sign 说明

- 32 字节 HMAC-SHA256 Base64 签名
- **仅签到等写操作必须**，读取类接口不校验
- 算法在 App native 层（无法静态逆向）
- **重要**：sign 值可重放（不绑定时间），抓包一次可持续使用

---

## 2. 登录获取 Token

### 2.1 发送短信验证码

需先完成腾讯滑块验证获取 ticket（AppId: `198705236`）。

**端点**：`POST /mapi/user/v1/vrcode/send2`

**Headers**：mapi 通道 Headers（无需 Token）

**请求体**：
```json
{
  "describeCaptchaMiniResultReqDto": {
    "captchaAppId": "198705236",
    "ticket": "<滑块验证获得的 ticket>"
  },
  "sendVerificationCodeDto": {
    "account": "<11 位手机号>",
    "verificationCodeTypeEnum": "LOGIN_BY_VERIFICATION_CODE"
  }
}
```

**响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

### 2.2 验证码登录

**端点**：`POST /mapi/user/v1/account/login`

**Headers**：mapi 通道 Headers（无需 Token）

**请求体**：
```json
{
  "accountLoginDto": {
    "account": "<手机号>",
    "headImage": "",
    "loginTypeEnum": "MOBILE_VERIFICATION_CODE",
    "loginChannelEnum": "WECHAT_MINI_PROGRAM",
    "password": "",
    "verificationCode": "<短信验证码>",
    "code": ""
  }
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "",
    "expiresIn": 300000
  }
}
```

**注意**：
- Token 有效期约 83 小时（300000 秒）
- 无 refresh_token，通过响应头滑动续期
- 登录成功后保存 Token，后续请求携带

---

## 3. 帖子列表（Feed）

**端点**：`GET /cnapi/v2/feed`

**Headers**：通用 App 通道 Headers

**参数**：
```
?current=1&size=20&nonce=<UUID>&timestamp=<毫秒时间戳>
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "records": [
      {
        "contentType": "INFORMATION",
        "information": {
          "id": "2063130925127012353",
          "title": "帖子标题",
          "content": "<p>HTML 内容</p>",
          "createTime": "2026-06-06 12:00:00",
          "nickName": "作者昵称",
          "likeCount": 10,
          "commentCount": 5
        }
      }
    ]
  }
}
```

**contentType 映射**：
- `INFORMATION` → `information` 字段
- `DYNAMIC` → `subject` 字段
- `ARTICLE` → `subject` 字段
- `NOTES` → `nous` 字段

---

## 4. 发评论

**端点**：`POST /cnapi/v1/comment_center/comment/save`

**Headers**：通用 App 通道 Headers（需要 Token）

**参数**：
```
?nonce=<UUID>&timestamp=<毫秒时间戳>
```

**请求体**：
```json
{
  "content": "评论内容",
  "subjectId": "<帖子 ID>",
  "subjectContentTypeEnum": "INFORMATION",
  "nickName": "昵称",
  "avatarUrl": "",
  "ipRegion": "山东省"
}
```

**响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "2063130925127012354"
  }
}
```

**注意**：
- 评论**不需要 sign**
- `nickName` 和 `ipRegion` 可为空
- `subjectContentTypeEnum` 通常为 `INFORMATION`

---

## 5. 图片上传

**端点**：`POST /mapi/attachment/v1/batch_upload`

**Headers**：mapi 通道 Headers（需要 Token）

**请求体**：`multipart/form-data`

**字段**：
- `componentName`: `userComplaint`
- `fileType`: `img`
- `privatePermanent`: `false`
- `serviceName`: `user`
- `publicRead`: `true`
- `files`: 图片文件（可多个）

**响应**：
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

**注意**：
- 最多上传 9 张图片
- 单张图片不超过 10MB
- 返回的 `preSignedUrl` 即为 CDN 地址

---

## 6. 发帖（社区动态）- ⚠️ 已废弃

> **重要**：直接 API 发帖方式已于 **2026-07-07** 废弃。
> 
> 当前发帖通过 **AutoJS 远程执行脚本** 实现，使用真实手机 APP 发帖，更加稳定可靠。
> 
> 相关文档：[AutoJS API 远程发帖使用说明](./AUTOJS_API_USAGE.md)

### 废弃原因

1. **容易被识别**：直接 API 调用容易被服务器识别为非真实设备
2. **验证码复杂**：需要生成 vrfCode 等验证码，维护成本高
3. **稳定性差**：API 参数变化可能导致发帖失败
4. **有更好的方案**：AutoJS 方式使用真实 APP，完全模拟人工操作

### 历史参考（不再使用）

以下内容仅供历史参考，**不再推荐使用**：

**端点**：`POST /cnapi/v1/community/subject/publish`

**请求体**：
```json
{
  "type": 0,
  "momentDto": {
    "imgUrlList": [],
    "content": "帖子内容",
    "contentJson": "[{\"content\":\"帖子内容\",\"inlineStyleEntities\":[],\"blocktype\":\"block_normal_text\"}]"
  },
  "vrfCode": "<Base64 编码的 Protobuf 数据>",
  "ipRegion": "山东省",
  "confirmPublish": false
}
```

**vrfCode 生成**（已废弃）：
- 使用 Protobuf 编码设备 ID、时间戳、随机数
- 转为 Base64 作为验证码
- 服务器不严格校验，但需要格式正确

**响应**：
```json
{
  "code": 0,
  "data": {
    "id": "2063130925127012353",
    "jumpUrl": "faw-audi://find/moment/detail?id=..."
  }
}
```

### 当前发帖方式

使用 AutoJS 远程发帖：

1. **配置 AutoJS API**：在 Web 管理界面配置 AutoJS 服务器地址和 Token
2. **触发发帖**：调用 `POST /api/posts/execute` 接口
3. **脚本执行**：AutoJS 脚本在手机上运行，调用真实 APP 发帖
4. **回调更新**：发帖成功后回调服务，更新日志状态

详细使用：[AutoJS API 使用说明](./AUTOJS_API_USAGE.md)

---

## 7. 话题列表

**端点**：`GET /cnapi/v1/community/topic/hot`

**Headers**：通用 App 通道 Headers（无需 sign）

**参数**：
```
?current=1&pageSize=10&nonce=<UUID>&timestamp=<毫秒时间戳>
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "records": [
      {
        "id": "1883401977826816001",
        "name": "#奥迪提车日记#",
        "heatDegree": 44788
      }
    ],
    "total": 465,
    "pages": 47
  }
}
```

---

## 8. 签到与任务

### 8.1 签到

**端点**：`POST /cnapi/v1/point/sign`

**Headers**：通用 App 通道 Headers（**需要 sign**）

**请求体**：
```json
{
  "autoSignIn": true
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "signInStatus": 1,
    "point": 100,
    "cumulativeDays": 5
  }
}
```

**注意**：
- 签到**必须 sign**，否则返回 `signInStatus=0`
- sign 值可重放，抓包一次可持续使用

---

## 9. 会员信息查询

**端点**：`GET /mapi/member/v1/member/info`

**Headers**：mapi 通道 Headers（需要 Token）

**响应**：
```json
{
  "code": 0,
  "data": {
    "memberLevel": "金卡会员",
    "memberScore": "436",
    "memberGrowthInfoRespDto": {
      "growthValue": "6651"
    }
  }
}
```

---

## 10. Token 续期

Token 通过响应头自动续期：

**响应头**：
```
x-access-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...新 Token
```

**处理逻辑**：
1. 检测响应头中的 `x-access-token`
2. 如果存在且以 `eyJ` 开头，说明是新 Token
3. 保存新 Token，替换旧 Token
4. 后续请求使用新 Token

---

## 11. 附录

### 错误码

| code | 说明 |
|------|------|
| 0 | 成功 |
| 401 | 未授权（Token 无效或过期） |
| 403 | 禁止访问 |
| 500 | 服务器错误 |

### 工具函数

#### 生成 UUID
```javascript
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

#### 构建 App Headers
```javascript
function appHeaders(token) {
  return {
    'x-access-token': token,
    'x-audi-did': 'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1',
    'x-channel': 'iOS',
    'x-audi-entry': 'app',
    'x-microservice-name': 'api-gateway',
    'x-namespace-code': 'production',
    'sv': '6.1.1',
    'user-agent': 'AudiApp/506.1.1 (com.fawvw.audisuper; build:33; iOS 26.5.0) Alamofire/5.11.1',
    'accept': 'application/json',
    'content-type': 'application/json',
    'x-lang': 'zh-CN'
  };
}
```

---

## 更新历史

- **2026-07-07**: 废弃直接 API 发帖方式，移除 vrfCode 生成逻辑
- **2026-06-06**: 初始版本，基于真实 API 抓包整理
