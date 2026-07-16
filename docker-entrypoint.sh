#!/bin/bash
set -e

echo "🚀 启动 Xvfb 虚拟显示..."

# 清理旧的 Xvfb 锁文件（防止容器重启失败）
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

# 启动 Xvfb（虚拟 framebuffer）
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

# 等待 Xvfb 启动
sleep 2

echo "✅ Xvfb 已启动 (DISPLAY=$DISPLAY)"

# 设置 NODE_OPTIONS 以支持 ESM 模块的 require() 和禁用 stdout 缓冲
export NODE_OPTIONS="--experimental-vm-modules --no-deprecation"

# 设置时区
export TZ=Asia/Shanghai

# 禁用 Node.js 输出缓冲
export PYTHONUNBUFFERED=1

echo "🌐 启动 Node.js 应用..."
echo "📋 发帖日志清理服务将自动运行（每 10 分钟清理一次）"
echo "📋 待确认发帖清理服务将自动运行（每 10 分钟清理一次）"

# 启动应用（使用 unbuffer 或直接启动）
exec node dist/index.js 2>&1
