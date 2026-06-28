FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Python 环境构建阶段
FROM python:3.10-slim AS python-builder

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install chromium \
    && playwright install-deps chromium

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 安装 Python 和系统依赖
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    libheif1 \
    libheif-examples \
    libvips42 \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    gnupg \
  && rm -rf /var/lib/apt/lists/*

# 安装 Playwright 系统依赖
RUN curl https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/bin/install_media_pack | bash \
  || true

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt \
    && playwright install chromium \
    && playwright install-deps chromium

COPY config ./config
COPY --from=builder /app/dist ./dist
COPY --from=python-builder /usr/local/lib/python3.10/site-packages /usr/lib/python3/dist-packages
COPY stealth.min.js ./
COPY xiaohongshu_final.py ./

RUN mkdir -p /app/data/materials/raw /app/data/materials/processed /app/logs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
