# Dockerfile 规范

## 目标

创建一个兼容 Linux 环境的 Dockerfile，确保项目可以在群晖 NAS DS218+ 的 Docker 容器中正常运行，特别是支持 HEIC/HEIF 格式的图片处理。

## 功能需求

### F1: 基础镜像

- 使用 `node:18-alpine` 作为基础镜像
- 理由：体积小、启动快、群晖兼容性好

### F2: 系统依赖

必须安装以下系统依赖：

```dockerfile
RUN apk add --no-cache \
    vips-dev \
    libheif \
    libexif \
    jpeg-dev \
    png-dev \
    webp-dev \
    tiff-dev
```

**说明：**
- `vips-dev`: Sharp 库的核心依赖
- `libheif`: HEIC/HEIF 格式支持（替代 macOS 的 sips）
- `libexif`: EXIF 元数据读取
- `jpeg-dev`, `png-dev`, `webp-dev`, `tiff-dev`: 各种图片格式支持

### F3: 应用构建

```dockerfile
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 复制应用代码
COPY dist/ ./dist/
COPY config/ ./config/
```

### F4: 数据目录

```dockerfile
# 创建数据目录
RUN mkdir -p /app/data/materials/raw /app/data/materials/processed
```

### F5: 端口暴露

```dockerfile
# 暴露 Web 端口
EXPOSE 3000
```

### F6: 启动命令

```dockerfile
CMD ["node", "dist/index.js"]
```

## 非功能需求

### NFR1: 镜像体积

- 目标：最终镜像体积 < 300MB
- 优化措施：
  - 使用 Alpine 基础镜像
  - 使用 `--no-cache` 避免缓存
  - 多阶段构建（可选）

### NFR2: 构建时间

- 目标：首次构建 < 10 分钟
- 后续构建（使用缓存）: < 2 分钟

### NFR3: 兼容性

- 必须兼容群晖 Container Manager
- 必须支持 x64 架构（DS218+ 使用 Intel Celeron J3355）

## 验收标准

1. ✅ Docker 镜像可以成功构建
2. ✅ 容器可以正常启动
3. ✅ Web 界面可以访问（端口 3000）
4. ✅ HEIC/HEIF 格式图片可以正常转换为 JPEG
5. ✅ 所有支持的图片格式处理正常（.jpg, .png, .gif, .webp, .heic, .heif）
6. ✅ 素材处理任务可以成功完成

## 依赖

- Node.js 18+
- npm 8+
- Docker 20.10+
- 群晖 DSM 7.0+

## 验收测试

```bash
# 1. 构建镜像
docker build -t yqad-auto-post:test .

# 2. 启动容器
docker run -d \
  --name yqad-test \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config \
  yqad-auto-post:test

# 3. 验证运行
docker logs yqad-test

# 4. 测试 HEIC 处理
# 放入 HEIC 文件到 data/materials/raw/
# 调用 API: POST http://localhost:3000/api/materials/process

# 5. 清理
docker stop yqad-test
docker rm yqad-test
```
