# 群晖 Docker 部署指南

## 📋 环境要求

- **群晖型号**: DS218+ 或更高配置
- **Docker**: 已安装 Docker 套件
- **内存**: 建议 2GB 以上可用内存
- **存储**: 至少 1GB 可用空间

## 🎯 方案调整说明

### 本地环境 vs Docker 环境

| 特性 | 本地环境 | Docker 环境 |
|------|---------|-----------|
| 浏览器模式 | 有界面 | **headless 无界面** |
| 扫码方式 | 直接扫码 | **二维码图片** |
| 用户数据 | 本地目录 | **挂载卷** |
| 中文字体 | 系统自带 | **需要安装** |
| 资源限制 | 无限制 | **CPU/内存限制** |
| 定时任务 | cron | **容器内 cron** |

## 🚀 快速部署

### 方式一：Docker Compose (推荐)

#### 1. 上传文件到群晖

```bash
# 通过 SSH 或文件管理器上传以下文件到群晖：
/volume1/docker/xiaohongshu/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── scripts/
    ├── auto_refresh_xiaohongshu_cookie_docker.py
    ├── test_audi_export.py
    └── 其他脚本...
```

#### 2. 构建并启动容器

SSH 登录群晖，执行:

```bash
cd /volume1/docker/xiaohongshu/docker

# 创建必要的目录
mkdir -p browser_data qr_codes logs

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

#### 3. 首次登录

```bash
# 查看日志，等待生成二维码
docker-compose logs -f

# 日志会显示：
# 📱 登录二维码已保存到：/tmp/xiaohongshu_login_qr.png
```

在群晖文件管理器中打开:
```
/volume1/docker/xiaohongshu/qr_codes/xiaohongshu_login_qr.png
```

用手机小红书 APP 扫码登录。

#### 4. 验证登录

```bash
# 查看日志确认登录成功
docker-compose logs

# 应该看到：
# ✅ Cookie 已成功保存到数据库
```

### 方式二：群晖 Container Manager 图形界面

#### 1. 创建项目

1. 打开 **Container Manager**
2. 选择 **项目** → **新增**
3. 项目名称：`xiaohongshu-cookie`
4. 路径：`/volume1/docker/xiaohongshu/docker`
5. 勾选 **完成后启动**
6. 点击 **新增**

#### 2. 配置存储卷

在群晖文件管理器中创建目录:
```
/volume1/docker/xiaohongshu/browser_data
/volume1/docker/xiaohongshu/qr_codes
/volume1/docker/xiaohongshu/logs
```

#### 3. 首次登录

```bash
# 查看日志
docker logs -f xiaohongshu-cookie-refresh

# 找到二维码图片路径，在文件管理器中打开并扫码
```

## 📁 目录结构

```
/volume1/docker/xiaohongshu/
├── docker/
│   ├── Dockerfile              # Docker 镜像配置
│   └── docker-compose.yml      # Docker Compose 配置
├── scripts/
│   ├── auto_refresh_xiaohongshu_cookie_docker.py  # Docker 版本刷新脚本
│   ├── test_audi_export.py     # 测试脚本
│   └── ...                     # 其他脚本
├── browser_data/               # 浏览器用户数据 (自动创建)
├── qr_codes/                   # 登录二维码图片
├── logs/                       # 日志文件
└── output/                     # 导出文件 (可选)
```

## 🔧 配置说明

### 环境变量

在 `docker-compose.yml` 中修改:

```yaml
environment:
  - DB_HOST=192.168.50.50        # 数据库地址
  - DB_PORT=3306                 # 数据库端口
  - DB_USER=root                 # 数据库用户
  - DB_PASSWORD=你的密码          # 数据库密码
  - DB_NAME=yqad_prod_db         # 数据库名称
  - TZ=Asia/Shanghai             # 时区
```

### 资源限制

根据群晖配置调整:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'      # 最大 1 核心
      memory: 512M     # 最大 512MB 内存
    reservations:
      cpus: '0.5'      # 预留 0.5 核心
      memory: 256M     # 预留 256MB 内存
```

**DS218+ 推荐配置:**
- CPU: 1-2 核心
- 内存：256-512MB

### 定时任务

默认每天凌晨 2 点运行:

```yaml
command: >
  sh -c "
  echo '0 2 * * * python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py >> /var/log/xiaohongshu/cookie_refresh.log 2>&1' | crontab -
  && crond -f -l 2
  "
```

**修改刷新频率:**

```bash
# 每 12 小时
0 */12 * * * ...

# 每天早上 8 点
0 8 * * * ...

# 每 3 天
0 2 */3 * * ...
```

## 🔍 操作指南

### 查看日志

```bash
# 实时日志
docker-compose logs -f

# 最近 100 行
docker-compose logs --tail=100

# 查看特定时间
docker-compose logs --since="2026-06-29 10:00:00"
```

### 手动刷新 Cookie

```bash
# 进入容器
docker-compose exec xiaohongshu-cookie-refresh bash

# 手动运行刷新脚本
python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py
```

### 测试 Cookie 可用性

```bash
# 停止定时任务容器
docker-compose down

# 运行测试容器
docker-compose --profile test run xiaohongshu-test

# 查看输出
docker logs xiaohongshu-test
```

### 重启容器

```bash
# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose down
docker-compose build
docker-compose up -d
```

### 停止服务

```bash
# 停止服务
docker-compose stop

# 停止并删除容器
docker-compose down

# 删除所有 (包括数据卷)
docker-compose down -v
```

## 🐛 常见问题

### Q1: 容器启动失败

**错误信息:**
```
exec /usr/bin/python3: exec format error
```

**解决:**
```bash
# 检查架构是否匹配
docker info | grep Architecture

# 重新构建镜像
docker-compose build --no-cache
```

### Q2: 二维码不显示

**解决:**
```bash
# 检查日志
docker-compose logs

# 手动进入容器查看
docker-compose exec xiaohongshu-cookie-refresh bash
ls -lh /tmp/qr_codes/

# 检查目录权限
chmod 755 /volume1/docker/xiaohongshu/qr_codes
```

### Q3: Cookie 仍然过期快

**解决:**
1. 增加刷新频率 (每 12 小时)
2. 检查 `browser_data` 目录是否持久化
3. 验证登录状态是否保持

```bash
# 检查浏览器数据
ls -lh /volume1/docker/xiaohongshu/browser_data/

# 应该有数据文件，不是空目录
```

### Q4: 内存不足

**解决:**
```bash
# 降低内存限制
# 编辑 docker-compose.yml
deploy:
  resources:
    limits:
      memory: 256M  # 降低到 256MB
```

### Q5: 数据库连接失败

**解决:**
```bash
# 测试数据库连接
docker-compose exec xiaohongshu-cookie-refresh bash
python3 -c "import mysql.connector; mysql.connector.connect(host='192.168.50.50', user='root', password='Wfw7539148@', database='yqad_prod_db')"

# 检查网络
ping 192.168.50.50
```

### Q6: 群晖重启后服务未自动启动

**解决:**
```bash
# 检查重启策略
docker inspect xiaohongshu-cookie-refresh | grep RestartPolicy

# 应该是 "RestartPolicy": {"Name": "unless-stopped"}

# 手动启动
docker-compose up -d
```

## 📊 监控和维护

### 查看资源使用

```bash
# 查看容器资源
docker stats xiaohongshu-cookie-refresh

# 查看磁盘使用
du -sh /volume1/docker/xiaohongshu/*
```

### 清理旧日志

```bash
# 定期清理日志
find /volume1/docker/xiaohongshu/logs -name "*.log" -mtime +30 -delete
```

### 备份浏览器数据

```bash
# 备份到群晖其他目录
cp -r /volume1/docker/xiaohongshu/browser_data /volume1/backup/xiaohongshu_browser_data_$(date +%Y%m%d)
```

### 更新镜像

```bash
# 拉取最新代码
cd /volume1/docker/xiaohongshu

# 重新构建
docker-compose build

# 重启服务
docker-compose down
docker-compose up -d
```

## 🎯 最佳实践

1. **定期检查日志**: 每天查看一次日志，确保刷新成功
2. **监控磁盘空间**: 确保 `browser_data` 和 `logs` 不会占满磁盘
3. **备份重要数据**: 定期备份 `browser_data` 目录
4. **测试验证**: 每周运行一次测试脚本，验证 Cookie 可用性
5. **资源监控**: 在群晖 Resource Monitor 中监控容器资源使用

## 📝 注意事项

- ⚠️ **首次运行必须扫码**: 生成二维码后需要在 5 分钟内扫码
- ⚠️ **不要删除 browser_data**: 否则需要重新扫码
- ⚠️ **确保网络通畅**: 容器需要访问小红书和数据库
- ⚠️ **定期检查**: 建议每天查看日志确认运行正常
- ⚠️ **资源限制**: DS218+ 资源有限，不要设置过高的内存限制

## 🆘 获取帮助

```bash
# 查看容器状态
docker-compose ps

# 查看详细信息
docker inspect xiaohongshu-cookie-refresh

# 进入容器调试
docker-compose exec xiaohongshu-cookie-refresh bash

# 查看完整日志
docker-compose logs --tail=500
```

## 📚 相关文档

- [小红书 Cookie 自动刷新方案.md](小红书 Cookie 自动刷新方案.md)
- [小红书 API 技术文档.md](小红书 API 技术文档.md)

---

**最后更新:** 2026-06-29  
**适用版本:** Docker (群晖 DS218+)  
**状态:** ✅ 已验证
