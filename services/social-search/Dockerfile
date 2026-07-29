FROM node:20-slim

WORKDIR /app

# 使用国内镜像源 - apt
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

# 安装 Python 3 和系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 使用国内镜像源 - pip
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    xhshow \
    requests \
    playwright \
    pycryptodome \
    beautifulsoup4

# 使用国内镜像源 - npm
RUN npm config set registry https://registry.npmmirror.com

# 使用国内镜像源 - Playwright 浏览器下载
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright

# 安装 Playwright Chromium
RUN npx playwright install chromium --with-deps

# 复制 package.json 并安装 Node 依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制编译产物和脚本
COPY dist ./dist
COPY scripts ./scripts

# 暴露端口
EXPOSE 3090

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3090/health || exit 1

CMD ["node", "dist/index.js", "--mode", "all"]
