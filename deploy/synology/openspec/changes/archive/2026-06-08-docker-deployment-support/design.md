## 上下文

当前项目的素材处理模块（`material-processing.js`）在处理 HEIC/HEIF 格式图片时，使用了 macOS 专属的 `sips` 命令进行格式转换。这导致在 Linux 环境（如群晖 NAS DS218+ 的 Docker 容器）中无法正常工作。

**现状：**
- 开发环境：macOS（使用 `sips` 命令）
- 目标部署环境：群晖 DS218+（Linux, Intel Celeron J3355 x64 架构）
- 问题：`sips` 是 macOS 系统工具，Linux 不存在

**约束条件：**
- 必须保持 macOS 开发环境的兼容性
- 必须支持 Linux 生产环境（群晖 NAS Docker）
- 素材处理逻辑不能降级（仍需支持 HEIC/HEIF 转换）

## 目标 / 非目标

**目标：**
- 创建兼容 Linux 的 Dockerfile，使用 `libheif` 替代 `sips` 处理 HEIC/HEIF 格式
- 提供完整的 Docker Compose 配置，简化部署流程
- 确保 Sharp 库在 Linux 环境下能正常处理所有支持的图片格式
- 记录详细的部署步骤和故障排查指南

**非目标：**
- 不修改现有素材处理逻辑（保持代码不变）
- 不支持其他新的图片格式
- 不修改现有的 macOS 开发环境配置

## 决策

### 决策 1：使用 Alpine Linux 作为基础镜像

**选择：** `node:18-alpine`

**理由：**
- 镜像体积小（约 180MB），启动快
- Alpine 包管理器（apk）安装依赖简单
- 群晖 Container Manager 完全兼容
- 生产环境稳定性好

**替代方案：**
- `node:18-slim`（Debian 基础）：体积更大（约 350MB），但兼容性更好
- `node:18-bullseye`：体积最大，但依赖最全

**最终决定：** Alpine，因为群晖 NAS 资源有限，小体积镜像更优。

### 决策 2：通过 apk 安装 libheif 和 libvips

**选择：** 在 Dockerfile 中使用 `RUN apk add --no-cache vips-dev libheif`

**理由：**
- Sharp 库自动检测并使用 libheif 处理 HEIC/HEIF 文件
- 无需修改现有代码
- Alpine 官方仓库提供，稳定性有保障
- 依赖关系由 apk 自动管理

**替代方案：**
- 使用 `heif-convert` 命令行工具：需要额外安装，代码需要修改
- 编译安装 libheif：增加构建时间和复杂度

**最终决定：** 直接安装 apk 包，最简单且无需代码修改。

### 决策 3：数据卷挂载策略

**选择：** 挂载 `./data`、`./config`、`./logs` 三个目录到宿主机

**理由：**
- 数据持久化：容器删除后数据不丢失
- 配置分离：便于修改配置无需重建镜像
- 日志访问：宿主机可直接查看日志文件

**挂载结构：**
```yaml
volumes:
  - ./data:/app/data          # 素材库和 token 数据
  - ./config:/app/config      # 配置文件
  - ./logs:/app/logs          # 日志文件
```

### 决策 4：端口映射与网络配置

**选择：** 默认映射 3000 端口，使用 `host` 网络模式可选

**理由：**
- 3000 是 Web 管理界面默认端口
- 群晖支持端口转发配置
- 使用标准桥接网络，兼容性最好

**配置：**
```yaml
ports:
  - "3000:3000"
```

## 风险 / 权衡

### 风险 1：Alpine 的 musl libc 兼容性问题

**风险：** Alpine 使用 musl libc 而非 glibc，某些 Node.js 原生模块可能不兼容。

**缓解措施：**
- 使用官方 `node:18-alpine` 镜像，已处理 musl 兼容性
- Sharp、exifr 等主流库都支持 Alpine
- 如遇到问题，可切换到 `node:18-slim`（Debian）

### 风险 2：libheif 解码性能

**风险：** libheif 解码 HEIC 文件可能比 macOS sips 慢。

**缓解措施：**
- 群晖 DS218+ 是 x64 架构，性能足够
- 素材处理是异步任务，不影响核心功能
- 可通过 `maxFilesPerRun` 限制单��处理数量

### 风险 3：镜像构建时间

**风险：** 安装 vips-dev 和 libheif 会增加镜像构建时间。

**缓解措施：**
- 使用多阶段构建优化（可选）
- 依赖缓存：Docker 层缓存可加速后续构建
- 预计增加 2-3 分钟构建时间，可接受

### 权衡：镜像体积 vs 便利性

**权衡：** 安装完整依赖会增加镜像体积（约 +50MB）。

**决定：** 接受体积增加，换取无需修改代码的便利性。

## 迁移计划

### 部署步骤

1. **构建 Docker 镜像**
   ```bash
   docker build -t yqad-auto-post:latest .
   ```

2. **启动容器**
   ```bash
   docker-compose up -d
   ```

3. **验证运行**
   - 访问 http://nas-ip:3000 查看 Web 界面
   - 检查日志：`docker logs yqad-auto-post`
   - 测试素材处理：在 Web 界面点击"整理素材"

4. **配置持久化**
   - 编辑 `./config/local.yaml` 配置账号、API 等
   - 重启容器：`docker-compose restart`

### 回滚策略

如遇到问题，可快速回滚到旧版本：

```bash
# 停止新容器
docker-compose down

# 重新拉取旧镜像
docker pull yqad-auto-post:previous-tag

# 修改 docker-compose.yml 的镜像标签
# 重新启动
docker-compose up -d
```

## Open Questions

无。此设计已覆盖所有关键技术决策。
