#!/bin/sh
# ============================================================
# Redis 初始化脚本
# ============================================================
# 功能：
# 1. 生成默认 API Token
# 2. 初始化车辆 Token（基于现有生产数据）
# 3. 初始化 API Token（基于现有生产数据）
# 4. 设置生产环境标识
# ============================================================

echo "🚀 开始初始化 Redis..."

# 设置环境前缀
PREFIX="prod:"

# ============================================================
# 1. 生成默认 API Token（如果不存在）
# ============================================================
API_TOKEN_KEY="${PREFIX}api:token"

# 检查是否已存在 Token
EXISTING_TOKEN=$(redis-cli GET "$API_TOKEN_KEY")

if [ -z "$EXISTING_TOKEN" ]; then
    # 使用现有生产环境的 Token（基于 /Volumes/docker/yqad/data/api-token.json）
    EXISTING_PROD_TOKEN="api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2"
    
    # 存储现有 Token
    redis-cli SET "$API_TOKEN_KEY" "$EXISTING_PROD_TOKEN"
    
    echo "✅ 使用现有 API Token: $EXISTING_PROD_TOKEN"
    echo "   来源：/Volumes/docker/yqad/data/api-token.json"
else
    echo "ℹ️  API Token 已存在，跳过生成"
fi

# ============================================================
# 2. 初始化车辆 Token（基于现有生产数据）
# ============================================================
VEHICLE_TOKEN_KEY="${PREFIX}vehicle:token"

# 检查是否已存在
EXISTING_VEHICLE_TOKEN=$(redis-cli GET "$VEHICLE_TOKEN_KEY")

if [ -z "$EXISTING_VEHICLE_TOKEN" ]; then
    # 使用现有生产环境的车辆 Token（基于 /Volumes/docker/yqad/data/token.json）
    VEHICLE_TOKEN="eyJraWQiOiI3ODEwNzM4Mi1mZTQ0LTQ5YWItOTQ4My00N2EzZTFlNzYzMjAiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIzMzk0NjgzMSIsInNjcCI6Im9wZW5pZCBwcm9maWxlIGF1ZGkiLCJ2ZXIiOiIwLjAuMSIsImFtciI6InB3ZCIsImNvciI6IkNOIiwiaXNzIjoiaHR0cHM6Ly9hdWRpaWRwLmZhdy12dy5jb20iLCJjY2MiOiJXRUNIQVQiLCJ0eXAiOiJBVCIsInR5cGUiOiJBVCIsImlkdC1pZCI6IjNkMmQxOTBiLTdiOWYtNDFmNi1iODljLWYyNzA5MjIxNzExYiIsImF1ZCI6WyJWV0dNQkIwMUNOTElWMSIsIjg4OTAxMzI1NDEyMzMwMDEyIl0sImF6cCI6IldFQ0hBVCIsImFwcGtleSI6IjEwNzI5ODkyIiwidG50IjoiQVVESV9XRUNIQVRfSEwtMDAxXzg4OTAxMzI1NDEyMzMwMDEyX0FuZHJvaWQgOS4wX3YxLjAiLCJleHAiOjE3ODIyNzA4MjgsImFpZCI6IjMzOTQ2ODMxIiwiaWF0IjoxNzgxOTcwODI4LCJydC1pZCI6ImNjNzNkMWQ0LTg2NjktNDY2Mi05NWYzLWU2YzVmMGJiNjMyMiIsImp0aSI6IjhkNGU0M2ZiLWZhOWQtNDI0YS1iOTY4LTQ3OTEzODc0MGYxZiJ9.A1vCtxejrcsyL0n1GYZQuMSbJuh0ewoDYGLTvbhqnQBKrrdrmzIQz2Lb1Jci3bU2H-mLqyW46Ik3GZi7PTjYrsgOQPQD7-xAvKvgOt0i8wDc71Gc4zgvvNCkp3oekdxNBAYb0NvQ03Sr9rrNQKkNaGC0cU9RySeS0laUPUfWNcUNOkxkYKvIMZFVs7b8BDzD0PA4ahnBz2xyzCXsGt5wi1Hzka7dWy-lWlYsEYtYG0iYZMGPZ1eRq2onxmIo3IVfVmu5QbG2sjS3v3EMC2O8qXdOUhrpjy4fCIOJFeXDzIcdp4BIxRmFdJMz9zr7DXoilwXLvP81Fin0YfbpLnb13g"
    
    # 存储车辆 Token
    redis-cli SET "$VEHICLE_TOKEN_KEY" "$VEHICLE_TOKEN"
    
    echo "✅ 使用现有车辆 Token"
    echo "   来源：/Volumes/docker/yqad/data/token.json"
    echo "   过期时间：2026-10-22"
else
    echo "ℹ️  车辆 Token 已存在，跳过生成"
fi

# ============================================================
# 3. 初始化 Home Assistant Token
# ============================================================
HA_TOKEN_KEY="${PREFIX}ha:token"

EXISTING_HA_TOKEN=$(redis-cli GET "$HA_TOKEN_KEY")

if [ -z "$EXISTING_HA_TOKEN" ]; then
    # 使用现有生产环境的 HA Token（基于 default.yaml）
    HA_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3OWY2OGIxZmVjZGY0NTE3YjE2ZDI5NjgxN2I0ODJjYyIsImlhdCI6MTc4MTQ4Mzc4MiwiZXhwIjoyMDk2ODQzNzgyfQ.B4MZVRCLwc6w3cvftSNJWW2ZyzZY5jmj1NRcefnj-2g"
    
    redis-cli SET "$HA_TOKEN_KEY" "$HA_TOKEN"
    
    echo "✅ 使用现有 Home Assistant Token"
else
    echo "ℹ️  Home Assistant Token 已存在，跳过生成"
fi

# ============================================================
# 4. 初始化生产环境标识
# ============================================================
redis-cli SET "${PREFIX}env:production" "true"
redis-cli SET "${PREFIX}env:init_time" "$(date +%Y-%m-%d_%H:%M:%S)"
redis-cli SET "${PREFIX}env:data_source" "/Volumes/docker/yqad/data"

echo ""
echo "✅ Redis 初始化完成"
echo ""
echo "📊 Redis 信息:"
echo "   - 环境：Production"
echo "   - DB: 1"
echo "   - Key 前缀：${PREFIX}"
echo ""
echo "📦 已初始化的 Token:"
echo "   - API Token: 已设置（基于现有生产数据）"
echo "   - 车辆 Token: 已设置（基于现有生产数据）"
echo "   - HA Token: 已设置（基于现有生产数据）"
echo ""
