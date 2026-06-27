#!/bin/bash

################################################################################
# HiGPT OpenAI Gateway 健康检查脚本
# 用途：验证部署是否成功，检查各组件状态
################################################################################

set -e  # 遇到错误立即退出（但我们会捕获）

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0
WARNINGS=0

# 日志函数
log_pass() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1"
    ((WARNINGS++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# 配置
DEPLOY_DIR="/opt/higpt-gateway"
DOMAIN=""
GATEWAY_API_KEY=""

################################################################################
# 函数：显示使用说明
################################################################################
show_usage() {
    cat << EOF
用法：$0 -d <域名> [-k <API 密钥>]

选项:
    -d, --domain    域名（必填），如：higpt.example.com
    -k, --apikey    网关 API 密钥（可选，默认从 .env 读取）
    -h, --help      显示此帮助信息

示例:
    $0 -d higpt.example.com
    $0 -d higpt.example.com -k your_api_key_here

EOF
    exit 1
}

################################################################################
# 函数：解析命令行参数
################################################################################
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -k|--apikey)
                GATEWAY_API_KEY="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                ;;
            *)
                log_fail "未知选项：$1"
                show_usage
                ;;
        esac
    done

    if [[ -z "$DOMAIN" ]]; then
        log_fail "域名为必填参数"
        show_usage
    fi
}

################################################################################
# 检查 1: Docker 容器状态
################################################################################
check_docker_container() {
    log_info "检查 1: Docker 容器状态..."

    if docker ps | grep -q higpt-gateway; then
        local status=$(docker inspect -f '{{.State.Status}}' higpt-gateway 2>/dev/null)
        if [[ "$status" == "running" ]]; then
            log_pass "容器 higpt-gateway 运行中"
        else
            log_fail "容器 higpt-gateway 状态异常：$status"
        fi
    else
        log_fail "容器 higpt-gateway 未运行"
    fi
}

################################################################################
# 检查 2: Nginx 配置
################################################################################
check_nginx() {
    log_info "检查 2: Nginx 配置..."

    # 检查 Nginx 进程
    if pgrep -x nginx > /dev/null; then
        log_pass "Nginx 进程运行中"
    else
        log_fail "Nginx 进程未运行"
        return
    fi

    # 检查配置文件
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        log_pass "Nginx 配置测试通过"
    else
        log_fail "Nginx 配置测试失败"
    fi

    # 检查 HigPT 配置是否存在
    if sudo grep -q "higpt" /etc/nginx/conf.d/higpt-gateway.conf 2>/dev/null; then
        log_pass "HiGPT Nginx 配置存在"
    else
        log_fail "HiGPT Nginx 配置不存在"
    fi
}

################################################################################
# 检查 3: SSL 证书
################################################################################
check_ssl_certificate() {
    log_info "检查 3: SSL 证书..."

    local cert_file="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

    # 检查证书文件
    if [[ -f "$cert_file" ]]; then
        log_pass "SSL 证书文件存在"

        # 检查证书有效期
        local expiry_date=$(sudo openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null)
        local now_epoch=$(date +%s)
        local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

        if [[ $days_left -gt 30 ]]; then
            log_pass "SSL 证书有效期充足：剩余 $days_left 天 (过期时间：$expiry_date)"
        elif [[ $days_left -gt 0 ]]; then
            log_warn "SSL 证书即将过期：剩余 $days_left 天 (过期时间：$expiry_date)"
        else
            log_fail "SSL 证书已过期 (过期时间：$expiry_date)"
        fi
    else
        log_fail "SSL 证书文件不存在：$cert_file"
    fi

    # 检查自动续期配置
    if sudo grep -q "certbot renew" /etc/crontab; then
        log_pass "SSL 证书自动续期已配置"
    else
        log_warn "SSL 证书自动续期未配置"
    fi
}

################################################################################
# 检查 4: 本地 API 连通性
################################################################################
check_local_api() {
    log_info "检查 4: 本地 API 连通性..."

    # 测试本地端点
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null || echo "000")

    if [[ "$response" == "200" ]]; then
        log_pass "本地 API 健康检查通过 (HTTP $response)"
    else
        log_fail "本地 API 健康检查失败 (HTTP $response)"
    fi
}

################################################################################
# 检查 5: HTTPS API 测试
################################################################################
check_https_api() {
    log_info "检查 5: HTTPS API 测试..."

    if [[ -z "$GATEWAY_API_KEY" ]]; then
        # 尝试从 .env 文件读取
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            GATEWAY_API_KEY=$(grep GATEWAY_API_KEY "$DEPLOY_DIR/.env" | cut -d'=' -f2 | tr -d '[:space:]')
        fi
    fi

    if [[ -z "$GATEWAY_API_KEY" ]]; then
        log_warn "缺少 API 密钥，跳过 API 功能测试"
        return
    fi

    # 测试 API 端点
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $GATEWAY_API_KEY" \
        "https://$DOMAIN/higpt/health" 2>/dev/null || echo "000")

    if [[ "$response" == "200" ]]; then
        log_pass "HTTPS API 健康检查通过 (HTTP $response)"
    else
        log_fail "HTTPS API 健康检查失败 (HTTP $response)"
    fi

    # 测试实际 API 请求（可选）
    log_info "执行 API 请求测试..."
    local test_response=$(curl -s -X POST \
        -H "Authorization: Bearer $GATEWAY_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "higpt",
            "messages": [{"role": "user", "content": "你好"}],
            "max_tokens": 10
        }' \
        "https://$DOMAIN/higpt/v1/chat/completions" 2>/dev/null || echo "{}")

    if echo "$test_response" | grep -q "choices"; then
        log_pass "API 功能测试通过"
    else
        log_fail "API 功能测试失败"
        log_info "响应内容：$test_response"
    fi
}

################################################################################
# 检查 6: 域名解析
################################################################################
check_dns() {
    log_info "检查 6: 域名解析..."

    local ip=$(dig +short "$DOMAIN" 2>/dev/null)

    if [[ -n "$ip" ]]; then
        log_pass "域名解析正常：$DOMAIN -> $ip"
    else
        log_fail "域名解析失败：$DOMAIN"
    fi
}

################################################################################
# 检查 7: 磁盘空间
################################################################################
check_disk_space() {
    log_info "检查 7: 磁盘空间..."

    local usage=$(df "$DEPLOY_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')

    if [[ -n "$usage" ]]; then
        if [[ $usage -lt 80 ]]; then
            log_pass "磁盘空间充足：已使用 ${usage}%"
        elif [[ $usage -lt 90 ]]; then
            log_warn "磁盘空间紧张：已使用 ${usage}%"
        else
            log_fail "磁盘空间不足：已使用 ${usage}%"
        fi
    else
        log_warn "无法检查磁盘空间"
    fi
}

################################################################################
# 显示总结
################################################################################
show_summary() {
    echo ""
    echo "=========================================="
    echo "健康检查总结"
    echo "=========================================="
    echo -e "${GREEN}通过：$PASSED${NC}"
    echo -e "${RED}失败：$FAILED${NC}"
    echo -e "${YELLOW}警告：$WARNINGS${NC}"
    echo ""

    if [[ $FAILED -eq 0 ]]; then
        echo -e "${GREEN}✓ 所有检查通过！部署正常。${NC}"
        exit 0
    else
        echo -e "${RED}✗ 存在 $FAILED 项失败，请检查日志。${NC}"
        exit 1
    fi
}

################################################################################
# 主函数
################################################################################
main() {
    echo "=========================================="
    echo "HiGPT OpenAI Gateway 健康检查"
    echo "域名：$DOMAIN"
    echo "=========================================="
    echo ""

    parse_args "$@"

    # 执行所有检查
    check_docker_container
    check_nginx
    check_ssl_certificate
    check_dns
    check_local_api
    check_https_api
    check_disk_space

    # 显示总结
    show_summary
}

# 执行主函数
main "$@"
