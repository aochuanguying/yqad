# 使用 Playwright 官方镜像（包含所有浏览器依赖）
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装依赖（不使用 --only=production 以支持 ESM 模块）
RUN npm ci

# 复制应用代码
COPY dist ./dist
COPY config ./config

# 安装浏览器依赖和 Xvfb
USER root
RUN apt-get update && apt-get install -y xvfb

# 安装 Playwright 浏览器（镜像已包含，只需安装依赖）
RUN npx playwright install chromium

# 创建二维码目录
RUN mkdir -p /app/data/qr_codes

# 暴露端口
EXPOSE 3000

# 启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 启动
CMD ["/docker-entrypoint.sh"]
