#!/bin/bash

# v2ray + Nginx SSL 部署脚本

SERVER="wangfuwei@10.30.5.33"
PASSWORD="Wfw7539148@"
DOMAIN="hx.hxfssc.com"

echo "========================================="
echo "步骤 1: 备份当前 v2ray 配置"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    sudo cp /usr/local/etc/v2ray/config.json /usr/local/etc/v2ray/config.json.backup
    echo "v2ray 配置已备份"
EOF

echo ""
echo "========================================="
echo "步骤 2: 上传 v2ray WebSocket 配置"
echo "========================================="

sshpass -p "$PASSWORD" scp v2ray-ws-config.json $SERVER:/tmp/v2ray-ws-config.json

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    sudo cp /tmp/v2ray-ws-config.json /usr/local/etc/v2ray/config.json
    sudo v2ray restart
    echo "v2ray 已重启为 WebSocket 模式 (监听 127.0.0.1:10000)"
EOF

echo ""
echo "========================================="
echo "步骤 3: 申请 SSL 证书"
echo "========================================="

echo "检查 acme.sh 是否已安装..."
sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    if [ ! -f "/home/wangfuwei/.acme.sh/acme.sh" ]; then
        echo "正在安装 acme.sh..."
        curl https://get.acme.sh | sh
        source ~/.bashrc
    fi
    source .acme.sh/acme.sh.env
    echo "acme.sh 版本：$(acme.sh --version)"
EOF

echo ""
echo "开始申请证书..."
sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    cd ~
    source .acme.sh/acme.sh.env
    
    # 使用 DNS 验证模式
    acme.sh --issue --dns -d hx.hxfssc.com --yes-i-know-dns-manual-mode-enough-go-ahead-please
EOF

echo ""
echo "========================================="
echo "重要：请在阿里云 DNS 添加以下 TXT 记录"
echo "========================================="
echo "记录类型：TXT"
echo "主机记录：_acme-challenge.hx"
echo "记录值：(见上一步输出)"
echo ""
echo "添加完成后按回车继续..."
read

echo ""
echo "========================================="
echo "步骤 4: 验证 DNS 记录并获取证书"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    cd ~
    source .acme.sh/acme.sh.env
    acme.sh --renew -d hx.hxfssc.com --force
EOF

echo ""
echo "========================================="
echo "步骤 5: 复制证书到 Nginx 目录"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    sudo mkdir -p /usr/local/nginx/conf/ssl
    sudo cp /home/wangfuwei/.acme.sh/hx.hxfssc.com/fullchain.cer /usr/local/nginx/conf/ssl/hx.hxfssc.com.crt
    sudo cp /home/wangfuwei/.acme.sh/hx.hxfssc.com/hx.hxfssc.com.key /usr/local/nginx/conf/ssl/hx.hxfssc.com.key
    sudo chown nobody:nobody /usr/local/nginx/conf/ssl/hx.hxfssc.com.key
    sudo chmod 600 /usr/local/nginx/conf/ssl/hx.hxfssc.com.key
    echo "证书已复制："
    ls -la /usr/local/nginx/conf/ssl/
EOF

echo ""
echo "========================================="
echo "步骤 6: 创建 Nginx SSL 配置"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    cat > /usr/local/nginx/conf/conf.d/higpt-gateway.conf << 'NGINX_EOF'
# HTTP 服务器 - 重定向到 HTTPS
server {
    listen 80;
    server_name hx.hxfssc.com;
    
    # HiGPT 网关 (HTTP)
    location /higpt/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # v2ray WebSocket (HTTP)
    location /v2ray/ {
        proxy_pass http://127.0.0.1:10000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}

# HTTPS 服务器
server {
    listen 443 ssl;
    server_name hx.hxfssc.com;
    
    ssl_certificate /usr/local/nginx/conf/ssl/hx.hxfssc.com.crt;
    ssl_certificate_key /usr/local/nginx/conf/ssl/hx.hxfssc.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # HiGPT 网关 (HTTPS)
    location /higpt/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # v2ray WebSocket (HTTPS)
    location /v2ray/ {
        proxy_pass http://127.0.0.1:10000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
NGINX_EOF
    
    # 测试 Nginx 配置
    sudo /usr/local/nginx/sbin/nginx -t
    if [ $? -eq 0 ]; then
        echo "Nginx 配置测试通过"
        sudo /usr/local/nginx/sbin/nginx -s reload
        echo "Nginx 已重新加载"
    else
        echo "Nginx 配置测试失败！"
        exit 1
    fi
EOF

echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  - HiGPT 网关 (HTTP):  http://hx.hxfssc.com/higpt/"
echo "  - HiGPT 网关 (HTTPS): https://hx.hxfssc.com/higpt/"
echo "  - v2ray (WebSocket):  ws://hx.hxfssc.com/v2ray/ 或 wss://hx.hxfssc.com/v2ray/"
echo ""
echo "测试命令："
echo "  curl http://hx.hxfssc.com/higpt/health"
echo "  curl https://hx.hxfssc.com/higpt/health (忽略证书警告)"
echo ""
