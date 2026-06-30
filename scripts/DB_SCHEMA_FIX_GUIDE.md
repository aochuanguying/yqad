# 数据库表结构检查和修复指南

## 问题背景

在素材整理和 Cookie 刷新功能开发过程中，发现 `material_records` 和 `scheduler_config` 表缺少多个必要字段。

## 已修复的字段

### 1. scheduler_config 表
- ✅ `cookie_refresh_enabled` - 是否启用 Cookie 自动刷新
- ✅ `cookie_refresh_cron` - Cookie 刷新定时表达式
- ✅ `cookie_refresh_auto_enabled` - 是否启用到期自动刷新

### 2. material_records 表
- ✅ `source` - 素材来源 (local/internet)
- ✅ `path` - 文件路径
- ✅ `url` - 网络 URL
- ✅ `quality_score` - 质量评分 (JSON)
- ✅ `matched_keywords` - 匹配关键词 (JSON)
- ✅ `associated_posts` - 关联帖子 (JSON)
- ✅ `usage_count` - 使用次数
- ✅ `last_used_date` - 最后使用日期

### 3. network_post_config 表
- ✅ `cookie_version` - Cookie 版本号
- ✅ `last_refresh_time` - 最后刷新时间
- ✅ `next_refresh_time` - 下次刷新时间
- ✅ `cookie_refresh_logs` - Cookie 刷新日志 (JSON)

## 自动检查脚本

使用自动检查脚本可以快速验证并修复数据库结构：

```bash
# 检查并修复当前环境
npx tsx scripts/check-and-fix-db-schema.ts
```

## 生产环境修复步骤

### 方法一：使用自动检查脚本（推荐）

```bash
# 1. 连接到生产数据库
export MYSQL_HOST=<生产数据库 IP>
export MYSQL_DATABASE=yqad_prod_db

# 2. 运行检查脚本
npx tsx scripts/check-and-fix-db-schema.ts
```

### 方法二：手动执行 SQL

如果无法运行 Node.js 脚本，可以直接执行 SQL：

```sql
-- scheduler_config 表
ALTER TABLE scheduler_config 
ADD COLUMN IF NOT EXISTS cookie_refresh_enabled TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cookie_refresh_cron VARCHAR(50) DEFAULT '0 2 * * *',
ADD COLUMN IF NOT EXISTS cookie_refresh_auto_enabled TINYINT(1) DEFAULT 1;

-- material_records 表
ALTER TABLE material_records 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'local',
ADD COLUMN IF NOT EXISTS path VARCHAR(500) NOT NULL,
ADD COLUMN IF NOT EXISTS url VARCHAR(500) NULL,
ADD COLUMN IF NOT EXISTS quality_score JSON NULL,
ADD COLUMN IF NOT EXISTS matched_keywords JSON NULL,
ADD COLUMN IF NOT EXISTS associated_posts JSON NULL,
ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_used_date DATETIME NULL;

-- network_post_config 表
ALTER TABLE network_post_config 
ADD COLUMN IF NOT EXISTS cookie_version INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_refresh_time DATETIME NULL,
ADD COLUMN IF NOT EXISTS next_refresh_time DATETIME NULL,
ADD COLUMN IF NOT EXISTS cookie_refresh_logs JSON NULL;
```

注意：MySQL 5.7+ 支持 `ADD COLUMN IF NOT EXISTS`，如果使用旧版本，需要先检查字段是否存在。

### 方法三：使用迁移 SQL 文件

```bash
# 1. scheduler_config 表迁移
mysql -h <host> -u <user> -p <database> < database/migrations/add-cookie-refresh-scheduler.sql

# 2. material_records 表迁移
mysql -h <host> -u <user> -p <database> < database/migrations/add-usage-count-to-materials.sql
```

## 验证修复结果

执行以下 SQL 验证字段是否已添加：

```sql
-- 检查 scheduler_config 表
SHOW COLUMNS FROM scheduler_config LIKE 'cookie_refresh%';

-- 检查 material_records 表
SHOW COLUMNS FROM material_records LIKE 'source';
SHOW COLUMNS FROM material_records LIKE 'path';
SHOW COLUMNS FROM material_records LIKE 'quality_score';

-- 检查 network_post_config ���
SHOW COLUMNS FROM network_post_config LIKE 'cookie_version';
```

## 常见问题

### Q: 字段已存在错误
A: 这是正常的，说明字段已经添加成功。可以忽略该错误。

### Q: 表不存在错误
A: 如果表不存在，说明数据库初始化未完成。请先运行初始化脚本：
```bash
npm run init-db
```

### Q: 权限不足错误
A: 确保数据库用户有 ALTER TABLE 权限：
```sql
GRANT ALTER ON database.* TO 'user'@'%';
FLUSH PRIVILEGES;
```

## 回滚方案

如果需要回滚（不推荐）：

```sql
-- 删除 scheduler_config 表新增字段
ALTER TABLE scheduler_config 
DROP COLUMN cookie_refresh_enabled,
DROP COLUMN cookie_refresh_cron,
DROP COLUMN cookie_refresh_auto_enabled;

-- 删除 material_records 表新增字段
ALTER TABLE material_records 
DROP COLUMN source,
DROP COLUMN path,
DROP COLUMN url,
DROP COLUMN quality_score,
DROP COLUMN matched_keywords,
DROP COLUMN associated_posts,
DROP COLUMN usage_count,
DROP COLUMN last_used_date;

-- 删除 network_post_config 表新增字段
ALTER TABLE network_post_config 
DROP COLUMN cookie_version,
DROP COLUMN last_refresh_time,
DROP COLUMN next_refresh_time,
DROP COLUMN cookie_refresh_logs;
```

## 相关文档

- [Cookie 定时刷新配置](./COOKIE_REFRESH_README.md)
- [素材整理功能文档](../docs/MATERIAL_PROCESSING.md)
