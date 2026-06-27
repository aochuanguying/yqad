# 设计文档：socket hang up 错误修复

## 上下文

系统在调用一汽奥迪 APP 真实 API 时频繁出现 "socket hang up" 错误，影响以下功能:
- Web 管理界面的会员信息查询
- 手机号登录 (发送验证码)
- Token 在线验证

## 技术决策

### 1. 强制使用 HTTP/1.1

**选择**: 在 axios 实例创建时显式配置 httpAgent 和 httpsAgent，强制使用 HTTP/1.1 协议。

**替代方案**:
- 升级 axios 到更新版本 → 当前 v1.16.1 已包含 HTTP/2 修复，问题仍存在
- 禁用 keep-alive → 会影响连接池性能

**理由**:
- HTTP/2 在 Node.js axios 中的实现仍有稳定性问题
- HTTP/1.1 经过充分验证，稳定性更好
- 连接池参数 (maxSockets: 10) 可控制并发连接数

### 2. 修正 Content-Type

**选择**: `getMemberInfo` 方法使用 `application/json` 作为 Content-Type。

**理由**:
- mapi 通道所有接口均使用 JSON 格式
- `application/x-www-form-urlencoded` 会导致服务端解析错误

## 代码变更

### RealAudiApi 构造函数 (src/api/real-client.ts:43-50)

```typescript
constructor() {
  const config = loadConfig();
  this.client = axios.create({
    baseURL: config.api.baseUrl,
    timeout: config.api.timeout,
    // 强制使用 HTTP/1.1 避免 HTTP/2 兼容性问题
    httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 10 }),
    httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 10 }),
  });
}
```

### getMemberInfo 方法 (src/api/real-client.ts:467)

```typescript
async getMemberInfo(accessToken: string): Promise<MemberInfoResponse> {
  const response = await this.client.get('/mapi/member/v1/member/info', {
    headers: this.buildMapiHeaders(accessToken, 'application/json'), // 修正 Content-Type
    timeout: 10000,
  });
  // ...
}
```

## 验证结果

✅ 修复前:
- 会员信息查询：socket hang up
- 发送验证码：socket hang up
- 日志大量 ERROR

✅ 修复后:
- 会员信息查询：成功返回会员等级和积分
- 发送验证码：成功返回 code=0
- 日志只有 INFO，无 ERROR
