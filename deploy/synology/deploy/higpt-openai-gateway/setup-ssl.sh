#!/bin/bash

# SSL 证书申请和配置脚本

SERVER="wangfuwei@10.30.5.33"
PASSWORD="Wfw7539148@"
DOMAIN="hx.hxfssc.com"

echo "========================================="
echo "步骤 1: 安装 acme.sh (如果未安装)"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    if [ ! -f "/home/wangfuwei/.acme.sh/acme.sh" ]; then
        curl https://get.acme.sh | sh
        source ~/.bashrc
    fi
    echo "acme.sh 已就绪"
EOF

echo ""
echo "========================================="
echo "步骤 2: 申请 DNS TXT 记录"
echo "========================================="

echo "需要在阿里云 DNS 添加以下 TXT 记录："
echo "记录类型：TXT"
echo "主机记录：_acme-challenge.hx"
echo "记录值：(将由 acme.sh 生成)"
echo ""
read -p "按回车键继续..."

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    cd ~
    source .acme.sh/acme.sh.env
    acme.sh --issue --dns -d hx.hxfssc.com --yes-i-know-dns-manual-mode-enough-go-ahead-please
EOF

echo ""
echo "请复制上面的 TXT 记录值，到阿里云 DNS 添加记录"
echo "添加完成后按回车继续..."
read

echo ""
echo "========================================="
echo "步骤 3: 验证并获取证书"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    cd ~
    source .acme.sh/acme.sh.env
    acme.sh --renew -d hx.hxfssc.com --force
EOF

echo ""
echo "========================================="
echo "步骤 4: 复制证书到 Nginx 目录"
echo "========================================="

sshpass -p "$PASSWORD" ssh $SERVER << 'EOF'
    sudo mkdir -p /usr/local/nginx/conf/ssl
    sudo cp /home/wangfuwei/.acme.sh/hx.hxfssc.com/fullchain.cer /usr/local/nginx/conf/ssl/hx.hxfssc.com.crt
    sudo cp /home/wangfuwei/.acme.sh/hx.hxfssc.com/hx.hxfssc.com.key /usr/local/nginx/conf/ssl/hx.hxfssc.com.key
    sudo chown nobody:nobody /usr/local/nginx/conf/ssl/hx.hxfssc.com.key
    sudo chmod 600 /usr/local/nginx/conf/ssl/hx.hxfssc.com.key
    echo "证书已复制到 /usr/local/nginx/conf/ssl/"
    ls -la /usr/local/nginx/conf/ssl/
EOF

echo ""
echo "SSL 证书配置完成！"
