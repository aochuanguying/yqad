#!/bin/bash

################################################################################
# HiGPT OpenAI Gateway + v2ray 一键部署脚本
# 用途：在 Linux 服务器上自动化部署 HiGPT 网关和配置 v2ray WebSocket
################################################################################

set -e  # 遇到错误立即退出

# 确保 PATH 包含 /usr/local/bin
export PATH=/usr/local/bin:$PATH

# 设置 sudo 密码（如果提供了 SUDO_PASSWORD 环境变量）
if [[ -n "$SUDO_PASSWORD" ]]; then
    export SUDO_ASKPASS=/tmp/sudo_askpass.sh
    cat > /tmp/sudo_askpass.sh << 'ASKPASS_EOF'
#!/bin/bash
echo "$SUDO_PASSWORD"
ASKPASS_EOF
    chmod +x /tmp/sudo_askpass.sh
fi

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取 nginx 命令路径
get_nginx_cmd() {
    if command -v nginx &> /dev/null; then
        echo "nginx"
    elif [[ -x "$NGINX_PATH/sbin/nginx" ]]; then
        echo "$NGINX_PATH/sbin/nginx"
    else
        echo "nginx"
    fi
}

# 部署配置
DEPLOY_DIR="/opt/higpt-gateway"
DOMAIN=""
EMAIL=""
NGINX_PATH="/usr/local/nginx"
NGINX_CONF="/usr/local/nginx/conf/conf.d/higpt-gateway.conf"
V2RAY_CONFIG="/usr/local/etc/v2ray/config.json"
V2RAY_WS_PORT="10000"
V2RAY_WS_PATH="/v2ray/"

################################################################################
# 函数：显示使用说明
################################################################################
show_usage() {
    cat << EOF
用法：$0 -d <域名> -e <邮箱> [-v]

选项:
    -d, --domain    域名（必填），如：hx.hxfssc.com
    -e, --email     邮箱（必填），用于 Let's Encrypt 证书通知
    -v, --v2ray     同时配置 v2ray WebSocket（可选，默认不配置）
    -h, --help      显示此帮助信息

示例:
    # 仅部署 HiGPT 网关
    $0 -d hx.hxfssc.com -e admin@example.com
    
    # 部署 HiGPT 网关 + 配置 v2ray WebSocket
    $0 -d hx.hxfssc.com -e admin@example.com -v

EOF
    exit 1
}

################################################################################
# 函数：解析命令行参数
################################################################################
parse_args() {
    CONFIG_V2RAY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -e|--email)
                EMAIL="$2"
                shift 2
                ;;
            -v|--v2ray)
                CONFIG_V2RAY=true
                shift
                ;;
            -h|--help)
                show_usage
                ;;
            *)
                log_error "未知选项：$1"
                show_usage
                ;;
        esac
    done

    if [[ -z "$DOMAIN" ]] || [[ -z "$EMAIL" ]]; then
        log_error "域名和邮箱为必填参数"
        show_usage
    fi
}

################################################################################
# 函数：安装 Docker 和 Docker Compose
################################################################################
install_docker() {
    log_info "正在安装 Docker 和 Docker Compose..."
    
    # 检测操作系统
    local os_name=""
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        os_name=$ID
    else
        log_error "无法检测操作系统类型"
        exit 1
    fi
    
    log_info "检测到操作系统：$os_name"
    
    case $os_name in
        ubuntu|debian)
            # Ubuntu/Debian 系统
            log_info "更新软件包列表..."
            sudo apt update
            
            log_info "安装依赖包..."
            sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release software-properties-common
            
            log_info "添加 Docker 官方 GPG 密钥..."
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            
            log_info "设置 Docker 稳定版仓库..."
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            log_info "安装 Docker..."
            sudo apt update
            sudo apt install -y docker-ce docker-ce-cli containerd.io
            
            log_info "安装 Docker Compose..."
            sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            
            ;;
        centos|rhel|rocky|almalinux)
            # CentOS/RHEL 系统
            log_info "安装依赖包..."
            sudo yum install -y yum-utils device-mapper-persistent-data lvm2
            
            log_info "添加 Docker 仓库..."
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            
            log_info "安装 Docker..."
            sudo yum install -y docker-ce docker-ce-cli containerd.io
            
            log_info "安装 Docker Compose..."
            sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            
            ;;
        *)
            log_error "不支持的操作系统：$os_name"
            exit 1
            ;;
    esac
    
    # 启动 Docker 服务
    log_info "启动 Docker 服务..."
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # 将当前用户添加到 docker 组
    log_info "将用户添加到 docker 组..."
    sudo usermod -aG docker $USER
    
    # 验证安装
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        log_success "Docker 和 Docker Compose 安装成功"
        log_success "Docker 版本：$(docker --version)"
        log_success "Docker Compose 版本：$(docker-compose --version)"
        
        log_warning "请执行以下命令使 docker 组权限生效，然后重新运行部署脚本："
        echo "  newgrp docker"
        echo "或者重新登录 SSH 会话"
        
        # 等待用户确认
        read -p "是否已完成用户组配置？按回车继续..."
    else
        log_error "Docker 安装失败"
        exit 1
    fi
}

################################################################################
# 函数：检查前置条件
################################################################################
check_prerequisites() {
    log_info "检查前置条件..."

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_warning "Docker 未安装"
        read -p "是否自动安装 Docker 和 Docker Compose？(y/n): " install_docker_confirm
        if [[ "$install_docker_confirm" == "y" ]]; then
            install_docker
        else
            log_error "Docker 是必需的依赖，请先安装 Docker"
            exit 1
        fi
    else
        log_success "Docker 已安装：$(docker --version)"
    fi

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_warning "Docker Compose 未安装"
        read -p "是否自动安装 Docker Compose？(y/n): " install_compose_confirm
        if [[ "$install_compose_confirm" == "y" ]]; then
            log_info "安装 Docker Compose..."
            sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            log_success "Docker Compose 安装成功：$(docker-compose --version)"
        else
            log_error "Docker Compose 是必需的依赖，请先安装"
            exit 1
        fi
    else
        log_success "Docker Compose 已安装：$(docker-compose --version)"
    fi

    # 检查 Nginx
    if command -v nginx &> /dev/null; then
        log_success "Nginx 已安装：$(nginx -v 2>&1)"
    elif [[ -x "$NGINX_PATH/sbin/nginx" ]]; then
        log_success "Nginx 已安装 (自定义路径): $(${NGINX_PATH}/sbin/nginx -v 2>&1)"
    else
        log_warning "Nginx 未安装，正在尝试安装..."
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install -y nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y nginx
        else
            log_error "无法自动安装 Nginx，请手动安装或使用自定义路径"
            exit 1
        fi
        log_success "Nginx 已安装：$(nginx -v 2>&1)"
    fi

    # 检查 Certbot 或 acme.sh
    if command -v certbot &> /dev/null; then
        log_success "Certbot 已安装：$(certbot --version)"
    elif [[ -x "$HOME/.acme.sh/acme.sh" ]]; then
        log_success "acme.sh 已安装：$($HOME/.acme.sh/acme.sh --version)"
    else
        log_warning "Certbot 和 acme.sh 都未安装，将跳过 SSL 证书自动申请"
        log_warning "请稍后手动配置 SSL 证书或使用 acme.sh 申请"
    fi

    # 检查域名解析
    log_info "检查域名解析：$DOMAIN"
    if ! dig +short "$DOMAIN" &> /dev/null; then
        log_warning "域名 $DOMAIN 可能未解析到本机，请确认 DNS 配置"
        read -p "是否继续？(y/n): " confirm
        if [[ "$confirm" != "y" ]]; then
            exit 1
        fi
    else
        log_success "域名解析正常"
    fi

    # 检查端口
    log_info "检查端口占用情况..."
    if sudo lsof -i :80 &> /dev/null; then
        log_success "端口 80 已被占用（Nginx 正常运行）"
    else
        log_warning "端口 80 未被占用，请确认 Nginx 配置"
    fi

    # 如果配置 v2ray，检查 v2ray
    if [[ "$CONFIG_V2RAY" == true ]]; then
        if [[ ! -f "$V2RAY_CONFIG" ]]; then
            log_error "v2ray 配置文件不存在：$V2RAY_CONFIG"
            log_error "请确认 v2ray 已安装，或使用不带 -v 选项的脚本仅部署网关"
            exit 1
        fi
        log_success "v2ray 配置文件存在"
        
        # 备份 v2ray 配置
        log_info "备份 v2ray 配置文件..."
        sudo cp "$V2RAY_CONFIG" "${V2RAY_CONFIG}.bak.$(date +%Y%m%d%H%M%S)"
        log_success "v2ray 配置已备份"
    fi
}

################################################################################
# 函数：创建部署目录
################################################################################
create_deploy_dir() {
    log_info "创建部署目录：$DEPLOY_DIR"
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown "$USER:$USER" "$DEPLOY_DIR"
    log_success "部署目录创建成功"
}

################################################################################
# 函数：生成配置文件
################################################################################
generate_configs() {
    log_info "生成配置文件..."

    # 生成 .env 文件
    if [[ ! -f ".env" ]]; then
        cat > .env << EOF
# HiGPT OpenAI Gateway 环境变量配置
PORT=3000

# 网关 API 密钥（请修改为实际值）
GATEWAY_API_KEY=$(openssl rand -hex 32)

# HiGPT API 配置
HIGPT_BASE_URL=https://inner-apisix.hisense.com/higpt-new/v1
HIGPT_API_KEY=your_higpt_api_key_here
HIGPT_USER_KEY=your_higpt_user_key_here
HIGPT_TIMEOUT_MS=120000
EOF
        log_success ".env 文件已生成（请编辑填写实际的 HIGPT_API_KEY 和 HIGPT_USER_KEY）"
    else
        log_warning ".env 文件已存在，跳过生成"
    fi

    # 生成 local.yaml 文件
    mkdir -p config
    if [[ ! -f "config/local.yaml" ]]; then
        cat > config/local.yaml << EOF
port: 3000
gatewayApiKey: "$(grep GATEWAY_API_KEY .env | cut -d'=' -f2)"
higpt:
  baseUrl: https://inner-apisix.hisense.com/higpt-new/v1
  apiKey: your_higpt_api_key_here
  userKey: your_higpt_user_key_here
  proxyUrl: ""
  timeoutMs: 120000
modelAliases:
  qwen3-5: qwen3-5-397b
  deepseek-v4-pro: deepseek-v4-pro
  higpt: qwen3-5-397b
  deepseek: deepseek-v4-pro
EOF
        log_success "config/local.yaml 文件已生成"
    else
        log_warning "config/local.yaml 文件已存在，跳过生成"
    fi
}

################################################################################
# 函数：配置 v2ray WebSocket
################################################################################
configure_v2ray() {
    log_info "配置 v2ray WebSocket 模式..."
    
    # 读取现有配置中的 UUID 和路由配置
    local UUID=$(sudo grep -o '"id": "[^"]*"' "$V2RAY_CONFIG" | head -1 | cut -d'"' -f4)
    
    if [[ -z "$UUID" ]]; then
        log_error "无法从 v2ray 配置中读取 UUID"
        exit 1
    fi
    
    log_success "读取 v2ray UUID: $UUID"
    
    # 创建新的 v2ray 配置
    sudo tee "$V2RAY_CONFIG" > /dev/null << EOF
{
    "log": {
        "loglevel": "info",
        "access": "/var/log/v2ray/access.log",
        "error": "/var/log/v2ray/error.log"
    },
    "inbounds": [{
        "port": $V2RAY_WS_PORT,
        "listen": "127.0.0.1",
        "protocol": "vmess",
        "settings": {
            "clients": [{
                "id": "$UUID",
                "alterId": 0
            }]
        },
        "streamSettings": {
            "network": "ws",
            "wsSettings": {
                "path": "$V2RAY_WS_PATH"
            }
        }
    }],
    "outbounds": [{
        "protocol": "freedom",
        "tag": "direct"
    }],
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": []
    }
}
EOF

    log_success "v2ray 配置文件已更新"

    # 测试 v2ray 配置
    log_info "测试 v2ray 配置..."
    if sudo v2ray -test -config "$V2RAY_CONFIG" 2>&1 | grep -q "Configuration OK"; then
        log_success "v2ray 配置测试通过"
    else
        log_warning "v2ray 配置测试命令执行失败，尝试继续..."
    fi

    # 重启 v2ray
    log_info "重启 v2ray 服务..."
    if sudo systemctl restart v2ray; then
        log_success "v2ray 服务已重启"
        
        # 检查服务状态
        sleep 2
        if sudo systemctl is-active --quiet v2ray; then
            log_success "v2ray 服务运行正常"
        else
            log_error "v2ray 服务未运行，请检查日志：journalctl -u v2ray"
            exit 1
        fi
    else
        log_error "v2ray 服务重启失败"
        exit 1
    fi
    
    # 检查端口监听
    if sudo ss -tlnp | grep -q ":$V2RAY_WS_PORT"; then
        log_success "v2ray 正在监听 127.0.0.1:$V2RAY_WS_PORT"
    else
        log_warning "v2ray 端口 $V2RAY_WS_PORT 未监听，请检查日志"
    fi
}

################################################################################
# 函数：配置 Nginx
################################################################################
configure_nginx() {
    log_info "配置 Nginx 反向代理..."

    # 创建 Nginx 配置文件
    sudo tee "$NGINX_CONF" > /dev/null << EOF
# HiGPT OpenAI Gateway + v2ray Nginx 配置
# 域名：$DOMAIN

# HTTP 服务器 - 重定向到 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 所有其他请求重定向到 HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HiGPT Gateway 反向代理
    location /higpt/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        
        # 代理头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket 支持
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # 缓冲配置（流式输出需要关闭）
        proxy_buffering off;
        proxy_cache off;
    }

    # 健康检查端点
    location /higpt/health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
EOF

    # 如果配置了 v2ray，添加 v2ray 的 location
    if [[ "$CONFIG_V2RAY" == true ]]; then
        sudo tee -a "$NGINX_CONF" > /dev/null << EOF

    # v2ray WebSocket 路径
    location $V2RAY_WS_PATH {
        proxy_pass http://127.0.0.1:$V2RAY_WS_PORT;
        proxy_http_version 1.1;
        
        # WebSocket ���需头
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 代理头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
EOF
    fi

    # 关闭 server 块
    sudo tee -a "$NGINX_CONF" > /dev/null << EOF
}
EOF

    log_success "Nginx 配置文件已创建：$NGINX_CONF"

    # 测试 Nginx 配置
    log_info "测试 Nginx 配置..."
    local NGINX_CMD=$(get_nginx_cmd)
    if sudo $NGINX_CMD -t; then
        log_success "Nginx 配置测试通过"
    else
        log_error "Nginx 配置测试失败"
        exit 1
    fi

    # 重载 Nginx
    log_info "重载 Nginx..."
    sudo $NGINX_CMD -s reload
    log_success "Nginx 重载成功"
}

################################################################################
# 函数：申请 SSL 证书
################################################################################
request_ssl_certificate() {
    log_info "申请 SSL 证书..."

    # 检查是否有 acme.sh
    if [[ -x "$HOME/.acme.sh/acme.sh" ]]; then
        log_info "使用 acme.sh 申请证书..."
        
        # 创建 webroot 目录
        sudo mkdir -p /var/www/certbot
        sudo chown -R $USER: /var/www/certbot
        
        # 使用 DNS 手动验证模式申请证书
        log_warning "acme.sh 需要使用 DNS 验证，请手动添加 TXT 记录"
        log_info "请参考以下说明手动申请证书："
        echo ""
        echo "1. 执行以下命令生成 DNS 验证信息："
        echo "   $HOME/.acme.sh/acme.sh --issue --dns -d $DOMAIN --yes-I-know-dns-manual-mode-enough-go-ahead-please"
        echo ""
        echo "2. 根据提示添加 DNS TXT 记录"
        echo ""
        echo "3. 验证完成后，证书将保存在：$HOME/.acme.sh/$DOMAIN/"
        echo ""
        echo "4. 然后手动复制证书到 Nginx 配置目录："
        echo "   sudo mkdir -p /etc/letsencrypt/live/$DOMAIN"
        echo "   sudo cp $HOME/.acme.sh/$DOMAIN/*.pem /etc/letsencrypt/live/$DOMAIN/"
        echo ""
        
        # 跳过自动申请，让用户手动完成
        log_warning "SSL 证书申请已跳过，请手动完成"
        return 0
    else
        log_error "未找到 acme.sh，无法申请 SSL 证书"
        exit 1
    fi
}

################################################################################
# 函数：启动 Docker 容器
################################################################################
start_docker_container() {
    log_info "启动 Docker 容器..."

    # 构建并启动
    if docker-compose up -d --build; then
        log_success "Docker 容器启动成功"
    else
        log_error "Docker 容器启动失败"
        exit 1
    fi

    # ���待容器启动
    log_info "等待容器启动..."
    sleep 5

    # 检查容器状态
    if docker ps | grep -q higpt-gateway; then
        log_success "容器运行正常"
    else
        log_error "容器未运行，请查看日志：docker-compose logs"
        exit 1
    fi
}

################################################################################
# 函数：清理回滚
################################################################################
rollback() {
    log_error "部署失败，正在回滚..."

    # 停止容器
    docker-compose down 2>/dev/null || true

    # 恢复 v2ray 配置（如果配置了）
    if [[ "$CONFIG_V2RAY" == true ]]; then
        local backup_file=$(ls -t ${V2RAY_CONFIG}.bak.* 2>/dev/null | head -1)
        if [[ -n "$backup_file" ]]; then
            sudo cp "$backup_file" "$V2RAY_CONFIG"
            sudo systemctl restart v2ray 2>/dev/null || true
            log_info "v2ray 配置已恢复"
        fi
    fi

    # 移除 Nginx 配置
    sudo rm -f "$NGINX_CONF" 2>/dev/null || true
    local NGINX_CMD=$(get_nginx_cmd)
    sudo $NGINX_CMD -s reload 2>/dev/null || true

    log_error "回滚完成"
}

################################################################################
# 函数：显示完成信息
################################################################################
show_completion() {
    echo ""
    log_success "=========================================="
    log_success "部署完成！"
    log_success "=========================================="
    echo ""
    echo "访问地址：https://$DOMAIN/higpt/"
    echo "API 端点：https://$DOMAIN/higpt/v1/chat/completions"
    echo ""
    
    if [[ "$CONFIG_V2RAY" == true ]]; then
        echo "v2ray WebSocket路径：wss://$DOMAIN$V2RAY_WS_PATH"
        echo ""
        echo "v2ray 客户端配置："
        echo "  地址：$DOMAIN"
        echo "  端口：443"
        echo "  协议：vmess"
        echo "  传输：WebSocket"
        echo "  路径：$V2RAY_WS_PATH"
        echo "  安全：tls"
        echo ""
    fi
    
    echo "下一步:"
    echo "  1. 编辑 .env 文件，填写 HIGPT_API_KEY 和 HIGPT_USER_KEY"
    echo "  2. 编辑 config/local.yaml 文件，填写实际的 apiKey 和 userKey"
    echo "  3. 重启容器：docker-compose restart"
    echo "  4. 运行健康检查：sudo ./health-check.sh -d $DOMAIN"
    echo ""
}

################################################################################
# 主函数
################################################################################
main() {
    echo "=========================================="
    echo "HiGPT OpenAI Gateway + v2ray 一键部署脚本"
    echo "=========================================="
    echo ""

    parse_args "$@"

    log_info "部署配置:"
    echo "  域名：$DOMAIN"
    echo "  邮箱：$EMAIL"
    echo "  部署目录：$DEPLOY_DIR"
    echo "  配置 v2ray: $CONFIG_V2RAY"
    echo ""

    # 设置回滚处理器
    trap rollback ERR

    # 执行部署步骤
    check_prerequisites
    create_deploy_dir
    generate_configs
    
    # 如果配置 v2ray，先配置 v2ray
    if [[ "$CONFIG_V2RAY" == true ]]; then
        configure_v2ray
    fi
    
    configure_nginx
    request_ssl_certificate
    start_docker_container

    show_completion
}

# 执行主函数
main "$@"
