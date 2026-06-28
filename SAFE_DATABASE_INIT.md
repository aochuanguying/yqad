# 数据库安全初始化指南

## 概述

为了在生产环境初始化数据库时**不影响已有数据**，我们创建了安全初始化脚本。

## 特性

✅ **只创建缺失的表** - 使用 `CREATE TABLE IF NOT EXISTS`
✅ **只插入缺失的数据** - 先检查记录是否存在
✅ **不覆盖已有数据** - 保留所有现有配置和用户数据
✅ **幂等操作** - 可以多次执行，不会造成重复或冲突

## 使用方法

### 方法 1: 使用 npm 脚本（推荐）

```bash
# 在项目根目录执行
npm run safe-init-db
```

### 方法 2: 使用 Shell 脚本

```bash
# 在项目根目录执行
./scripts/safe-init.sh
```

### 方法 3: 在 Docker 容器中执行

```bash
# 进入容器
docker exec -it yqad sh

# 执行安全初始化
npm run safe-init-db

# 退出容器
exit
```

### 方法 4: 群晖部署专用脚本

```bash
cd deploy/synology
./safe-init-db.sh
```

## 初始化内容

### 1. 数据库迁移
执行 `src/db/migrations/` 目录下的所有迁移文件，确保表结构完整。

### 2. 配置数据初始化

#### 车辆监控配置
- 生成随机 Token
- 默认状态：禁用
- 只在 `vehicle_monitor_config` 表为空时创建

#### 评论配置
- 每日限制：3 条
- 延迟范围：60-180 秒
- 默认状态：禁用
- 只在 `comment_config` 表为空时创建

#### 发帖配置
- 每日限制：1 条
- 延迟范围：0-300 秒
- 默认状态：禁用
- 只在 `post_config` 表为空时创建

#### 调度器配置
- 自动评论：启用
- 自动发帖：启用
- 只创建缺失的配置项

### 3. 默认管理员账户

- 用户名：`admin`
- 密码：`admin123`
- 角色：`admin`
- 邮箱：`admin@example.com`
- **只在 `members` 表中不存在 admin 用户时创建**
- **不会重置已有用户的密码**

## 安全检查

脚本会检查以下内容：

1. **表是否存在** - 使用 `SHOW TABLES` 或 `information_schema`
2. **配置记录是否存在** - 使用 `SELECT` 查询
3. **用户是否存在** - 检查用户名是否重复

## 日志输出示例

```
========================================
开始安全初始化生产环境数据库...
========================================

✅ MySQL 连接成功

📝 步骤 1: 执行数据库迁移...
   发现 32 个迁移文件
   ✅ 001_create_schema_migrations_table.sql
   ✅ 002_create_members_table.sql
   ...
✅ 数据库迁移完成

📝 步骤 2: 初始化车辆监控配置...
   ⏭️  车辆监控配置已存在，跳过初始化
      Token: token_xxxxx

📝 步骤 3: 初始化评论配置...
   ✅ 评论配置已创建
      状态：已禁用
      每日限制：3 条

📝 步骤 4: 初始化发帖配置...
   ⏭️  发帖配置已存在，跳过初始化

📝 步骤 5: 初始化调度器配置...
   ⏭️  自动评论配置已存在，跳过
   ⏭️  自动发帖配置已存在，跳过

📝 步骤 6: 初始化默认用户...
   ⏭️  管理员账户已存在：admin
      邮箱：admin@example.com
      角色：admin
      提示：不会重置密码，如需重置请使用 Web 界面

📝 步骤 7: 初始化 AI Provider 配置...
   ℹ️  AI Provider 表已创建，但未添加默认 Provider
      请在 Web 界面"AI Provider 管理"页面添加配置

========================================
✅ 数据库安全初始化完成！
========================================
```

## 与 `init-db` 的区别

| 特性 | `npm run init-db` | `npm run safe-init-db` |
|------|-------------------|------------------------|
| 表创建 | ✅ | ✅ |
| 数据插入 | 总是��入 | 只插入缺失数据 |
| 用户密码 | 总是重置 | 不重置 |
| 幂等性 | ❌ | ✅ |
| 适用场景 | 全新部署 | 生产环境/已有数据 |

## 注意事项

### ⚠️ 生产环境使用

1. **首次部署**: 可以使用 `init-db` 或 `safe-init-db`
2. **已有数据的库**: **必须使用** `safe-init-db`
3. **密码修改**: 默认密码应在首次登录后立即修改

### 🔒 安全建议

1. 修改默认管理员密码
2. 定期备份数据库
3. 不要在版本控制系统中提交 `.env` 文件
4. 使用强密码

### 📊 备份数据库

在执行任何初始化操作之前，建议先备份：

```bash
# MySQL 备份
mysqldump -u root -p yqad_prod_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 或者在 Docker 中
docker exec mysql mysqldump -u root -pyour_password yqad_prod_db > backup.sql
```

## 故障排查

### 问题 1: 连接失败

```
❌ 初始化失败：MySQL 连接失败
```

**解决方法**:
- 检查 `.env` 文件中的数据库配置
- 确认 MySQL 服务正在运行
- 检查防火墙设置

### 问题 2: 权限不足

```
❌ 初始化失败：Access denied for user
```

**解决方法**:
- 确认数据库用户有足够的权限（CREATE, INSERT, UPDATE）
- 使用 root 用户或授予权限

### 问题 3: 表已存在

```
⚠️  xxx_table 执行警告：Table 'xxx' already exists
```

**这是正常的** - 安全初始化会跳过已存在的表。

## 回滚方案

如果初始化过程中出现问题：

1. **从备份恢复**:
```bash
mysql -u root -p yqad_prod_db < backup_20260628.sql
```

2. **手动删除初始化的数据**（谨慎操作）:
```sql
-- 删除配置数据（如果不需要）
DELETE FROM vehicle_monitor_config WHERE id = 1;
DELETE FROM comment_config;
DELETE FROM post_config;
DELETE FROM scheduler_config WHERE key_name IN ('auto_comment_enabled', 'auto_post_enabled');

-- 删除默认用户（如果不需要）
DELETE FROM members WHERE username = 'admin';
```

## 后续步骤

初始化完成后：

1. ✅ 访问 Web 管理界面
2. ✅ 使用默认账户登录
3. ✅ 立即修改密码
4. ✅ 配置 AI Provider
5. ✅ 配置车辆监控 Token
6. ✅ 配置评论和发帖参数
7. ✅ 启用需要的功能

## 联系支持

如有问题，请查看日志文件或联系技术支持。
