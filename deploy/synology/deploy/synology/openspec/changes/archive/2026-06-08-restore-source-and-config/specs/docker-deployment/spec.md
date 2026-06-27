## 新增需求

### 需求:HiGPT 网关部署目录必须包含 Docker 构建入口
HiGPT OpenAI 兼容网关部署目录必须提供 `docker-compose.yml` 所引用的 Dockerfile，保证部署说明中的最小可部署产物完整。

#### 场景:构建 HiGPT 网关镜像
- **当** 用户在 `deploy/higpt-openai-gateway` 目录运行 Docker Compose 构建
- **那么** Compose 配置引用的 `app/Dockerfile` 必须存在
- **并且** Dockerfile 必须能够安装依赖、构建 TypeScript 网关应用并以 `dist/index.js` 启动服务

## 修改需求

## 移除需求
