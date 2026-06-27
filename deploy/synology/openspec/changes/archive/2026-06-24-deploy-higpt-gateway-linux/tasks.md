## 1. 准备工作

- [ ] 1.1 确认服务器已安装 Docker 和 Docker Compose
- [ ] 1.2 确认 Nginx 已安装并可配置
- [ ] 1.3 配置阿里云域名解析（A 记录到服务器 IP）
- [ ] 1.4 确认服务器防火墙允许 80/443 端口

## 2. 创建部署目录结构

- [ ] 2.1 在服务器创建 `/opt/higpt-gateway/` 目录
- [ ] 2.2 上传项目文件到服务器（docker-compose.yml, app/, config/）
- [x] 2.3 创建 `.env.example` 模板文件

## 3. 配置环境变量

- [x] 3.1 创建 `.env` 文件配置模板
- [x] 3.2 配置 `GATEWAY_API_KEY`
- [x] 3.3 配置 `HIGPT_API_KEY` 和 `HIGPT_USER_KEY`
- [x] 3.4 配置 `PORT=3000`

## 4. 配置 Docker Compose

- [x] 4.1 修改 docker-compose.yml 绑定到 `127.0.0.1:3000`
- [x] 4.2 配置容器网络模式为 bridge
- [x] 4.3 配置卷挂载（config/, logs/）
- [ ] 4.4 测试容器启动 `docker-compose up -d`

## 5. 配置 Nginx 反向代理

- [x] 5.1 创建 Nginx 配置文件 `/etc/nginx/conf.d/higpt-gateway.conf`
- [x] 5.2 配置 HTTP 到 HTTPS 重定向
- [x] 5.3 配置 `/higpt/` 路径代理到 `http://127.0.0.1:3000/`
- [x] 5.4 配置 WebSocket 支持（Upgrade 头）
- [x] 5.5 配置 SSL 证书路径
- [ ] 5.6 测试 Nginx 配置 `nginx -t`
- [ ] 5.7 重载 Nginx `nginx -s reload`

## 6. 配置 HTTPS（Let's Encrypt）

- [x] 6.1 安装 Certbot（部署脚本自动安装）
- [x] 6.2 使用 `--webroot` 模式申请证书（避免端口冲突）
- [x] 6.3 配置证书自动续期 cron 任务
- [ ] 6.4 验证证书有效期

## 7. 创建部署脚本

- [x] 7.1 创建 `deploy.sh` 脚本
- [x] 7.2 实现前置条件检查函数
- [x] 7.3 实现配置文件生成函数
- [x] 7.4 实现 SSL 证书申请函数
- [x] 7.5 实现容器启动函数
- [x] 7.6 实现错误处理和回滚函数
- [x] 7.7 添加执行权限 `chmod +x deploy.sh`

## 8. 创建健康检查脚本

- [x] 8.1 创建 `health-check.sh` 脚本
- [x] 8.2 实现容器状态检查
- [x] 8.3 实现 Nginx 配置检查
- [x] 8.4 实现 SSL 证书检查
- [x] 8.5 实现 API 功能测试
- [x] 8.6 添加执行权限 `chmod +x health-check.sh`

## 9. 测试验证

- [ ] 9.1 执行一键部署脚本
- [ ] 9.2 执行健康检查脚本
- [ ] 9.3 测试 HTTPS 访问 `https://域名/higpt/`
- [ ] 9.4 测试 API 请求 `curl https://域名/higpt/v1/chat/completions`
- [ ] 9.5 测试流式输出
- [ ] 9.6 记录测试结果

## 10. 文档和清理

- [x] 10.1 更新 README.md 添加 Linux 部署说明
- [x] 10.2 清理临时文件
- [ ] 10.3 归档部署日志
