# 修复 socket hang up 网络连接错误

## 问题描述

Web 管理界面在调用登录 API 和会员信息查询时频繁出现 "socket hang up" 错误，导致无法正常使用登录功能和 Token 验证。

## 根因分析

1. **HTTP/2 兼容性问题**: 服务端 `audi2c.faw-vw.com` 支持 HTTP/2，axios v1.16.1 默认会协商使用 HTTP/2，但在 keep-alive 连接和 timeout 场景下存在稳定性问题
2. **Content-Type 错误**: `getMemberInfo` 方法使用了错误的 `application/x-www-form-urlencoded`，应该使用 `application/json`

## 修复方案

1. 强制 axios 使用 HTTP/1.1，通过配置 httpAgent 和 httpsAgent
2. 修正 `getMemberInfo` 方法的 Content-Type 为 `application/json`

## 影响范围

- `src/api/real-client.ts`: RealAudiApi 客户端配置
- 所有依赖 mapi 通道的 API 调用

## 验证方式

1. Web 界面会员信息查询正常
2. 登录 API 发送验证码成功
3. 日志中无 "socket hang up" 错误
