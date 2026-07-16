# 使用 Node.js 官方镜像（AMD64 架构兼容）
FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# 复制 package.json
COPY package*.json ./

# 安装依赖（生产环境）
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY dist ./dist
COPY config ./config
COPY scripts ./scripts

# 安装浏览器依赖、Xvfb 和必要工具
USER root
RUN apt-get update && apt-get install -y \
    xvfb \
    curl \
    wget \
    gnupg \
    ffmpeg \
    libheif-examples \
    imagemagick \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装 pillow-heif（更好的 HEIC 支持）和 requests、xhshow 库
RUN python3 -m pip install --no-cache-dir --break-system-packages pillow-heif requests xhshow || pip install --no-cache-dir --break-system-packages pillow-heif requests xhshow || true

# 安装 Playwright 依赖
RUN npx playwright install chromium --with-deps

# 创建必要的目录
RUN mkdir -p /app/data/qr_codes \
    && mkdir -p /app/logs

# 暴露端口
EXPOSE 3000

# 启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/auth/status || exit 1

# 启动
CMD ["/docker-entrypoint.sh"]
