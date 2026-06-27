#!/bin/bash

echo "========================================="
echo "开始全面迁移和优化"
echo "========================================="

cd /Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000\ Workspace/yqad

echo ""
echo "Step 1: 删除冗余文件..."
rm -f data/topics.json data/material-records.json
echo "✓ topics.json 和 material-records.json 已删除"

echo ""
echo "Step 2: 清理编译产物..."
rm -rf dist synology-deploy-root/app/dist
echo "✓ dist 目录已清理"

echo ""
echo "Step 3: 重新编译..."
npm run build
echo "✓ 编译完成"

echo ""
echo "Step 4: 安装依赖..."
npm install
echo "✓ 依赖安装完成"

echo ""
echo "Step 5: 启动服务..."
npm start

echo ""
echo "========================================="
echo "迁移完成！"
echo "========================================="
