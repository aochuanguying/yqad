# 使用 Node.js 官方镜像（AMD64 架构兼容）
FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# ============ 第一层：系统依赖（极少变动）============
USER root
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|https://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ffmpeg \
    libheif-examples \
    imagemagick \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# ============ 第二层：Python 依赖（HEIC 图片转换）============
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    pillow-heif || true

# ============ 第三层：npm 依赖（仅 package.json 变动时重建）============
# ONNXRUNTIME_NODE_INSTALL_CUDA=skip：跳过 onnxruntime-node 从 GitHub 下载 GPU 二进制
# （X5 无 GPU，且 GitHub releases 国内直连超时）
COPY package*.json ./
RUN export ONNXRUNTIME_NODE_INSTALL_CUDA=skip && \
    npm config set registry https://registry.npmmirror.com && \
    npm ci --only=production && npm cache clean --force

# ============ 第四层：目录与入口脚本（极少变动）============
RUN mkdir -p /app/data /app/logs
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# ============ 第六层：应用代码（频繁变动，放最后）============
COPY dist ./dist
COPY config ./config
COPY scripts ./scripts

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/auth/status || exit 1

# 启动
CMD ["/docker-entrypoint.sh"]
