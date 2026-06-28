#!/bin/bash

# 多平台互联网参考功能部署脚本
# 功能：部署数据库迁移、上传 AutoJS 脚本、重启服务

set -e

echo "=========================================="
echo "多平台互联网参考功能部署"
echo "=========================================="
echo ""

# 1. 运行数据库迁移
echo "📦 步骤 1: 运行数据库迁移..."
cd /Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000\ Workspace/yqad
npm run migrate
echo "✅ 数据库迁移完成"
echo ""

# 2. 上传 AutoJS 脚本到手机（如果连接了 ADB）
echo "📱 步骤 2: 检查 ADB 连接..."
if command -v adb &> /dev/null; then
    if adb devices | grep -q "device$"; then
        echo "检测到 ADB 设备，上传 AutoJS 脚本..."
        
        # 创建脚本目录
        adb shell "mkdir -p /sdcard/脚本"
        
        # 上传脚本
        adb push autojs-scripts/audi_search_weibo.js /sdcard/脚本/audi_search_weibo.js
        adb push autojs-scripts/audi_search_zhihu.js /sdcard/脚本/audi_search_zhihu.js
        adb push autojs-scripts/audi_search_autohome.js /sdcard/脚本/audi_search_autohome.js
        
        echo "✅ AutoJS 脚本上传完成"
        echo "   - audi_search_weibo.js"
        echo "   - audi_search_zhihu.js"
        echo "   - audi_search_autohome.js"
    else
        echo "⚠️  未检测到 ADB 设备，跳过脚本上传"
        echo "   请手动将 autojs-scripts/ 目录下的脚本上传到手机"
    fi
else
    echo "⚠️  未安装 ADB，跳过脚本上传"
    echo "   请手动将 autojs-scripts/ 目录下的脚本上传到手机"
fi
echo ""

# 3. 重启服务
echo "🔄 步骤 3: 重启服务..."
if command -v pm2 &> /dev/null; then
    pm2 restart yqad
    echo "✅ 服务已重启"
else
    echo "⚠️  未检测到 PM2，请手动重启服务"
fi
echo ""

# 4. 验证部署
echo "🔍 步骤 4: 验证部署..."
echo "查看日志命令："
echo "  pm2 logs yqad | grep '选择平台'"
echo ""
echo "预期输出："
echo "  选择平台：微博 (优先级：8, 脚本：audi_search_weibo.js)"
echo "  选择平台：知乎 (优先级：8, 脚本：audi_search_zhihu.js)"
echo "  选择平台：汽车之家 (优先级：7, 脚本：audi_search_autohome.js)"
echo ""

echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "📋 下一步操作："
echo "1. 查看服务日志，确认平台轮询正常"
echo "2. 测试发帖功能，验证互联网参考查询"
echo "3. 检查发帖日志，确认来源平台标记正确"
echo ""
echo "📊 平台配置："
echo "  - 小红书：优先级 10, 权重 1.00"
echo "  - 微博：优先级 8, 权重 0.80"
echo "  - 知乎：优先级 8, 权重 0.80"
echo "  - 汽车之家：优先级 7, 权重 0.60"
echo ""
echo "📈 频率限制："
echo "  - 总频率：43 次/小时（所有启用平台）"
echo "  - 单个平台：8-15 次/小时"
echo ""
