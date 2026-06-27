## 为什么

当前项目虽然已经有 Docker 部署方向的规范，但仓库里缺少可直接用于主应用的打包文件，且 HEIC/HEIF 转换在 Linux 容器中仍依赖 macOS 专属的 `sips` 兜底路径，无法满足群晖 `DS218+ / NAS218+` 的实际部署要求。现在需要将部署方案收敛为可执行的群晖方案，并把图片转换失败时的 Linux 兜底路径正式纳入提案范围。

## 变更内容

- 为主应用补齐面向群晖 Container Manager 的 Docker 打包方案，包括 `Dockerfile`、`docker-compose.yml`、`.dockerignore` 与部署说明。
- 将部署基线从“泛化 Linux 容器可运行”收敛为“群晖 `DS218+ / NAS218+` 的 `linux/amd64` 场景可稳定运行”。
- 采用方案 B：保留 `sharp` 作为主转换链路，并为 Linux 容器增加 HEIC/HEIF 转 JPEG 的命令行兜底能力，避免 `sharp` 或底层编解码能力不足时处理失败。
- 明确图片转换相关配置、卷挂载、`web.baseUrl`、日志与数据持久化要求，确保远程图片访问和容器重启后的状态一致。

## 功能 (Capabilities)

### 新增功能
- `image-conversion-fallback`: 定义素材处理在 Linux 容器中遇到 HEIC/HEIF 转换失败时的兜底行为、依赖约束与配置要求。

### 修改功能
- `docker-deployment`: 将现有 Docker 部署规范调整为适配群晖 `DS218+ / NAS218+` 的主应用部署方案，明确镜像平台、基础镜像、卷挂载、环境配置和运维验证要求。

## 影响

- 受影响代码：`src/services/material-processing.js`、配置加载与图片 URL 生成逻辑、部署目录与根目录打包文件。
- 受影响配置：`config/default.yaml`、`config/local.yaml`、容器环境变量、`web.baseUrl`、素材目录挂载路径。
- 受影响依赖：`sharp` 的运行时依赖、Linux HEIC/HEIF 转换工具链、Docker / Docker Compose 构建与运行环境。
- 受影响系统：群晖 DSM 7 的 Container Manager、`linux/amd64` 构建流程、素材处理任务与图片下载访问链路。
