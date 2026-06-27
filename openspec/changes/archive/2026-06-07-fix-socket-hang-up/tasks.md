# 修复 socket hang up 错误

## 任务列表

- [x] 1. 问题分析
  - [x] 1.1 检查日志中的错误信息
  - [x] 1.2 测试 curl 直接调用 API (验证服务端正常)
  - [x] 1.3 调研 axios HTTP/2 兼容性问题

- [x] 2. 实现修复
  - [x] 2.1 在 RealAudiApi 构造函数中添加 httpAgent 和 httpsAgent 配置
  - [x] 2.2 修正 getMemberInfo 方法的 Content-Type 为 application/json

- [x] 3. 验证测试
  - [x] 3.1 重启服务
  - [x] 3.2 测试会员信息查询 API
  - [x] 3.3 测试发送验证码 API
  - [x] 3.4 检查日志无 ERROR

- [x] 4. 文档
  - [x] 4.1 编写 proposal.md
  - [x] 4.2 编写 design.md
