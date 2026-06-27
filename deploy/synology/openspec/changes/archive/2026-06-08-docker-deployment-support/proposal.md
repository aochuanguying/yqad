## 为什么

当前项目的素材处理模块使用 macOS 专属的 `sips` 命令处理 HEIC/HEIF 格式转换，这导致项目无法在群晖 NAS（Linux 系统）的 Docker 容器中正常运行。需要添加对 Linux 环境的兼容性支持，确保项目可以顺利部署到群晖 DS218+ 的 Docker 环境中。

## 变更内容

- **新增 Docker 部署支持**：创建兼容 Linux 的 Dockerfile，安装必要的依赖库（libheif、libvips 等），确保 HEIC/HEIF 格式转换在 Linux 环境下正常工作。
- **新增 Docker Compose 配置**：提供完整的容器编排配置，包括卷挂载、端口映射、环境变量等。
- **新增部署文档**：记录群晖 NAS Docker 部署的步骤、注意事项和故障排查指南。

## 功能 (Capabilities)

### 新增功能

- `dockerfile`: 创建支持 HEIC/HEIF 格式的 Dockerfile，包含完整的依赖安装和构建配置。
- `docker-compose`: 提供 docker-compose.yml 配置文件，简化部署流程。
- `deployment-docs`: 群晖 NAS Docker 部署文档，包含详细步骤和配置说明。

### 修改功能

<!-- 现有功能，其需求发生变更（不仅仅是实现）。仅当规范级行为发生变更时才在此列出。每个都需要一个增量规范文件。使用项目目录中 specs/ 的现有规范名称。如果没有需求变更，请留空。 -->

## 影响

- **受影响系统**：素材处理模块（material-processing）
- **依赖变更**：需要安装 libheif、libvips-dev 等 Linux 依赖库
- **部署方式**：新增 Docker 容器化部署选项
- **兼容性**：保持 macOS 开发环境兼容，同时支持 Linux 生产环境
