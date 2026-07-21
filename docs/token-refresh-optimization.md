# Token 续期逻辑优化

## 优化背景

### 问题
- 原有 Token 续期机制**完全依赖上游 API 响应头** `x-access-token`
- 如果上游不返回新的 Token，则无法续期
- 导致 Token 在 83 小时后过期，出现 `code=10009 请您重新登录系统`

### 原有逻辑
```typescript
// real-client.ts
private checkTokenRenewal(response: AxiosResponse, currentToken: string): void {
  const newToken = response.headers['x-access-token'];
  if (newToken && newToken !== currentToken && newToken.startsWith('eyJ')) {
    // 只有响应头有新 Token 时才续期
    this.tokenRenewalCallback(newToken);
  }
}
```

## 优化方案

### 核心思路
**不依赖响应头**，调用 `getMemberInfo()` 成功后即认为 Token 已续期，直接重置过期时间为 83 小时。

### 实现变更

#### 文件：`src/services/auth.ts`

**修改前**：
```typescript
await (this.api as any).getMemberInfo(this.token.accessToken);
const extendedHours = (this.token.expiresAt - beforeExpiresAt) / 1000 / 3600;
// 依赖响应头更新 this.token.expiresAt
```

**修改后**：
```typescript
await (this.api as any).getMemberInfo(this.token.accessToken);
const duration = Date.now() - beforeTime;

// 不依赖响应头，调用成功后直接重置过期时间为 83 小时
const newExpiresAt = Date.now() + 83 * 3600 * 1000;
this.token.expiresAt = newExpiresAt;
this.token.savedAt = Date.now();
this.persistTokenToRedis();

const extendedHours = (newExpiresAt - beforeExpiresAt) / 1000 / 3600;
```

## 优化效果

### 自动续期机制
- **检查间隔**: 每 12 小时检查一次
- **刷新阈值**: 剩余时间不足 6 小时时主动刷新
- **续期方式**: 调用 `getMemberInfo()` 接口
- **续期时长**: 成功后重置为 83 小时

### 日志输出

**触发刷新时**：
```
========================================
【Token 主动刷新检查 - 触发刷新】
  当前 Token: eyJhbGciOiJIUzI1NiIsIn...
  当前剩余时间：5 小时
  过期时间：2026-07-21 03:00:00
  刷新阈值：6 小时
  触发主动刷新：是
========================================
```

**刷新成功**：
```
========================================
【Token 主动刷新结果 - 成功】
  刷新接口：getMemberInfo
  请求耗时：234ms
  刷新状态：✅ 成功
  续期前过期时间：2026-07-21 03:00:00
  续期后过期时间：2026-07-22 14:00:00
  延长小时数：35.0 小时
  刷新后 Token: eyJhbGciOiJIUzI1NiIsIn...
========================================
```

**刷新失败**：
```
========================================
【Token 主动刷新结果 - 失败】
  刷新接口：getMemberInfo
  刷新状态：❌ 失败
  错误类型：AxiosError
  错误信息：Request failed with status code 401
========================================
```

## 注意事项

### 1. Token 续期前提
- Token 必须是通过**手机号验证码登录**获取的有效 Token
- 如果 Token 已完全失效（code=10009），需要重新登录

### 2. 续期失败处理
- 续期失败时**不会抛出异常**，不影响主流程
- 会在日志中记录失败原因
- 下次检查时（12 小时后）再次尝试

### 3. 建议
- 定期检查 `/api/auth/token-status` 查看 Token 剩余时间
- 关注日志中的 Token 续期记录
- 如连续续期失败，需手动重新登录

## 测试建���

### 本地测试
1. 启动服务后查看 Token 状态
2. 等待 12 小时观察是否触发续期
3. 检查日志中的续期记录

### 验证方法
```bash
# 查看 Token 状态
curl http://localhost:3000/api/auth/token-status

# 查看最近续期日志
tail -f logs/app.log | grep "Token 主动刷新"
```

## 相关文件

- `src/services/auth.ts` - Token 续期逻辑实现
- `src/api/real-client.ts` - API 客户端（保留响应头检测作为兜底）
- `src/web/routes/auth-routes.ts` - Token 状态查询接口
