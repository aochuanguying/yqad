# 集成测试：socket hang up 错误修复

## 前置条件

- 服务已启动 (npm run dev)
- API 模式配置为 real
- 已存在有效的 Token

## 测试用例

### 1. 会员信息查询

```bash
curl -sS http://localhost:3000/api/member/info | jq .
```

**预期结果**:
```json
{
  "code": 0,
  "data": {
    "memberLevel": "白金卡会员",
    "memberScore": 437
  }
}
```

**验证点**:
- ✅ 返回 code=0
- ✅ 包含 memberLevel 和 memberScore 字段
- ✅ 无 "socket hang up" 错误

### 2. 发送短信验证码

```bash
curl -sS -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"18953272532","ticket":"test"}' | jq .
```

**预期结果**:
```json
{
  "code": 0,
  "message": "验证码已发送"
}
```

**验证点**:
- ✅ 返回 code=0
- ✅ message 显示"验证码已发送"
- ✅ 无 "socket hang up" 错误

### 3. 检查日志

```bash
tail -30 logs/$(date +%Y-%m-%d).log | grep -i error
```

**预期结果**:
- 无 "socket hang up" 相关 ERROR
- 无 "ECONNRESET" 相关 ERROR
- 无 "ETIMEDOUT" 相关 ERROR

## 回归测试

### 4. 内容分析任务

```bash
curl -sS http://localhost:3000/api/analysis/run | jq .
```

**验证点**:
- ✅ 能正常获取帖子列表
- ✅ 无网络连接错误

### 5. Token 验证

```bash
curl -sS -X POST http://localhost:3000/api/auth/verify | jq .
```

**预期结果**:
```json
{
  "code": 0,
  "data": {
    "remoteValid": true,
    "memberLevel": "白金卡会员"
  }
}
```

**验证点**:
- ✅ Token 验证成功
- ✅ 能正确获取会员信息
