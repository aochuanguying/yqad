## 为什么

需要在 Linux 服务器上部署 HiGPT OpenAI 兼容网关，该服务器 80 端口被 nginx 占用、443 端口被 v2ray 占用，且无法开放新端口。需要通过 Nginx 反向代理实现 HTTPS 访问，使用路径 `/higpt/` 访问网关服务。

## 变更内容

**新增功能：**
- 创建 Linux 服务器部署脚本和配置文件
- 配置 Nginx 反向代理，通过路径 `/higpt/` 转发请求到网关容器
- 配置 Let's Encrypt SSL 证书实现 HTTPS
- 创建自动化部署脚本（一键部署）

**修改功能：**
- 无（不影响现有代码，仅新增部署配置）

## 功能 (Capabilities)

### 新增功能
- `linux-deploy`: Linux 服务器部署方案，包括 Docker 配置、Nginx 配置、SSL 证书配置和部署脚本

### 修改功能
- （无）

## 影响

**受影响的系统：**
- Linux 服务器（jtsscapptest.hisense.com）
- Nginx 配置（新增反向代理配置）
- Docker 容器部署（higpt-gateway 容器）

**API 影响：**
- 无（网关 API 保持不变）
- 访问路径变更为 `https://服务器/higpt/v1/`

**依赖：**
- 需要服务器已安装 Docker 和 Docker Compose
- 需要 Nginx 已安装并可配置
- 需要域名解析（阿里云 DNS）
