# 手动操作步骤

## 1. 在服务器上执行基础部署

```bash
# SSH 登录服务器
ssh wangfuwei@10.30.5.33

# 进入部署目录
cd /home/wangfuwei/higpt-openai-gateway

# 创建必要目录
sudo mkdir -p /usr/local/nginx/conf/conf.d
sudo mkdir -p /opt/higpt-gateway

# 运行部署脚本（不含 SSL 证书申请）
./deploy.sh -d hx.hxfssc.com -e aochuanguying@163.com -v
```

## 2. 手动申请 SSL 证书

```bash
# 使用 acme.sh 申请证书（DNS 验证方式）
cd /home/wangfuwei/.acme.sh

# 执行 DNS 验证模式
./acme.sh --issue --dns -d hx.hxfssc.com --yes-I-know-dns-manual-mode-enough-go-ahead-please

# 按提示在阿里云 DNS 添加 TXT 记录
# 添加完成后，执行验证
./acme.sh --issue --dns -d hx.hxfssc.com --yes-I-know-dns-manual-mode-enough-go-ahead-please --renew

# 证书将保存在：/home/wangfuwei/.acme.sh/hx.hxfssc.com/
```

## 3. 复制证书到 Nginx 目录

```bash
sudo mkdir -p /etc/letsencrypt/live/hx.hxfssc.com
sudo cp /home/wangfuwei/.acme.sh/hx.hxfssc.com/*.pem /etc/letsencrypt/live/hx.hxfssc.com/
```

## 4. 配置环境变量

```bash
cd /opt/higpt-gateway
cp .env.example .env
vi .env  # 编辑填写 HIGPT_API_KEY 和 HIGPT_USER_KEY
```

## 5. 启动网关

```bash
cd /opt/higpt-gateway
docker-compose up -d
```

## 6. 配置 Nginx

编辑 `/usr/local/nginx/conf/conf.d/higpt-gateway.conf`，确保 SSL 证书路径正确：
- `ssl_certificate /etc/letsencrypt/live/hx.hxfssc.com/fullchain.pem;`
- `ssl_certificate_key /etc/letsencrypt/live/hx.hxfssc.com/privkey.pem;`

然后重载 Nginx：
```bash
sudo /usr/local/nginx/sbin/nginx -s reload
```

## 7. 测试访问

- HTTPS 访问：`https://hx.hxfssc.com/higpt/`
- 健康检查：`curl -k https://hx.hxfssc.com/higpt/health`
