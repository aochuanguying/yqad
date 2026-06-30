#!/bin/bash
set -e

echo "🚀 启动 Xvfb 虚拟显示..."
# 启动 Xvfb（虚拟 framebuffer）
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

# 等待 Xvfb 启动
sleep 2

echo "✅ Xvfb 已启动 (DISPLAY=$DISPLAY)"
echo "🌐 启动 Node.js 应用..."

# 设置 NODE_OPTIONS 以支持 ESM 模块的 require()
export NODE_OPTIONS="--experimental-vm-modules"

# 启动应用
exec node dist/index.js
