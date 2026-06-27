## 上下文

**当前状态：**
- Linux 服务器（jtsscapptest.hisense.com）已运行
- 80 端口：nginx 占用（HTTP）
- 443 端口：v2ray 占用（HTTPS）
- 无法开放新端口
- 需要使用阿里云域名解析

**约束条件：**
- 不能占用 80/443 端口（已被占用）
- 必须通过路径访问（`/higpt/`）
- 需要 HTTPS 加密
- 服务器已安装 Docker 和 Nginx

## 目标 / 非目标

**目标：**
- 通过 Nginx 反向代理实现路径 `/higpt/` 访问网关
- 配置 HTTPS（使用独立域名或子域名）
- 一键部署脚本
- 不影响现有 v2ray 和 nginx 服务

**非目标：**
- 不修改现有 v2ray 配置
- 不修改现有 nginx 主配置
- 不改变网关容器内部逻辑

## 决策

### 1. 网络架构：Nginx 反向代理 + Docker Bridge 网络

**决策：** 网关容器绑定到 `127.0.0.1:3000`，仅本地访问，通过 Nginx 反向代理暴露

**理由：**
- 不占用外部端口
- 安全性高（网关不直接暴露）
- Nginx 统一处理 SSL 和路由

**替代方案：**
- ❌ Host 网络模式：安全性低，可能端口冲突
- ❌ Docker Macvlan：配置复杂，需要网络权限

### 2. HTTPS 方案：Let's Encrypt + 独立子域名

**决策：** 使用 Let's Encrypt 为子域名（如 `higpt.yourdomain.com`）申请 SSL 证书

**理由：**
- 免费且自动续期
- 不占用 443 端口（通过 Nginx 代理）
- 路径访问需要域名支持

**替代方案：**
- ❌ 自签名证书：浏览器警告，不适合生产
- ❌ 商业证书：成本高，流程复杂

### 3. 部署方式：Docker Compose + Shell 脚本

**决策：** 使用 Docker Compose 管理容器，Shell 脚本自动化部署

**理由：**
- 与现有部署方式一致
- 易于维护和回滚
- 脚本可重复执行

### 4. Nginx 配置：独立配置文件

**决策：** 在 `/etc/nginx/conf.d/` 创建独立配置文件 `higpt-gateway.conf`

**理由：**
- 不影响现有 Nginx 配置
- 易于管理和回滚
- 符合 Nginx 最佳实践

## 风险 / 权衡

| 风险 | 缓解措施 |
|------|----------|
| SSL 证书申请失败（端口冲突） | 使用 `--standalone` 模式时临时停止 nginx，或使用 `--webroot` 模式 |
| 路径代理 WebSocket 失败 | Nginx 配置中显式启用 WebSocket 支持（Upgrade 头） |
| 域名解析延迟 | 提前配置阿里云 DNS，TTL 设置为最小值 |
| 容器与宿主机网络不通 | 使用 Docker bridge 网络，测试本地 curl |

## 迁移计划

### 部署步骤

1. **前置准备**
   - 配置阿里云域名解析（A 记录到服务器 IP）
   - 确认服务器防火墙允许 80/443 端口

2. **上传代码**
   - 上传 `deploy/higpt-openai-gateway/` 到 `/opt/higpt-gateway/`

3. **配置环境变量**
   - 创建 `.env` 文件

4. **配置 Nginx**
   - 创建 `/etc/nginx/conf.d/higpt-gateway.conf`
   - 测试配置并重载

5. **申请 SSL 证书**
   - 使用 Certbot 申请 Let's Encrypt 证书

6. **启动容器**
   - `docker-compose up -d`

7. **测试验证**
   - HTTPS 访问测试
   - API 功能测试

### 回滚策略

```bash
# 1. 停止容器
docker-compose down

# 2. 移除 Nginx 配置
sudo rm /etc/nginx/conf.d/higpt-gateway.conf
sudo nginx -s reload

# 3. 恢复原状（如需要）
```

## Open Questions

1. **域名选择**：使用现有域名还是新注册域名？
2. **SSL 证书管理**：手动续期还是自动续期（推荐自动）？
3. **日志管理**：容器日志轮转策略？
