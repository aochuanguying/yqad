# 短信发送失败问题排查报告

## 问题现象
发送短信时返回 HTTP 500 错误：
```json
{
  "success": false,
  "error": "短信发送失败：发送短信失败：HTTP 500 - Failed to send SMS"
}
```

## 排查过程

### 1. 检查配置
```bash
curl -X GET "http://192.168.50.10:3080/api/mobile-service-config"
```

**结果**: ✅ 配置正确
```json
{
  "apiUrl": "http://10.6.0.2:5000",
  "apiToken": "hv2SfP9TVxyGqsdsTh5dTYaWL2iGsqyIzErhJjGvBzc"
}
```

### 2. 测试 API 连接
```bash
curl -X GET "http://10.6.0.2:5000/health"
```

**结果**: ✅ 服务正常
```json
{
  "root_access": true,
  "service": "android-telecom-api",
  "status": "ok"
}
```

### 3. 测试发送短信
```bash
curl -X POST "http://10.6.0.2:5000/api/v1/sms/send" \
  -H "Authorization: Bearer ..." \
  -d '{"phone_number": "18953272532", "message": "测试短信"}'
```

**结果**: ❌ 失败
```json
{
  "details": "/data/data/com.termux/files/usr/bin/sh: 1: termux-sms-send: not found",
  "error": "Failed to send SMS",
  "success": false
}
```

## 根本原因

**Android 手机上缺少 `termux-sms-send` 命令**

Android Telecom API 服务依赖 Termux 的 `termux-sms-send` 命令来发送短信，但该命令未安装或不可用。

## 解决方案

### 步骤 1: 安装 Termux:API 应用

在 Android 手机上下载并安装 Termux:API：

**方式 1: F-Droid（推荐）**
```
https://f-droid.org/packages/com.termux.api/
```

**方式 2: GitHub Releases**
```
https://github.com/termux/termux-api/releases
```

**方式 3: 应用商店**
- 搜索 "Termux:API"

### 步骤 2: 在 Termux 中安装 API 包

打开 Termux 应用，执行：
```bash
pkg update
pkg install termux-api
```

### 步骤 3: 授予权限

1. 打开 **Termux:API** 应用
2. 授予以下权限：
   - ✅ 短信 (SMS)
   - ✅ 电话 (Phone)
   - ✅ 通讯录 (Contacts)
   - ✅ 位置 (Location)
   - ✅ 其他所需权限

### 步骤 4: 测试命令

在 Termux 中测试：
```bash
# 测试发送短信
termux-sms-send -n 18953272532 "测试短信"

# 测试拨打电话
termux-call -n 18953272532
```

### 步骤 5: 验证 API

在 Termux 中测试 API：
```bash
curl -X POST "http://localhost:5000/api/v1/sms/send" \
  -H "Authorization: Bearer hv2SfP9TVxyGqsdsTh5dTYaWL2iGsqyIzErhJjGvBzc" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "18953272532", "message": "测试短信"}'
```

应该返回：
```json
{
  "success": true,
  "message": "SMS sent successfully"
}
```

## 为什么电话能成功？

电话功能使用的是 `termux-call` 命令，这个命令是 Termux 的基础功能，不需要额外安装 Termux:API 插件，所以电话告警能正常工作。

## 各告警渠道状态

| 渠道 | 状态 | 说明 |
|------|------|------|
| **Bark 推送** | ✅ 正常 | 已修复 URL 路径问题 |
| **电话告警** | ✅ 正常 | 使用 termux-call（基础功能） |
| **短信通知** | ❌ 待修复 | 需要安装 termux-api |

## 常见问题

### Q: 安装后仍然提示命令不存在？
A: 重启 Termux 应用，或者执行 `hash -r` 刷新命令缓存。

### Q: 权限已授予但仍然失败？
A: 检查 Android 系统设置，确保 Termux:API 有短信权限。

### Q: 能否使用其他方式发送短信？
A: 可以修改 Android Telecom API 服务，使用 Android Intent 或其他方式，但需要修改服务端代码。

## 参考链接

- Termux 官网：https://termux.org/
- Termux:API 文档：https://wiki.termux.com/wiki/Termux:API
- Termux 包管理：https://wiki.termux.com/wiki/Package_Management

---

**问题发现时间**: 2026-07-26 20:50
**根本原因**: 缺少 termux-sms-send 命令
**解决方案**: 安装 Termux:API 插件
