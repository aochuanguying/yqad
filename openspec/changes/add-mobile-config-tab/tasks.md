## 1. 数据库迁移

- [x] 1.1 创建 `mobile_sms` 表的迁移文件
- [x] 1.2 创建 `missed_calls` 表的迁移文件
- [x] 1.3 执行数据库迁移

## 2. 存储层实现

- [x] 2.1 创建 `MobileSmsStorage` 类（MySQL 存储）
- [x] 2.2 创建 `MissedCallStorage` 类（MySQL 存储）
- [x] 2.3 在 `src/storage/mysql/init.ts` 中注册存储类

## 3. API 路由实现

- [x] 3.1 创建 `mobile-routes.ts` 路由文件
- [x] 3.2 实现 `POST /api/posts/mobile/sms` 接口
- [x] 3.3 实现 `GET /api/posts/mobile/sms` 接口
- [x] 3.4 实现 `POST /api/posts/mobile/calls/missed` 接口
- [x] 3.5 实现 `GET /api/posts/mobile/calls/missed` 接口
- [x] 3.6 在 `src/web/server.ts` 中注册路由

## 4. 前端页面实现

- [x] 4.1 在首页导航添加"手机配置"页签
- [x] 4.2 创建手机配置主页面（包含三个子功能入口）
- [x] 4.3 集成 AutoJS 配置页面到手机配置页签
- [x] 4.4 实现"手机短信"子功能页面
- [x] 4.5 实现"未接电话"子功能页面

## 5. 测试验证

- [x] 5.1 测试 API Token 认证
- [x] 5.2 测试短信记录 API
- [x] 5.3 测试未接电话记录 API
- [x] 5.4 测试前端页面导航
- [x] 5.5 验证数据库记录写入
