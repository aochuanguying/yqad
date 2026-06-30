# 小红书 Cookie 自动刷新 - Docker 镜像
# 基于 Python 3.10 + Playwright

FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DEBIAN_FRONTEND=noninteractive

# 安装系统依赖 (包括中文字体)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    curl \
    wget \
    ca-certificates \
    # Playwright 依赖
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # 中文字体
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    fonts-noto-cjk \
    fontconfig \
    # 数据库客户端
    default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
RUN pip install --no-cache-dir \
    playwright==1.60.0 \
    mysql-connector-python==9.7.0

# 安装 Playwright 浏览器
RUN playwright install chromium

# 复制脚本文件
COPY scripts/*.py /app/scripts/
COPY scripts/*.sh /app/scripts/

# 创建必要的目录
RUN mkdir -p /tmp/xiaohongshu_browser_data \
    && chmod +x /app/scripts/*.py \
    && chmod +x /app/scripts/*.sh

# 设置默认命令
CMD ["python3", "/app/scripts/auto_refresh_xiaohongshu_cookie_docker.py"]
