# Docker 部署规范

## 概述

本项目支持通过 Docker 容器化部署到群晖 NAS DS218+ 等 Linux 环境，特别是解决 HEIC/HEIF 格式图片处理的兼容性问题。

## 新增需求

### 需求 1: Dockerfile 配置

**描述：** 创建兼容 Linux 环境的 Dockerfile，支持所有图片格式处理。

#### 场景：HEIC/HEIF 格式支持

**给定** 项目需要部署到群晖 NAS（Linux 环境）
**当** 构建 Docker 镜像时
**那么** 必须安装 libheif 和 libvips 依赖以支持 HEIC/HEIF 格式转换

**验收标准：**
- 基础镜像使用 `node:18-alpine`
- 安装 `vips-dev` 和 `libheif` 系统依赖
- Sharp 库可以正常处理 HEIC/HEIF 文件
- 镜像体积小于 300MB

### 需求 2: Docker Compose 配置

**描述：** 提供 docker-compose.yml 简化部署流程。

#### 场景：数据持久化

**给定** 容器需要持久化存储数据
**当** 启动容器时
**那么** 必须挂载 data、config、logs 三个数据卷

**验收标准：**
- `./data` 挂载到 `/app/data`（素材库和 token）
- `./config` 挂载到 `/app/config`（配置文件）
- `./logs` 挂载到 `/app/logs`（日志文件）
- 容器重启后数据不丢失

#### 场景：网络配置

**给定** Web 管理界面需要对外提供服务
**当** 容器启动时
**那么** 必须映射 3000 端口

**验收标准：**
- 宿主机端口 3000 → 容器端口 3000
- 可通过 http://nas-ip:3000 访问 Web 界面
- 支持自定义端口映射

### 需求 3: 部署文档

**描述：** 提供完整的群晖 NAS Docker 部署指南。

#### 场景：首次部署

**给定** 用户需要在群晖 NAS 上部署项目
**当** 按照文档操作时
**那么** 可以在 30 分钟内完成部署并正常运行

**验收标准：**
- 文档包含 7 个详细安装步骤
- 提供完整的验证部署指南
- 包含 5 个以上常见故障排查方案
- 提供最佳实践建议

#### 场景：日常运维

**给定** 项目已部署完成
**当** 需要查看日志或重启容器时
**那么** 可以通过简单的 docker-compose 命令完成

**验收标准：**
- 提供启动/停止/重启命令
- 提供日志查看命令
- 提供资源监控方法
- 提供数据备份方案

## 修改需求

无。此规范为新增功能，不修改现有规范。

## 移除需求

无。

## 重命名需求

无。

## 技术约束

### 约束 1: 基础镜像

- 必须使用 Alpine Linux 基础镜像（体积小、启动快）
- Node.js 版本必须为 18 或更高
- 必须兼容群晖 Container Manager

### 约束 2: 系统依赖

- 必须安装 `libheif` 支持 HEIC/HEIF 格式
- 必须安装 `libvips` 作为 Sharp 的核心依赖
- 必须安装图片格式库（jpeg, png, webp, tiff）

### 约束 3: 数据持久化

- 必须挂载 3 个数据卷（data, config, logs）
- 数据目录权限必须正确（755）
- 配置文件必须可读写

## 验收测试

### 测试 1: Docker 镜像构建

```bash
# 构建镜像
docker build -t yqad-auto-post:test .

# 验证镜像大小
docker images yqad-auto-post:test

# 预期：镜像大小 < 300MB
```

### 测试 2: HEIC 格式处理

```bash
# 启动容器
docker run -d --name test \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  yqad-auto-post:test

# 放入 HEIC 测试文件
cp test.heic data/materials/raw/

# 调用处理 API
curl -X POST http://localhost:3000/api/materials/process

# 验证输出
ls data/materials/processed/*.jpg

# 预期：HEIC 文件成功转换为 JPEG
```

### 测试 3: 数据持久化

```bash
# 停止并删除容器
docker-compose down

# 重新启动
docker-compose up -d

# 验证数据存在
ls data/materials/processed/
cat logs/*.log

# 预期：数据文件仍然存在
```

## 依赖

- Docker 20.10+
- Docker Compose 2.0+
- 群晖 DSM 7.0+（带 Container Manager）
- Node.js 18+（开发环境）

## 参考资料

- [Sharp 文档](https://sharp.pixelplumbing.com/)
- [libheif 项目](https://github.com/strukturag/libheif)
- [群晖 Container Manager 文档](https://www.synology.com/zh-cn/dsm/packages/ContainerManager)
