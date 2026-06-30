#!/bin/bash

# 设置小红书 Cookie 自动刷新定时任务
# 每天凌晨 2 点自动刷新 Cookie

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_SCRIPT="$SCRIPT_DIR/auto_refresh_xiaohongshu_cookie.py"
LOG_FILE="$SCRIPT_DIR/cookie_refresh.log"

# 检查 Python 和 Playwright 是否已安装
echo "🔍 检查环境..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python3"
    exit 1
fi

# 检查 playwright 是否安装
if ! python3 -c "import playwright" 2>/dev/null; then
    echo "⚠️  Playwright 未安装，开始安装..."
    python3 -m pip install playwright
    echo "🌐 安装浏览器..."
    python3 -m playwright install chromium
fi

# 检查 mysql-connector 是否安装
if ! python3 -c "import mysql.connector" 2>/dev/null; then
    echo "⚠️  mysql-connector-python 未安装，开始安装..."
    python3 -m pip install mysql-connector-python
fi

echo "✅ 环境检查完成"

# 创建日志文件
touch "$LOG_FILE"

# 添加定时任务
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && /usr/bin/python3 $PYTHON_SCRIPT >> $LOG_FILE 2>&1"

echo ""
echo "📋 将要添加的定时任务:"
echo "$CRON_JOB"
echo ""
echo "💡 这个定时任务会每天凌晨 2 点自动运行 Cookie 刷新脚本"
echo ""
read -p "是否继续添加定时任务？(y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 检查是否已存在相同的定时任务
    if crontab -l 2>/dev/null | grep -q "$PYTHON_SCRIPT"; then
        echo "⚠️  检测到已存在相同的定时任务"
        read -p "是否删除旧的定时任务并重新添加？(y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # 删除旧的定时任务
            crontab -l 2>/dev/null | grep -v "$PYTHON_SCRIPT" | crontab -
            echo "✅ 已删除旧的定时任务"
        else
            echo "❌ 取消操作"
            exit 1
        fi
    fi
    
    # 添加新的定时任务
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ 定时任务添加成功!"
    echo ""
    echo "📋 当前的定时任务列表:"
    crontab -l
    echo ""
    echo "💡 提示:"
    echo "  - 查看日志：tail -f $LOG_FILE"
    echo "  - 手动测试：python3 $PYTHON_SCRIPT"
    echo "  - 编辑定时任务：crontab -e"
    echo "  - 删除定时任务：crontab -r"
else
    echo "❌ 已取消添加定时任务"
    echo ""
    echo "💡 你可以稍后手动运行:"
    echo "   python3 $PYTHON_SCRIPT"
fi
