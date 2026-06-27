# 一汽奥迪 API 参考文档

> 最后验证：2026-06-06
> 基础域名：`https://audi2c.faw-vw.com`

---

## 目录

1. [认证方式](#1-认证方式)
2. [登录获取 Token](#2-登录获取-token)
3. [帖子列表（Feed）](#3-帖子列表feed)
4. [发评论](#4-发评论)
5. [图片上传](#5-图片上传)
6. [发帖（社区动态）](#6-发帖社区动态)
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
    "account": "<11位手机号>",
    "verificationCodeTypeEnum": "LOGIN_BY_VERIFICATION_CODE"
  }
}
```

**响应**：
```json
{ "code": 0, "message": null, "data": null }
```

**错误码**：
- `code: 0` — 发送成功
- 非零 — 发送失败，message 包含原因

**代码示例**：
```javascript
async function sendSmsCode(phone, ticket) {
  const resp = await fetch("https://audi2c.faw-vw.com/mapi/user/v1/vrcode/send2", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-channel": "MINI_PROGRAM",
      "x-microservice-name": "audi-app-gateway-c",
      "x-namespace-code": "faw-audi-dev",
      "x-timestamp": String(Date.now())
    },
    body: JSON.stringify({
      describeCaptchaMiniResultReqDto: { captchaAppId: "198705236", ticket },
      sendVerificationCodeDto: { account: phone, verificationCodeTypeEnum: "LOGIN_BY_VERIFICATION_CODE" }
    })
  });
  const data = await resp.json();
  return data.code === 0;
}
```

---

### 2.2 登录获取 Token

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
    "verificationCode": "<6位验证码>",
    "code": ""
  }
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "accessToken": "eyJ...<JWT>",
    "userInfo": {
      "audiNickname": "王大锤",
      "aid": "33946831",
      ...
    }
  }
}
```

**Token 提取**：`response.data.accessToken`

**代码示例**：
```javascript
async function login(phone, code) {
  const resp = await fetch("https://audi2c.faw-vw.com/mapi/user/v1/account/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-channel": "MINI_PROGRAM",
      "x-microservice-name": "audi-app-gateway-c",
      "x-namespace-code": "faw-audi-dev",
      "x-timestamp": String(Date.now())
    },
    body: JSON.stringify({
      accountLoginDto: {
        account: phone, headImage: "", loginTypeEnum: "MOBILE_VERIFICATION_CODE",
        loginChannelEnum: "WECHAT_MINI_PROGRAM", password: "", verificationCode: code, code: ""
      }
    })
  });
  const data = await resp.json();
  if (data.code === 0) return data.data.accessToken;
  throw new Error(data.message);
}
```

---

## 3. 帖子列表（Feed）

**端点**：`GET /cnapi/v2/feed`

**Headers**：通用 App 通道 Headers

**参数**：

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| current | number | ✅ | 页码，从 1 开始 |
| size | number | ✅ | 每页条数（最大 20） |
| nonce | string | ✅ | UUID 随机值 |
| timestamp | string | ✅ | 毫秒时间戳 |

**响应结构**：
```json
{
  "code": 0,
  "data": {
    "records": [
      {
        "contentType": "INFORMATION",
        "information": { "id": "2062818271588560898", "title": "...", "commentCount": 559, ... },
        "subject": null,
        "activity": null,
        "nous": null
      }
    ]
  }
}
```

### contentType 与 ID 提取规则

| contentType | 嵌套字段 | ID 路径 | 占比 | 可评论 |
|-------------|---------|---------|------|--------|
| INFORMATION | `record.information` | `.id` | 46% | ✅ |
| DYNAMIC | `record.subject` | `.id` | 40% | ✅ |
| ARTICLE | `record.subject` | `.id` | 8% | ✅ |
| NOTES | `record.nous` | `.id` | 4% | ✅ |
| ACTIVITY | `record.activity` | `.id` | 2% | ❌ |

### 代码示例：获取可评论帖子

```javascript
const FEED_TYPE_MAP = {
  'INFORMATION': 'information',
  'DYNAMIC': 'subject',
  'ARTICLE': 'subject',
  'NOTES': 'nous',
};

async function getCommentablePosts(token, count = 20) {
  const url = `https://audi2c.faw-vw.com/cnapi/v2/feed?current=1&size=${count}&nonce=${crypto.randomUUID()}&timestamp=${Date.now()}`;
  const resp = await fetch(url, { headers: appHeaders(token) });
  const data = await resp.json();
  
  return data.data.records
    .filter(r => r.contentType in FEED_TYPE_MAP)
    .map(r => {
      const key = FEED_TYPE_MAP[r.contentType];
      const obj = r[key];
      return {
        id: String(obj.id),
        type: r.contentType,
        title: (obj.title || obj.content || '').replace(/<[^>]+>/g, '').slice(0, 50),
        commentCount: obj.commentCount || 0
      };
    })
    .filter(p => p.id);
}
```

---

## 4. 发评论

**端点**：`POST /cnapi/v1/comment_center/comment/save`

**Headers**：通用 App 通道 Headers（微信 Token 即可，无需 sign）

**参数**（URL query）：

| 参数 | 说明 |
|------|------|
| nonce | UUID |
| timestamp | 毫秒时间戳 |

**请求体**：
```json
{
  "content": "评论内容",
  "subjectId": "<帖子ID，从 Feed 中提取>",
  "subjectContentTypeEnum": "<INFORMATION|DYNAMIC|ARTICLE|NOTES>",
  "nickName": "王大锤",
  "avatarUrl": "",
  "ipRegion": "山东省"
}
```

**关键**：`subjectContentTypeEnum` 必须与帖子的 `contentType` 一致。

**响应**：
```json
{ "code": 0, "message": null, "data": true }
```

**错误码**：
- `code: 0` — 评论成功
- `code: 400` — 参数错误（如 subjectId 为空）

### 代码示例

```javascript
async function postComment(token, postId, contentType, content) {
  const url = `https://audi2c.faw-vw.com/cnapi/v1/comment_center/comment/save?nonce=${crypto.randomUUID()}&timestamp=${Date.now()}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: appHeaders(token),
    body: JSON.stringify({
      content,
      subjectId: postId,
      subjectContentTypeEnum: contentType,
      nickName: "王大锤",
      avatarUrl: "",
      ipRegion: "山东省"
    })
  });
  const data = await resp.json();
  return data.code === 0;
}
```

---

## 5. 图片上传

**端点**：`POST /mapi/attachment/v1/batch_upload`

**Headers**：mapi 通道 Headers（微信 Token 即可，**无需 sign**）

**Content-Type**：`multipart/form-data`

**Form 字段**：

| 字段 | 值 | 说明 |
|------|------|------|
| componentName | `userComplaint` | 组件名（固定） |
| fileType | `img` | 文件类型 |
| privatePermanent | `false` | 是否私有永久 |
| serviceName | `user` | 服务名 |
| publicRead | `true` | 是否公开可读 |
| files | `<binary>` | 图片文件（JPEG/PNG） |

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "2063129940905467905",
      "preSignedUrl": "https://faw-audi-public-prod-1256532032.file.myqcloud.com/user/userComplaint/xxx.jpg"
    }
  ]
}
```

**注意**：
- 使用 mapi 通道（非 cnapi），不需要 `x-fawvw-sign`
- 返回的 `preSignedUrl` 即为 CDN 公开 URL，可永久引用
- 支持 JPEG 和 PNG 格式

### 代码示例

```javascript
async function uploadImage(token, imageBuffer, filename) {
  const formData = new FormData();
  formData.append('componentName', 'userComplaint');
  formData.append('fileType', 'img');
  formData.append('privatePermanent', 'false');
  formData.append('serviceName', 'user');
  formData.append('publicRead', 'true');
  formData.append('files', new Blob([imageBuffer], { type: 'image/jpeg' }), filename);

  const resp = await fetch("https://audi2c.faw-vw.com/mapi/attachment/v1/batch_upload", {
    method: "POST",
    headers: {
      "X-ACCESS-TOKEN": token,
      "X-CHANNEL": "MINI_PROGRAM",
      "X-MicroService-Name": "audi-app-gateway-c",
      "X-NameSpace-Code": "faw-audi-dev",
      "X-TIMESTAMP": String(Date.now())
    },
    body: formData
  });
  const data = await resp.json();
  if (data.code === 0) return data.data[0].preSignedUrl;
  throw new Error(data.message);
}
```

---

## 6. 发帖（社区动态）

**端点**：`POST /cnapi/v1/community/subject/publish`

**Headers**：通用 App 通道 Headers（微信 Token 即可，**无需 sign**）

**参数**（URL query）：

| 参数 | 说明 |
|------|------|
| nonce | UUID |
| timestamp | 毫秒时间戳 |

**请求体**：
```json
{
  "type": 0,
  "topicList": [
    { "name": "#话题名称#", "id": "<话题ID>" }
  ],
  "momentDto": {
    "imgUrlList": ["<CDN图片URL1>", "<CDN图片URL2>"],
    "content": "帖子文本内容",
    "contentJson": "[{\"content\":\"帖子文本内容\",\"inlineStyleEntities\":[],\"blocktype\":\"block_normal_text\"}]"
  },
  "vrfCode": "<动态生成的vrfCode>",
  "ipRegion": "山东省",
  "confirmPublish": false
}
```

**字段说明**：

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| type | number | ✅ | 0=动态 |
| topicList | array | ❌ | 关联话题（可为空数组） |
| momentDto.imgUrlList | string[] | ❌ | 图片 CDN URL 列表（可为空） |
| momentDto.content | string | ✅ | 纯文本内容 |
| momentDto.contentJson | string | ✅ | 富文本 JSON（含样式标记） |
| vrfCode | string | ✅ | 设备验证码（随机签名即可） |
| ipRegion | string | ✅ | IP 所在省份 |
| confirmPublish | boolean | ✅ | false |

**响应**：
```json
{
  "code": 0,
  "data": {
    "createResult": true,
    "textPassAudit": true,
    "needReview": false,
    "imgPassAudit": true,
    "id": "2063130925127012353",
    "jumpUrl": "faw-audi://find/moment/detail?id=2063130925127012353"
  }
}
```

### 代码示例：完整图文发帖

```javascript
async function publishPost(token, content, imageUrls = [], topics = []) {
  const DID = "AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1";
  const vrfCode = generateVrfCode(DID);  // 见 vrfCode 生成章节
  const nonce = crypto.randomUUID().toUpperCase();
  const ts = String(Date.now());

  const url = `https://audi2c.faw-vw.com/cnapi/v1/community/subject/publish?nonce=${nonce}&timestamp=${ts}`;
  const body = {
    type: 0,
    topicList: topics.map(t => ({ name: t.name, id: t.id })),
    momentDto: {
      imgUrlList: imageUrls,
      content,
      contentJson: JSON.stringify([{
        content,
        inlineStyleEntities: [],
        blocktype: "block_normal_text"
      }])
    },
    vrfCode,
    ipRegion: "山东省",
    confirmPublish: false
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: appHeaders(token),
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  return data;  // { code, data: { createResult, id, ... } }
}
```

### 完整图文发帖流程

```
1. uploadImage(token, imgBuffer, "photo.jpg")  → CDN URL
2. publishPost(token, "帖子内容", [cdnUrl], [{name:"#话题#", id:"xxx"}])
```

---

## 7. 话题列表

**端点**：`GET /cnapi/v1/community/topic/hot`

**Headers**：通用 App 通道 Headers（无需 sign）

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| current | number | 页码（从1开始） |
| pageSize | number | 每页条数（默认10） |
| nonce | string | UUID |
| timestamp | string | 毫秒时间戳 |

**响应**：
```json
{
  "code": 0,
  "data": {
    "records": [
      {
        "id": "1883401977826816001",
        "name": "#奥迪提车日记#",
        "heatDegree": 44788,
        "status": 1
      }
    ],
    "total": 465,
    "pages": 47
  }
}
```

### 代码示例

```javascript
async function getHotTopics(token, page = 1, size = 10) {
  const url = `https://audi2c.faw-vw.com/cnapi/v1/community/topic/hot?current=${page}&pageSize=${size}&nonce=${crypto.randomUUID()}&timestamp=${Date.now()}`;
  const resp = await fetch(url, { headers: appHeaders(token) });
  const data = await resp.json();
  return data.data.records;  // [{ id, name, heatDegree, ... }]
}
```

---

## 8. 签到与任务

### 8.1 签到接口

**端点**：`GET /cnapi/v2/mine/task_list`

**Headers**：通用 App 通道 Headers + **必须**：
- `x-fawvw-sign: <签名值>`（32字节 Base64）
- 需使用 APP Token（`cch=APP`）

**参数**：

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| autoSignIn | string | ✅ | `true`=签到+查询, `false`=仅查询 |
| nonce | string | ✅ | UUID |
| timestamp | string | ✅ | 毫秒时间戳 |
| vrfCode | string | ✅ | Base64 Protobuf 编码的设备验证码 |

**响应（签到成功）**：
```json
{
  "code": 0,
  "data": {
    "signInInfo": {
      "signInStatus": 3,
      "accCount": 3,
      "totalAccCount": 37,
      "score": 436,
      "baseScore": 1,
      "extraScoreDay": 7,
      "extraScore": 3,
      "signRecordsThisMonth": {
        "year": 2026, "month": 6, "day": 6,
        "signRecordsThisMonth": [1, 2, 3, 4, 5, 6]
      }
    },
    "memberLevel": "金卡",
    "memberScore": "436"
  }
}
```

### signInStatus 状态码

| 值 | 含义 |
|----|------|
| 0 | 签到未触发（sign 缺失/无效时的静默拒绝） |
| 1 | 今天已签到（查询状态） |
| 3 | 签到成功（签到动作刚执行） |

### 限制说明

- **必须 APP Token**：微信 Token 调用此接口返回 `signInStatus=0`，签到不触发
- **必须 x-fawvw-sign**：缺少此 header 同样返回 `signInStatus=0`
- **sign 可重放**：同一 sign 值不绑定时间，可跨请求使用（待验证跨日有效性）

---

### 8.2 vrfCode 生成

vrfCode 是 Base64 编码的 Protobuf 结构：

| 字段编号 | 内容 | 说明 |
|---------|------|------|
| 1 | 设备 ID | 固定值 |
| 2 | 时间戳 | 毫秒字符串 |
| 3 | 签名 | 256字节随机数据的 Base64（服务端不校验内容） |
| 4 | "1" | 固定值 |

**代码示例**：
```javascript
import crypto from 'crypto';

function generateVrfCode(deviceId) {
  const ts = String(Date.now());
  const fakeSig = crypto.randomBytes(256).toString('base64');

  function encodeVarint(v) {
    const r = [];
    while (v > 0x7f) { r.push((v & 0x7f) | 0x80); v >>>= 7; }
    r.push(v);
    return r;
  }
  function encodeStr(fieldNum, str) {
    const buf = Buffer.from(str, 'utf-8');
    return [(fieldNum << 3) | 2, ...encodeVarint(buf.length), ...buf];
  }

  const proto = Buffer.from([
    ...encodeStr(1, deviceId),
    ...encodeStr(2, ts),
    ...encodeStr(3, fakeSig),
    ...encodeStr(4, '1')
  ]);
  return proto.toString('base64');
}

const DID = "AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1";
const vrfCode = generateVrfCode(DID);
```

---

### 8.3 签到自动化方案

由于 `x-fawvw-sign` 的算法在 App native 层且 APK 加壳无法反编译，当前方案：

1. **一次性抓包**：开 mitmproxy（WireGuard 模式）+ App 手动签到
2. **提取 sign**：从抓包数据中提取 `x-fawvw-sign` 值
3. **每日重放**：使用固定 sign + APP Token + 动态 vrfCode 签到
4. **Token 续期**：Token 过期前通过 API 响应头自动续期

**完整签到脚本示例**：
```javascript
import https from 'https';
import crypto from 'crypto';

const APP_TOKEN = "<YOUR_APP_TOKEN>";
const SIGN = "<YOUR_CAPTURED_SIGN>";
const DID = "AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1";

async function signIn() {
  const vrfCode = generateVrfCode(DID);  // 见上方函数
  const nonce = crypto.randomUUID().toUpperCase();
  const ts = String(Date.now());
  
  const params = new URLSearchParams({
    autoSignIn: 'true', nonce, timestamp: ts, vrfCode
  });
  const url = `https://audi2c.faw-vw.com/cnapi/v2/mine/task_list?${params}`;
  
  const resp = await fetch(url, {
    headers: {
      "x-access-token": APP_TOKEN,
      "x-fawvw-sign": SIGN,
      "x-audi-did": DID,
      "x-channel": "iOS",
      "x-audi-entry": "app",
      "x-microservice-name": "api-gateway",
      "x-namespace-code": "production",
      "sv": "6.1.1",
      "user-agent": "AudiApp/506.1.1 (com.fawvw.audisuper; build:33; iOS 26.5.0) Alamofire/5.11.1",
      "accept": "application/json",
      "content-type": "application/json",
      "x-lang": "zh-CN"
    }
  });
  const data = await resp.json();
  const status = data.data.signInInfo.signInStatus;
  console.log(status === 3 ? '✅ 签到成功' : status === 1 ? '已签过' : '❌ 签到失败');
  return data;
}
```

---

## 9. 会员信息查询

**端点**：`GET /mapi/member/v1/member/info`

**Headers**：mapi 通道 Headers（含 Token）

**响应**：
```json
{
  "code": 0,
  "data": {
    "memberLevel": "金卡会员",
    "memberScore": "436",
    "growthScore": "6651"
  }
}
```

**代码示例**：
```javascript
async function getMemberInfo(token) {
  const resp = await fetch("https://audi2c.faw-vw.com/mapi/member/v1/member/info", {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-channel": "MINI_PROGRAM",
      "x-microservice-name": "audi-app-gateway-c",
      "x-namespace-code": "faw-audi-dev",
      "x-timestamp": String(Date.now()),
      "x-access-token": token
    }
  });
  const data = await resp.json();
  return data.data;  // { memberLevel, memberScore, growthScore }
}
```

---

## 10. Token 续期

每次 API 调用时检查响应头 `x-access-token`。当 Token 快过期时，服务端可能返回新 Token：

```javascript
function checkTokenRenewal(responseHeaders, currentToken) {
  const newToken = responseHeaders.get("x-access-token");
  if (newToken && newToken !== currentToken && newToken.startsWith("eyJ")) {
    // Token 已续期，保存新值
    return newToken;
  }
  return currentToken;
}
```

**注意**：
- 续期机制为滑动续期（每次调用都可能刷新）
- Token 有效期约 83 小时，建议每 70 小时至少调用一次 API
- 如续期失败，需重新登录

---

## 11. 附录

### 11.1 通用工具函数

```javascript
// 生成 App 通道 Headers
function appHeaders(token) {
  return {
    "x-access-token": token,
    "x-audi-did": "AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1",
    "x-channel": "iOS",
    "x-audi-entry": "app",
    "x-microservice-name": "api-gateway",
    "x-namespace-code": "production",
    "sv": "6.1.1",
    "user-agent": "AudiApp/506.1.1 (com.fawvw.audisuper; build:33; iOS 26.5.0) Alamofire/5.11.1",
    "accept": "application/json",
    "content-type": "application/json",
    "x-lang": "zh-CN"
  };
}
```

### 11.2 错误码汇总

| code | 含义 |
|------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | Token 无效/过期 |
| 10009 | 需要重新登录 |
| 500 | 服务端错误 |

### 11.3 常见问题

**Q: 评论需要 x-fawvw-sign 吗？**
A: 不需要。评论接口只要有效的 Token（微信或 APP）即可。

**Q: 签到为什么返回 signInStatus=0？**
A: 缺少 `x-fawvw-sign` 或使用了微信 Token。签到需要 APP Token + 有效 sign。

**Q: vrfCode 的签名内容重要吗？**
A: 不重要。服务端不校验 vrfCode 中的签名字段，随机数据即可。

**Q: 帖子 ID 在哪里？**
A: 不在 record 顶层。根据 `contentType` 进入对应嵌套字段（information/subject/nous/activity）取 `.id`。

**Q: sign 值会过期吗？**
A: 测试显示旧 sign 仍可通过校验（重放返回 signInStatus=1 而非 0）。推测 sign 绑定 Token，Token 过期后 sign 也失效。

**Q: 图片上传需要 x-fawvw-sign 吗？**
A: 使用 mapi 通道（`/mapi/attachment/v1/batch_upload`）不需要。App 的 cnapi 通道需要但无法重放。推荐使用 mapi 通道。

**Q: 发帖需要 x-fawvw-sign 吗？**
A: 不需要。发帖接口（`/cnapi/v1/community/subject/publish`）微信 Token 即可，无需 sign。

**Q: 图文帖子的完整流程？**
A: 1) 用 mapi 通道上传图片获取 CDN URL → 2) 调用 publish 接口时把 URL 放入 imgUrlList。
