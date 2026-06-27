## 为什么

当前项目处于源码与构建产物不一致状态：`dist` 中存在 57 个编译后的 JavaScript 模块，但 `src` 中仅保留 15 个 TypeScript 源文件，导致 `npm run build` 出现 50 个缺失模块错误，项目无法从源码重新构建。

同时配置与部署信息存在丢失或漂移风险：根目录存在同步冲突文件，主配置中包含直接写入的敏感凭据，HiGPT 网关部署说明引用的 `app/Dockerfile` 缺失，构建脚本也未复制 Web 静态资源。

## 变更内容

- 从现有 `dist`、声明文件和 source map 路径线索恢复缺失的 `src` TypeScript 源码结构。
- 整合根项目 `package.json`、`tsconfig.json` 与冲突文件中的有效构建/测试配置，使源码可重新编译。
- 修复配置基线，避免默认配置中硬编码敏感凭据，并保留本地覆盖配置的使用方式。
- 补齐 HiGPT 网关部署链路所需文件，使部署说明、Compose 配置与实际目录一致。
- 验证恢复后的项目至少能够完成 TypeScript 构建，并保留 `dist` 作为恢复参考而非唯一可运行来源。

## 功能 (Capabilities)

### 新增功能
- `source-recovery`: 项目必须能够从仓库源码完整构建运行，而不是依赖残留 `dist` 产物。

### 修改功能
- `docker-deployment`: 补齐 HiGPT 网关部署子项目的 Docker 构建入口，保证部署文档引用的文件实际存在。

## 影响

- 受影响目录：`src/`、`dist/`、`package.json`、`package-lock.json`、`tsconfig.json`、`config/`、`deploy/higpt-openai-gateway/`。
- 受影响能力：主项目构建、Web 管理 API、素材处理、AI 兜底链路、HiGPT 网关部署。
- 安全影响：默认配置不得继续携带真实 API Key、用户凭据或可直接复用的访问令牌。
