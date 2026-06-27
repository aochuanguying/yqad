FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    libheif1 \
    libheif-examples \
    libvips42 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci \
  && npm cache clean --force

COPY tsconfig*.json ./
COPY src ./src
COPY config ./config

RUN mkdir -p /app/data/materials/raw /app/data/materials/processed /app/logs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
