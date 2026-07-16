#!/bin/bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_success "Docker 环境检查通过"
}

# 检查配置文件
check_config() {
    if [ ! -f "config/default.yaml" ]; then
        print_warning "配置文件不存在，创建示例配置..."
        mkdir -p config
        if [ -f "config.yaml.example" ]; then
            cp config.yaml.example config/default.yaml
            print_success "配置文件已创建，请编辑 config/default.yaml 修改配置"
        else
            print_error "找不到配置示例文件 config.yaml.example"
            exit 1
        fi
    fi
}

# 构建应用
build_app() {
    print_info "开始构建应用..."
    
    if [ ! -d "dist" ]; then
        print_info "编译 TypeScript 代码..."
        npm run build
    fi
    
    print_success "应用构建完成"
}

# 部署到 Docker
deploy_docker() {
    local env=${1:-prod}
    
    print_info "部署到 Docker 环境：$env"
    
    case $env in
        dev)
            docker-compose -f docker-compose.dev.yml up -d --build
            ;;
        prod)
            docker-compose -f docker-compose.prod.yml up -d --build
            ;;
        *)
            docker-compose up -d --build
            ;;
    esac
    
    print_success "部署完成"
}

# 查看日志
view_logs() {
    local service=${1:-yqad}
    
    print_info "查看 $service 服务日志（按 Ctrl+C 退出）..."
    docker-compose logs -f $service
}

# 停止服务
stop_services() {
    print_info "停止所有服务..."
    docker-compose -f docker-compose.prod.yml down
    print_success "服务已停止"
}

# 重启服务
restart_services() {
    print_info "重启所有服务..."
    docker-compose -f docker-compose.prod.yml restart
    print_success "服务已重启"
}

# 显示帮助
show_help() {
    echo "用法：$0 [命令]"
    echo ""
    echo "命令:"
    echo "  build       构建应用"
    echo "  deploy      部署到 Docker（默认：生产环境）"
    echo "  deploy-dev  部署到开发环境"
    echo "  deploy-prod 部署到生产环境"
    echo "  logs        查看日志"
    echo "  stop        停止服务"
    echo "  restart     重启服务"
    echo "  status      查看服务状态"
    echo "  clean       清理容器和镜像"
    echo "  help        显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 build          # 只构建应用"
    echo "  $0 deploy         # 部署到生产环境"
    echo "  $0 deploy-dev     # 部署到开发环境"
    echo "  $0 logs           # 查看主应用日志"
    echo "  $0 logs yqad      # 查看主应用日志"
    echo "  $0 logs xiaohongshu-cookie-refresh  # 查看 Cookie 刷新日志"
    echo ""
}

# 显示服务状态
show_status() {
    print_info "服务状态:"
    docker-compose -f docker-compose.prod.yml ps
}

# 清理容器和镜像
clean() {
    print_warning "此操作将删除所有容器和镜像，确认吗？(y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_info "清理容器..."
        docker-compose -f docker-compose.prod.yml down
        print_info "清理悬空镜像..."
        docker image prune -f
        print_success "清理完成"
    else
        print_info "取消清理"
    fi
}

# 主函数
main() {
    local command=${1:-help}
    
    case $command in
        build)
            check_docker
            check_config
            build_app
            ;;
        deploy)
            check_docker
            check_config
            build_app
            deploy_docker prod
            print_info "使用 'docker-compose logs -f' 查看日志"
            ;;
        deploy-dev)
            check_docker
            check_config
            build_app
            deploy_docker dev
            print_info "使用 'docker-compose -f docker-compose.dev.yml logs -f' 查看日志"
            ;;
        deploy-prod)
            check_docker
            check_config
            build_app
            deploy_docker prod
            print_info "使用 'docker-compose -f docker-compose.prod.yml logs -f' 查看日志"
            ;;
        logs)
            view_logs "${2:-yqad}"
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令：$command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
