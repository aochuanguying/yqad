#!/bin/bash
# ============================================================
# ChromaDB 初始化脚本
# ============================================================
# 功能：
# 1. 等待 ChromaDB 服务启动
# 2. 创建生产环境 Collections（带 prod: 前缀）
# 3. 验证 Collections 创建成功
# ============================================================

CHROMADB_URL="http://chromadb:8000"
PREFIX="prod:"

echo "🚀 开始初始化 ChromaDB..."

# 等待 ChromaDB 启动
echo "⏳ 等待 ChromaDB 服务启动..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f "$CHROMADB_URL/api/v1/heartbeat" > /dev/null 2>&1; then
        echo "✅ ChromaDB 服务已就绪"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   第 $RETRY_COUNT 次尝试..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ ChromaDB 服务启动超时，跳过初始化"
    exit 1
fi

# 定义 Collections
# 向量维度：1536（OpenAI Embedding）
# 距离函数：cosine
COLLECTIONS=(
    "${PREFIX}materials"
    "${PREFIX}content_dedup"
    "${PREFIX}topic_recommend"
    "${PREFIX}sensitive_variants"
    "${PREFIX}comment_sentiment"
)

# 创建 Collections
echo "📊 创建生产环境 Collections..."

for COLLECTION in "${COLLECTIONS[@]}"; do
    echo "   创建 Collection: $COLLECTION"
    
    # 检查是否已存在
    EXISTS=$(curl -s -w "%{http_code}" -o /dev/null "$CHROMADB_URL/api/v1/collections/$COLLECTION")
    
    if [ "$EXISTS" = "200" ]; then
        echo "   ℹ️  Collection '$COLLECTION' 已存在，跳过"
    else
        # 创建 Collection
        RESPONSE=$(curl -s -X POST "$CHROMADB_URL/api/v1/collections" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"$COLLECTION\",
                \"metadata\": {
                    \"description\": \"Production collection for $COLLECTION\",
                    \"dimension\": 1536,
                    \"distance_function\": \"cosine\"
                }
            }")
        
        if echo "$RESPONSE" | grep -q "\"name\":\"$COLLECTION\""; then
            echo "   ✅ Collection '$COLLECTION' 创建成功"
        else
            echo "   ⚠️  Collection '$COLLECTION' 创建可能失败：$RESPONSE"
        fi
    fi
done

echo ""
echo "✅ ChromaDB 初始化完成"
echo ""
echo "📊 Collections 列表:"
curl -s "$CHROMADB_URL/api/v1/collections" | grep -o '"name":"[^"]*"' | sed 's/"name":"/   - /g' | sed 's/"//g'
echo ""
