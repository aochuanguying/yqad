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

# 复制 package.json 并安装 Node 依赖（不包括 playwright-core）
COPY package*.json ./
RUN rm -f ~/.npmrc .npmrc && \
    echo "registry=https://registry.npmmirror.com" > .npmrc && \
    echo "strict-ssl=false" >> .npmrc && \
    npm config --global set registry https://registry.npmmirror.com && \
    npm config --global set strict-ssl false && \
    cat .npmrc && \
    rm -rf node_modules && \
    npm install --omit=dev --no-audit --network-timeout=300000 --legacy-peer-deps && \
    curl -L -o /tmp/playwright-core.tgz https://registry.npmmirror.com/playwright-core/-/playwright-core-1.40.0.tgz && \
    mkdir -p node_modules/playwright-core && \
    tar -xzf /tmp/playwright-core.tgz -C node_modules/playwright-core --strip-components=1 && \
    rm /tmp/playwright-core.tgz && \
    npm cache clean --force

# 使用国内镜像源 - Playwright 浏览器下载
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright

# 安装 Playwright Chromium 浏览器（使用 playwright-core）
RUN node node_modules/playwright-core/cli.js install chromium --with-deps

# 安装 Python 版 Playwright 浏览器（汽车之家搜索脚本使用）
RUN python3 -m playwright install chromium

# 复制编译产物、脚本和前端文件
COPY dist ./dist
COPY scripts ./scripts
COPY web ./web

# 暴露端口
EXPOSE 3090

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3090/health || exit 1

CMD ["node", "dist/index.js", "--mode", "all"]
