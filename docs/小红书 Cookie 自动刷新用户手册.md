# 小红书 Cookie 自动刷新用户手册

**最后更新**: 2026-06-29  
**版本**: v1.0

---

## 📖 目录

- [功能介绍](#功能介绍)
- [首次部署](#首次部署)
- [扫码登录（两次扫码）](#扫码登录两次扫码)
- [手工配置 Cookie](#手工配置-cookie)
- [查看状态](#查看状态)
- [手动刷新](#手动刷新)
- [定时刷新](#定时刷新)
- [常见问题](#常见问题)

---

## 功能介绍

### 核心功能

1. **自动扫码登录** - 生成二维码图片，用户扫码后自动获取 Cookie
2. **定期自动刷新** - 每 24 小时自动刷新 Cookie（可配置）
3. **手工配置 Cookie** - 支持手动输入 Cookie
4. **统一调度管理** - 与评论、素材整理任务统一调度

### 技术特点

- ✅ 支持小红书两次扫码登录流程
- ✅ Cookie 明文存储到数据库
- ✅ Docker 无头环境部署
- ✅ 失败自动重试
- ✅ 详细的刷新历史记录

---

## 首次部署

### 步骤 1: 执行数据库迁移

```bash
# 连接到 MySQL 数据库
mysql -h 192.168.50.50 -u root -p yqad_prod_db

# 执行迁移脚本
source /Users/mac/Documents/workspace/krio/yqad/database/migrations/cookie-schema.sql
```

### 步骤 2: 部署 Docker 容器

```bash
# 进入部署目录
cd /volume1/docker/xiaohongshu

# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 步骤 3: 首次扫码登录

容器启动后，需要执行一次扫码登录：

```bash
# 方法 1: 使用命令行工具
docker exec -it xiaohongshu-cookie-manager npm run cookie:refresh -- --manual

# 方法 2: 调用 API 触发自动刷新
curl -X POST http://localhost:3000/api/cookie/refresh
```

---

## 扫码登录（两次扫码）

### 为什么需要扫两次？

小红书网页版出于安全考虑，需要扫描两次二维码：

1. **第一次扫码**: 验证账号身份
2. **第二次扫码**: 确认登录授权

### 自动扫码流程

1. 触发刷新（手动或自动）
2. 系统生成第一个二维码（`qr_first_*.png`）
3. 用户用手机小红书扫描第一个二维码
4. 系统检测到第一次扫码成功
5. 系统生成第二个二维码（`qr_second_*.png`）
6. 用户扫描第二个二维码确认登录
7. 系统提取 Cookie 并保存到数据库
8. 清理二维码图片

### 二维码位置

```
/volume1/docker/xiaohongshu/qr_codes/
├── qr_first_20260629_120000.png
└── qr_second_20260629_120030.png
```

**查看方法**:
- 在群晖文件管理器中打开上述目录
- 用手机扫码
- 或在 API 中访问：`GET /api/cookie/qr-code/:filename`

---

## 手工配置 Cookie

如果自动扫码失败，可以手工配置 Cookie：

### 方法 1: 前端页面配置

1. 访问网络配置页面
2. 找到"小红书 Cookie 配置"部分
3. 在输入框中粘贴 Cookie 字符串
4. 点击"保存"按钮
5. 点击"测试连接"验证有效性

### 方法 2: API 配置

```bash
curl -X POST http://localhost:3000/api/cookie/manual \
  -H "Content-Type: application/json" \
  -d '{
    "cookie": "a1=xxx; web_session=xxx; id_token=xxx; ..."
  }'
```

### 如何获取 Cookie？

1. 打开浏览器开发者工具（F12）
2. 访问 https://www.xiaohongshu.com
3. 登录账号
4. 在 Network 标签中找到任意请求
5. 复制 Request Headers 中的 Cookie 字段

---

## 查看状态

### 命令行查看

```bash
docker exec -it xiaohongshu-cookie-manager npm run cookie:status
```

### API 查看

```bash
curl http://localhost:3000/api/cookie/status
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "hasCookie": true,
    "version": 5,
    "lastRefreshTime": "2026-06-29T02:00:00.000Z",
    "nextRefreshTime": "2026-06-30T02:00:00.000Z",
    "refreshHistory": [
      {
        "refresh_time": "2026-06-29T02:00:05.123Z",
        "duration_ms": 15234,
        "status": "success",
        "source": "auto"
      }
    ]
  }
}
```

---

## 手动刷新

### 命令行刷新

```bash
# 自动刷新（默认）
docker exec -it xiaohongshu-cookie-manager npm run cookie:refresh

# 强制刷新（忽略时间）
docker exec -it xiaohongshu-cookie-manager npm run cookie:refresh -- --force

# 手动扫码模式
docker exec -it xiaohongshu-cookie-manager npm run cookie:refresh -- --manual
```

### API 刷新

```bash
curl -X POST http://localhost:3000/api/cookie/refresh
```

---

## 定时刷新

### 默认配置

- **刷新时间**: 每天凌晨 2:00
- **刷新频率**: 每 24 小时一次
- **Cron 表达式**: `0 2 * * *`

### 修改刷新时间

1. 登录数据库
2. 修改 `task_schedules` 表：

```sql
UPDATE task_schedules 
SET cron_expression = '0 3 * * *'  -- 改为凌晨 3 点
WHERE task_type = 'cookie-refresh';
```

3. 重启容器使配置生效：

```bash
docker-compose restart
```

---

## 常见问题

### Q1: 扫码超时怎么办？

**A**: 二维码有效期为 5 分钟，超时后需要重新触发刷新：

```bash
docker exec -it xiaohongshu-cookie-manager npm run cookie:refresh -- --force
```

### Q2: Cookie 多久过期？

**A**: 通常 1-3 天，系统会每 24 小时自动刷新，保持登录态活跃。

### Q3: 自动刷新失败怎么办？

**A**: 有三种方式：
1. 查看日志定位问题：`docker-compose logs`
2. 手动扫码刷新
3. 手工配置 Cookie

### Q4: 如何查看刷新历史？

**A**: 通过 API 查看：

```bash
curl http://localhost:3000/api/cookie/status
```

响应中的 `refreshHistory` 字段包含最近 30 次刷新记录。

### Q5: 数据库中没有 Cookie 字段？

**A**: 需要执行数据库迁移脚本：

```sql
source /Users/mac/Documents/workspace/krio/yqad/database/migrations/cookie-schema.sql
```

### Q6: Docker 容器启动失败？

**A**: 检查以下几点：
1. 日志：`docker-compose logs`
2. 端口占用：确保 3000 端口未被占用
3. 数据库连接：检查数据库配置
4. 挂载目录权限：`chmod 755 ./browser_data ./qr_codes ./logs`

### Q7: 如何备份 Cookie？

**A**: Cookie 存储在数据库中，备份数据库即可：

```bash
mysqldump -h 192.168.50.50 -u root -p yqad_prod_db > backup.sql
```

---

## 技术支持

如有问题，请联系运维团队或查看系统日志。

**日志位置**:
- Docker 日志：`docker-compose logs`
- 应用日志：`/volume1/docker/xiaohongshu/logs/`
- 刷新日志：数据库 `cookie_refresh_logs` 表

---

**文档版本**: v1.0  
**维护者**: YQAD Team
