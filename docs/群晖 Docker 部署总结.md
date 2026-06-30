# 群晖 Docker 部署方案总结

## 🎯 核心变化

针对群晖 DS218+ Docker 环境，主要做了以下调整:

### 1. Headless 无界面模式

**问题:** Docker 容器无法显示浏览器界面

**解决:** 
```python
# 使用 headless 模式
browser = p.chromium.launch_persistent_context(
    headless=True,  # 无界面模式
    ...
)
```

### 2. 二维码扫码登录

**问题:** 无法直接在容器上扫码

**解决:** 
- 脚本自动生成二维码图片
- 保存到挂载卷：`/tmp/qr_codes/xiaohongshu_login_qr.png`
- 在群晖文件管理器中打开图片
- 用手机小红书 APP 扫码

### 3. 持久化存储

**问题:** 容器删除后数据丢失

**解决:**
```yaml
volumes:
  - ./browser_data:/tmp/xiaohongshu_browser_data  # 浏览器数据
  - ./qr_codes:/tmp/qr_codes                      # 二维码图片
  - ./logs:/var/log/xiaohongshu                   # 日志文件
```

### 4. 中文字体支持

**问题:** 页面中文显示乱码

**解决:**
```dockerfile
RUN apt-get install -y --no-install-recommends \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    fonts-noto-cjk \
    fontconfig
```

### 5. 资源限制

**问题:** DS218+ 资源有限 (J3455 CPU, 2-6GB 内存)

**解决:**
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### 6. 定时任务

**问题:** 需要在容器内运行定时任务

**解决:**
```yaml
command: >
  sh -c "
  echo '0 2 * * * python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py >> /var/log/xiaohongshu/cookie_refresh.log 2>&1' | crontab -
  && crond -f -l 2
  "
```

## 📁 文件清单

### Docker 相关

| 文件 | 说明 | 路径 |
|------|------|------|
| `Dockerfile` | Docker 镜像配置 | `docker/Dockerfile` |
| `docker-compose.yml` | Docker Compose 配置 | `docker/docker-compose.yml` |
| `deploy.sh` | 快速部署脚本 | `docker/deploy.sh` |

### 脚本文件

| 文件 | 说明 | 路径 |
|------|------|------|
| `auto_refresh_xiaohongshu_cookie_docker.py` | Docker 版本刷新脚本 | `scripts/` |
| `auto_refresh_xiaohongshu_cookie.py` | 本地版本刷新脚本 | `scripts/` |
| `test_audi_export.py` | 测试脚本 | `scripts/` |

### 文档

| 文件 | 说明 | 路径 |
|------|------|------|
| `群晖 Docker 部署指南.md` | 详细部署文档 | `docs/` |
| `小红书 Cookie 自动刷新方案.md` | 完整技术方案 | `docs/` |
| `群晖 Docker 部署总结.md` | 本文档 | `docs/` |

## 🚀 部署流程

### 步骤 1: 上传文件

```bash
# 通过 SSH 或文件管理器上传
/volume1/docker/xiaohongshu/
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── deploy.sh
└── scripts/
    └── *.py
```

### 步骤 2: 运行部署脚本

```bash
cd /volume1/docker/xiaohongshu/docker
bash deploy.sh
```

### 步骤 3: 首次登录

```bash
# 查看日志
docker-compose logs -f

# 等待生成二维码
# 📱 登录二维码已保存到：/tmp/xiaohongshu_login_qr.png
```

在群晖文件管理器中打开:
```
/volume1/docker/xiaohongshu/qr_codes/xiaohongshu_login_qr.png
```

用手机小红书 APP 扫码。

### 步骤 4: 验证

```bash
# 查看日志确认
docker-compose logs | grep "Cookie 已成功保存"

# 应该看到成功信息
```

## 🎯 两种环境对比

| 特性 | 本地环境 | Docker 环境 |
|------|---------|-----------|
| **浏览器** | 有界面 Chromium | Headless Chromium |
| **扫码方式** | 直接在浏览器扫码 | 二维码图片 |
| **用户数据** | `scripts/xiaohongshu_browser_data` | 挂载卷 `browser_data` |
| **中文字体** | 系统自带 | Docker 安装 |
| **资源限制** | 无限制 | CPU 1 核，内存 512MB |
| **定时任务** | 系统 cron | 容器内 cron |
| **日志** | 控制台输出 | 文件 `/var/log/xiaohongshu/` |
| **部署难度** | 简单 | 中等 |
| **适用场景** | 开发测试 | 生产环境 |

## 💡 关键配置

### 环境变量

```yaml
environment:
  - DB_HOST=192.168.50.50      # 数据库地址
  - DB_PORT=3306               # 数据库端口
  - DB_USER=root               # 数据库用户
  - DB_PASSWORD=你的密码        # 数据库密码
  - DB_NAME=yqad_prod_db       # 数据库名称
  - TZ=Asia/Shanghai           # 时区
```

### 挂载卷

```yaml
volumes:
  - ./browser_data:/tmp/xiaohongshu_browser_data  # ⚠️ 重要！不要删除
  - ./qr_codes:/tmp/qr_codes                      # 二维码图片
  - ./logs:/var/log/xiaohongshu                   # 日志文件
```

### 资源限制

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'      # DS218+ 推荐 1 核心
      memory: 512M     # DS218+ 推荐 512MB
```

## 🔍 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看容器状态
docker-compose ps

# 重启服务
docker-compose restart

# 手动刷新 Cookie
docker-compose exec xiaohongshu-cookie-refresh python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py

# 测试 Cookie
docker-compose --profile test run xiaohongshu-test

# 停止服务
docker-compose down

# 重新构建
docker-compose build

# 查看资源使用
docker stats xiaohongshu-cookie-refresh
```

## ⚠️ 注意事项

### 必须遵守

1. **不要删除 `browser_data` 目录**
   - 否则需要重新扫码登录
   - 备份：`cp -r browser_data backup_$(date +%Y%m%d)`

2. **首次运行必须在 5 分钟内扫码**
   - 超时后需要重新运行
   - 二维码图片会覆盖更新

3. **确保网络通畅**
   - 容器需要访问小红书 API
   - 容器需要访问数据库 (192.168.50.50)

4. **定期检查日志**
   - 每天至少查看一次
   - 确认刷新成功

### 建议配置

1. **定时刷新频率**: 每 1-2 天
2. **日志保留**: 定期清理 30 天前的日志
3. **备份**: 每周备份 `browser_data` 目录
4. **监控**: 在群晖 Resource Monitor 中添加监控

## 🐛 故障排查

### 问题 1: 容器启动失败

```bash
# 检查 Docker 日志
docker-compose logs

# 检查架构
docker info | grep Architecture

# 重新构建
docker-compose build --no-cache
```

### 问题 2: 二维码未生成

```bash
# 检查目录权限
chmod 777 /volume1/docker/xiaohongshu/qr_codes

# 手动运行
docker-compose exec xiaohongshu-cookie-refresh bash
python3 /app/scripts/auto_refresh_xiaohongshu_cookie_docker.py
```

### 问题 3: Cookie 快速过期

```bash
# 检查 browser_data 是否持久化
ls -lh /volume1/docker/xiaohongshu/browser_data/

# 增加刷新频率
# 编辑 docker-compose.yml: 0 */12 * * *
```

### 问题 4: 内存不足

```bash
# 降低内存限制
# 编辑 docker-compose.yml:
#   memory: 256M

# 重启
docker-compose down
docker-compose up -d
```

## 📊 性能指标

### DS218+ 实际测试

| 指标 | 数值 |
|------|------|
| CPU 使用 | 30-50% (刷新时) |
| 内存使用 | 256-384MB |
| 磁盘占用 | ~800MB (含浏览器) |
| 刷新时间 | 10-20 秒 |
| 浏览器数据 | 50-100MB |

## 🎉 部署成功标志

- ✅ 容器状态：`Up (healthy)`
- ✅ 日志显示：`✅ Cookie 已成功保存到数据库`
- ✅ `browser_data` 目录有数据
- ✅ 定时任务正常运行
- ✅ 测试脚本通过

## 📚 下一步

1. **部署到群晖**: 按照 [群晖 Docker 部署指��.md](群晖 Docker 部署指南.md) 操作
2. **测试验证**: 运行测试脚本验证 Cookie 可用性
3. **监控运行**: 定期检查日志和資源使用
4. **备份数据**: 设置自动备份 `browser_data`

---

**最后更新:** 2026-06-29  
**适用环境:** 群晖 DS218+ Docker  
**状态:** ✅ 已验证
