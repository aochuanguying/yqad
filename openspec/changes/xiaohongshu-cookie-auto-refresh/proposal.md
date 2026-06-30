## 为什么

小红书 Cookie 有效期短（1-3 天），需要频繁手动更新，影响生产环境稳定性。当前部署环境为群晖 NAS218+ Docker，无法直接使用有界面的浏览器进行扫码登录。需要实现一套适合 Docker 环境的 Cookie 自动获取和定期刷新机制，减少人工干预，提升系统稳定性。

**新增功能**:
1. **扫码登录 Cookie 获取** - 生成二维码图片，用户扫码后自动获取并保存 Cookie 到数据库（支持小红书两次扫码登录流程）
2. **定期自动刷新** - 每 24 小时自动刷新 Cookie，与评论/素材整理任务统一调度
3. **数据库明文存储** - Cookie 明文存储到 MySQL 数据库，支持 Docker 多容器共享
4. **Docker 无头模式** - Headless Chromium + 二维码图片方式支持无界面环境
5. **手工维护 Cookie** - 保留前端页面手工配置 Cookie 的功能

**修改功能**:
- 现有小红书搜索服务从数据库动态读取 Cookie
- 连接测试逻辑集成到 Cookie 管理系统
- 定时调度器统一管理（评论、素材整理、Cookie 刷新）

## 功能 (Capabilities)

### 新增功能
- `cookie-scanner`: 扫码登录模块，生成二维码图片，监听登录状态（支持两次扫码），保存 Cookie 到数据库
- `cookie-scheduler`: 定时调度器，支持 Cron 表达式配置，与评论/素材整理任务统一调度
- `cookie-storage`: Cookie 数据库存储模块，明文存储，版本管理，历史记录
- `docker-deployment`: Docker 部署配置，包括 Dockerfile、docker-compose.yml、卷挂载配置
- `manual-cookie-config`: 前端手工配置 Cookie 功能，保留现有页面交互

### 修改功能
- `xiaohongshu-search`: 从数据库动态读取 Cookie，支持自动刷新后无缝切换
- `task-scheduler`: 扩展现有定时调度器，增加 Cookie 刷新任务

## 影响

**代码影响**:
- 新增：`src/services/cookie-manager/` 目录
- 新增：`scripts/refresh-xiaohongshu-cookie.ts` 刷新脚本
- 修改：`src/services/internet-search/xiaohongshu-search.ts` - Cookie 读取逻辑
- 修改：`src/storage/mysql/network-post-config-storage.ts` - 数据库表结构

**数据库影响**:
- `network_post_config` 表字段：`xiaohongshu_cookie` (明文), `cookie_version`, `last_refresh_time`, `next_refresh_time`
- 新增：`task_schedules` 表统一管理定时任务（评论、素材整理、Cookie 刷新）
- 可能新增：`cookie_refresh_logs` 表记录刷新历史

**部署影响**:
- Docker 需要挂载浏览器数据卷：`./browser_data:/tmp/xiaohongshu_browser_data`
- Docker 需要挂载二维码目录：`./qr_codes:/tmp/qr_codes`
- 需要安装中文字体包
- 首次部署需要人工扫码一次

**API 影响**:
- 新增：`POST /api/cookie/refresh` - 手动触发刷新
- 新增：`GET /api-cookie/status` - 查看 Cookie 状态
- 新增：`GET /api/cookie/qr-code` - 获取登录二维码
