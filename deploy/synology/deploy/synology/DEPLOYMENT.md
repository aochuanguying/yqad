# 一汽奥迪 APP 自动任务系统 - 生产环境部署指南

## 📋 目录

1. [系统要求](#系统要求)
2. [环境准备](#环境准备)
3. [数据库初始化](#数据库初始化)
4. [Redis 初始化](#redis-初始化)
5. [ChromaDB 初始化](#chromadb-初始化)
6. [应用部署](#应用部署)
7. [配置说明](#配置说明)
8. [启动服务](#启动服务)
9. [验证部署](#验证部署)
10. [常见问题](#常见问题)

---

## 系统要求

### 硬件要求
- **CPU**: 2 核心以上
- **内存**: 4GB 以上
- **磁盘**: 20GB 以上可用空间

### 软件要求
- **Node.js**: v18.x 或更高版本
- **MySQL**: 8.0 或更高版本
- **Redis**: 6.0 或更高版本
- **ChromaDB**: 0.4 或更高版本（可选，用于向量搜索）
- **操作系统**: Linux (推荐 Ubuntu 20.04+) / macOS

---

## 环境准备

### 1. 安装 Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# macOS (使用 Homebrew)
brew install node@18
```

### 2. 安装 MySQL

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y mysql-server

# CentOS/RHEL
sudo yum install -y mysql-server

# macOS (使用 Homebrew)
brew install mysql
```

### 3. 安装 Redis

```bash
# Ubuntu/Debian
sudo apt-get install -y redis-server

# CentOS/RHEL
sudo yum install -y redis

# macOS (使用 Homebrew)
brew install redis
```

### 4. 安装 ChromaDB（可选）

**方式一：使用 Docker（推荐）**

```bash
# 拉取 ChromaDB 镜像
docker pull chromadb/chroma:latest

# 启动 ChromaDB 容器
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v chromadb_data:/chroma/chroma \
  --restart always \
  chromadb/chroma:latest
```

**方式二：使用 pip 安装**

```bash
# 安装 ChromaDB
pip install chromadb

# 启动 ChromaDB 服务
chroma run --path ./chroma_data --port 8000
```

---

## 数据库初始化

### 1. 创建数据库

```bash
# 登录 MySQL
mysql -u root -p
```

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS `yqad_db` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 创建数据库用户（可选，建议生产环境使用独立用户）
CREATE USER 'yqad_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON yqad_db.* TO 'yqad_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 执行表结构脚本

```bash
# 方式一：使用命令行
mysql -u root -p yqad_db < scripts/prod-create-tables.sql

# 方式二：在 MySQL 客户端中
USE yqad_db;
SOURCE scripts/prod-create-tables.sql;
```

### 3. 初始化基础数据

```bash
# 设置管理员密码（强烈建议修改默认密码）
export ADMIN_PASSWORD='your_secure_admin_password'

# 执行初始化脚本
node scripts/prod-init-data.js
```

---

## Redis 初始化

### 1. 配置 Redis

```bash
# 编辑 Redis 配置文件
sudo vim /etc/redis/redis.conf

# 确保以下配置项正确
bind 127.0.0.1
protected-mode yes
port 6379
```

### 2. 启动 Redis

```bash
# 启动 Redis 服务
sudo systemctl start redis
sudo systemctl enable redis

# 验证 Redis 运行状态
sudo systemctl status redis
```

### 3. 初始化 Redis 数据

```bash
# 设置 Redis 密码（如果启用了密码）
export REDIS_PASSWORD='your_redis_password'

# 执行初始化脚本
node scripts/prod-init-redis.js
```

---

## ChromaDB 初始化

### 1. 验证 ChromaDB 服务

```bash
# 检查 ChromaDB 是否运行
curl http://localhost:8000/api/v1/heartbeat

# 应返回类似：{"nanosecond heartbeat": 123456789}
```

### 2. 安装 ChromaDB Node.js 客户端

```bash
# 安装 chromadb 包
npm install chromadb
```

### 3. 配置 ChromaDB 环境变量

```bash
# 编辑 .env 文件
vim .env

# 添加以下配置
CHROMADB_HOST=localhost
CHROMADB_PORT=8000
# 或者使用完整 URL
# CHROMADB_URL=http://localhost:8000
```

### 4. 初始化 ChromaDB Collections

```bash
# 执行初始化脚本（创建 Collections）
node scripts/prod-init-chromadb.js
```

**输出示例：**
```
🚀 开始初始化 ChromaDB...
📡 ChromaDB 地址：http://localhost:8000

✅ ChromaDB 连接成功
   现有 Collection 数量：0

📦 开始创建 Collections...

✅ Collection "materials" 创建成功
   描述：Material embeddings for similarity search and recommendation
   距离函数：cosine

✅ Collection "content_dedup" 创建成功
   描述：Post content embeddings for duplication detection
   距离函数：cosine

✅ Collection "topic_recommend" 创建成功
   描述：Topic embeddings for recommendation system
   距离函数：cosine

🎉 ChromaDB 初始化完成！
```

### 5. 迁移现有数据到 ChromaDB（可选）

```bash
# 如果已有 MySQL 数据，执行迁移脚本
npx ts-node scripts/migrate-chromadb-collections.ts
```

**注意事项：**
- 此脚本会读取 MySQL 中的素材和历史发帖数据
- 生成向量并存储到 ChromaDB
- 首次运行可能需要几分钟（取决于数据量）

---

## 应用部署

### 1. 克隆代码

```bash
# 克隆项目代码
git clone <repository-url>
cd yqad
```

### 2. 安装依赖

```bash
# 安装生产环境依赖
npm install --production
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

---

## 配置说明

### 环境变量配置 (.env)

```bash
# ==================== 数据库配置 ====================
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=yqad_user
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=yqad_db

# ==================== Redis 配置 ====================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # 如果没有密码则留空
REDIS_DB=0
REDIS_PREFIX=prod:

# ==================== AI 配置 ====================
# AI Provider 配置（根据实际情况填写）
AI_PROVIDER_1_NAME=...
AI_PROVIDER_1_API_KEY=...
AI_PROVIDER_1_BASE_URL=...

# ==================== 认证配置 ====================
# Session 密钥（建议使用 openssl 生成）
SESSION_SECRET=your_session_secret_key

# API Token（可选，也可以通过 Redis 初始化脚本生成）
API_TOKEN=your_api_token

# ==================== 车辆监控配置（可选） ====================
VEHICLE_MONITOR_ENABLED=false
VEHICLE_MONITOR_TOKEN=your_vehicle_token

# ==================== 服务器配置 ====================
PORT=3000
NODE_ENV=production
```

### 配置文件 (config/default.yaml)

```yaml
# 编辑配置文件，根据生产环境调整参数
vim config/default.yaml
```

**关键配置项：**
- `api.baseUrl`: 生产环境 API 地址
- `scheduler.timezone`: 时区设置（Asia/Shanghai）
- `logging.level`: 日志级别（production 建议 info 或 warn）
- `materials.processedPath`: 素材存储路径

---

## 启动服务

### 1. 使用 PM2 管理进程（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'yqad-app',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '500M',
    watch: false
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

### 2. 直接启动（开发环境）

```bash
# 编译 TypeScript
npm run build

# 启动服务
npm start
```

---

## 验证部署

### 1. 检查服务状态

```bash
# 检查进程是否运行
pm2 status

# 查看日志
pm2 logs yqad-app
```

### 2. 访问 Web 界面

打开浏览器访问：`http://your-server-ip:3000`

### 3. 测试 API

```bash
# 测试健康检查接口
curl http://localhost:3000/api/health

# 测试登录接口
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_admin_password"}'
```

### 4. 验证数据库连接

```bash
# 登录 MySQL 验证表结构
mysql -u yqad_user -p yqad_db -e "SHOW TABLES;"
```

### 5. 验证 Redis 连接

```bash
# 连接 Redis 并验证数据
redis-cli -h localhost -p 6379
> KEYS prod:*
> GET prod:api:token
> SCARD prod:sensitive:words
```

### 6. 验证 ChromaDB 连接

```bash
# 测试 ChromaDB 连接
curl http://localhost:8000/api/v1/collections
# 应返回 Collections 列表
```

---

## 常见问题

### Q1: MySQL 连接失败

**症状**: 启动时报 MySQL 连接错误

**解决方案**:
```bash
# 检查 MySQL 服务状态
sudo systemctl status mysql

# 检查 MySQL 用户权限
mysql -u root -p -e "SELECT user, host FROM mysql.user;"

# 确保 bind-address 配置正确
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf
# bind-address = 127.0.0.1
```

### Q2: Redis 连接失败

**症状**: 启动时报 Redis 连接错误

**解决方案**:
```bash
# 检查 Redis 服务状态
sudo systemctl status redis

# 测试 Redis 连接
redis-cli ping

# 如果启用了密码，验证密码
redis-cli -a your_password ping
```

### Q3: 端口被占用

**症状**: 启动时报端口占用错误

**解决方案**:
```bash
# 查看端口占用
lsof -i:3000

# 杀死占用端口的进程
kill -9 <PID>

# 或者修改配置使用其他端口
PORT=3001 npm start
```

### Q4: 依赖安装失败

**症状**: npm install 时报错

**解决方案**:
```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install --production
```

### Q5: 管理员密码忘记

**解决方案**:
```bash
# 重新运行初始化脚本
export ADMIN_PASSWORD='new_password'
node scripts/prod-init-data.js
```

---

## 维护指南

### 日志管理

```bash
# 查看应用日志
tail -f logs/*.log

# 清理过期日志（保留最近 30 天）
find logs/ -name "*.log" -mtime +30 -delete
```

### 数据库备份

```bash
# 备份数据库
mysqldump -u yqad_user -p yqad_db > backup_$(date +%Y%m%d).sql

# 恢复数据库
mysql -u yqad_user -p yqad_db < backup_20240101.sql
```

### Redis 备份

```bash
# 手动触发 Redis 持久化
redis-cli BGSAVE

# 备份 RDB 文件
cp /var/lib/redis/dump.rdb /backup/redis-dump-$(date +%Y%m%d).rdb
```

---

## 安全建议

1. **修改默认密码**: 立即修改管理员默认密码
2. **启用防火墙**: 只开放必要的端口（3000, 3306, 6379）
3. **使用 HTTPS**: 生产环境建议配置 Nginx 反向代理 + SSL 证书
4. **定期备份**: 设置定时任务备份数据库和 Redis
5. **监控告警**: 配置系统监控和告警机制
6. **更新依赖**: 定期检查并更新 npm 依赖包

---

## 技术支持

如有问题，请联系技术支持团队或查看项目文档。

**文档版本**: v1.0  
**最后更新**: 2026-06-22
