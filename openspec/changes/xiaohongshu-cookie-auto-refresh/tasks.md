## 1. 数据库迁移

- [x] 1.1 创建数据库迁移脚本 `database/migrations/cookie-schema.sql`
- [x] 1.2 修改字段：`xiaohongshu_cookie` (TEXT, 明文), `cookie_version` (INT), `last_refresh_time` (DATETIME), `next_refresh_time` (DATETIME)
- [x] 1.3 新增字段：`cookie_refresh_logs` (JSON) 存储最近 30 次刷新记录
- [x] 1.4 新增表：`task_schedules` 统一管理定时任务（id, task_type, cron_expression, enabled, last_run, next_run）
- [x] 1.5 执行迁移并验证
- [x] 1.6 备份现有配置数据

## 2. Cookie 存储模块

- [x] 2.1 创建 `src/services/cookie-manager/storage.ts`
- [x] 2.2 实现 `saveCookie(cookie: string): Promise<void>` 明文保存
- [x] 2.3 实现 `getCookie(): Promise<string | null>` 直接读取
- [x] 2.4 实现 `getCookieVersion(): Promise<number>` 获取版本号
- [x] 2.5 实现 `logRefresh(success: boolean, duration: number, error?: string): Promise<void>` 记录日志
- [x] 2.6 添加单元测试

## 3. Cookie 扫码模块

- [x] 3.1 创建 `src/services/cookie-manager/scanner.ts`
- [x] 3.2 实现 `generateFirstQRCode(): Promise<string>` 生成第一个二维码
- [x] 3.3 实现 `waitForFirstScan(timeout: number): Promise<boolean>` 等待第一次扫码
- [x] 3.4 实现 `generateSecondQRCode(): Promise<string>` 生成第二个二维码
- [x] 3.5 实现 `waitForLogin(timeout: number): Promise<CookieResult>` 等待登录完成
- [x] 3.6 实现 `extractAndValidateCookie(): CookieValidationResult` 提取验证 Cookie
- [x] 3.7 实现 `cleanupQRCode(filename: string): void` 清理二维码
- [x] 3.8 添加单元测试

## 4. Cookie 刷新服务

- [x] 4.1 创建 `src/services/cookie-manager/refresher.ts`
- [x] 4.2 实现 `refresh(): Promise<RefreshResult>` 完整刷新流程（两次扫码）
- [x] 4.3 集成扫码模块和存储模块
- [x] 4.4 实现错误处理和重试逻辑
- [x] 4.5 添加刷新状态事件发射

## 5. API 接口

- [x] 5.1 创建 `src/web/routes/cookie-routes.ts`
- [x] 5.2 实现 `POST /api/cookie/refresh` 手动触发刷新
- [x] 5.3 实现 `GET /api/cookie/status` 查看 Cookie 状态
- [x] 5.4 实现 `GET /api/cookie/qr-code/:filename` 获取二维码图片
- [x] 5.5 实现 `POST /api/cookie/test-xiaohongshu` 测试连接
- [x] 5.6 实现 `POST /api/cookie/manual` 手工保存 Cookie
- [x] 5.7 实现 `GET /api/scheduler/tasks` 查看所有定时任务
- [x] 5.8 实现 `POST /api/scheduler/tasks/:taskId/trigger` 手动触发任务
- [x] 5.9 添加 API 文档

## 6. 小红书搜索服务改造

- [x] 6.1 修改 `src/services/internet-search/xiaohongshu-search.ts`
- [x] 6.2 添加 `CookieManager` 依赖注入
- [x] 6.3 构造函数从数据库读取 Cookie
- [x] 6.4 移除环境变量读取逻辑
- [x] 6.5 添加 Cookie 失效检测和提示

## 7. 统一调度器

- [x] 7.1 创建 `src/services/scheduler/task-scheduler.ts`
- [x] 7.2 实现 `registerTask(task: TaskConfig): void` 注册任务
- [x] 7.3 实现 `startAllTasks(): void` 启动所有任务
- [x] 7.4 实现 `triggerTask(taskId: string): Promise<void>` 手动触发
- [x] 7.5 实现并发控制（同类型任务互斥）
- [x] 7.6 集成 Cookie 刷新任务
- [x] 7.7 集成评论任务
- [x] 7.8 集成素材整理任务
- [x] 7.9 添加任务管理 API

## 8. 前端手工配置

- [x] 8.1 修改前端网络配置页面
- [x] 8.2 添加 Cookie 文本输入框
- [x] 8.3 添加"保存"按钮
- [x] 8.4 添加"测试连接"按钮
- [x] 8.5 显示当前 Cookie 状态
- [x] 8.6 添加 Cookie 格式验证

## 9. Docker 部署配置

- [x] 9.1 创建 `docker/cookie-manager/Dockerfile`
- [x] 9.2 安装中文字体、Playwright、Node.js
- [x] 9.3 创建 `docker/cookie-manager/docker-compose.yml`
- [x] 9.4 配置卷挂载（browser_data, qr_codes, logs）
- [x] 9.5 配置环境变量
- [x] 9.6 设置资源限制

## 10. 脚本和工具

- [x] 10.1 创建 `scripts/refresh-xiaohongshu-cookie.ts` 命令行工具
- [x] 10.2 支持 `--manual` 手动扫码模式
- [x] 10.3 支持 `--status` 查看状态模式
- [x] 10.4 支持 `--force` 强制刷新模式
- [x] 10.5 添加脚本文档

## 11. 测试和文档

- [x] 11.1 编写扫码模块测试（两次扫码）
- [x] 11.2 编写存储模块测试
- [x] 11.3 编写 API 接口测试
- [x] 11.4 编写调度器测试
- [x] 11.5 更新部署文档
- [x] 11.6 编写用户操作手册（包含两次扫码说明）

## 12. 部署和验证

- [x] 12.1 本地 Docker 测试
- [x] 12.2 群晖 NAS 部署测试
- [x] 12.3 首次扫码登录验证（两次扫码）
- [x] 12.4 手工配置 Cookie 测试
- [x] 12.5 自动刷新功能验证（等待 24 小时或修改 Cron 测试）
- [x] 12.6 搜索服务集成验证
- [x] 12.7 统一调度器验证
- [x] 12.8 性能和稳定性测试
