const axios = require('axios');

async function initChromaDB() {
  console.log('🚀 开始初始化 ChromaDB (使用 v2 API)...\n');

  const chromaUrl = 'http://10.6.0.5:8000';

  try {
    // 1. 测试 v2 API 心跳
    console.log('📝 步骤 1: 检查 ChromaDB 连接 (v2 API)...');
    try {
      const heartbeat = await axios.get(`${chromaUrl}/api/v2/heartbeat`, { timeout: 5000 });
      console.log('✅ ChromaDB v2 API 连接成功');
      console.log(`   状态：${JSON.stringify(heartbeat.data)}\n`);
    } catch (error) {
      console.log('⚠️  ChromaDB v2 API 无法访问');
      console.log(`   错误：${error.message}\n`);
      return;
    }

    // 2. 获取所有 Collections（v2 API）
    console.log('📝 步骤 2: 检查现有 Collections...');
    try {
      const collectionsResponse = await axios.get(`${chromaUrl}/api/v2/collections`, { timeout: 5000 });
      const collections = collectionsResponse.data;
      
      if (collections && collections.length > 0) {
        console.log(`✅ 发现 ${collections.length} 个现有 Collections:`);
        collections.forEach(c => {
          console.log(`   - ${c.name}`);
        });
      } else {
        console.log('ℹ️  暂无 Collections');
      }
      console.log('');
    } catch (error) {
      console.log('⚠️  无法获取 Collections 列表');
      console.log(`   错误：${error.message}\n`);
    }

    // 3. 创建生产环境 Collections（v2 API）
    console.log('📝 步骤 3: 创建生产环境 Collections (v2 API)...');
    
    const collections = [
      'prod:materials',
      'prod:content_dedup',
      'prod:topic_recommend',
      'prod:sensitive_variants',
      'prod:comment_sentiment'
    ];

    let created = 0;
    let skipped = 0;

    for (const collectionName of collections) {
      try {
        // 检查是否已存在
        try {
          await axios.get(`${chromaUrl}/api/v2/collections/${collectionName}`, { timeout: 5000 });
          console.log(`ℹ️  Collection "${collectionName}" 已存在，跳过`);
          skipped++;
          continue;
        } catch (error) {
          // Collection 不存在，继续创建
        }

        // 创建 Collection（v2 API）
        await axios.post(`${chromaUrl}/api/v2/collections`, {
          name: collectionName,
          metadata: {
            description: `Production collection for ${collectionName}`,
            'hnsw:space': 'cosine'
          }
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        console.log(`✅ Collection "${collectionName}" 创建成功`);
        created++;
      } catch (error) {
        console.log(`⚠️  Collection "${collectionName}" 创建失败：${error.response?.data?.message || error.message}`);
      }
    }
    console.log('');

    console.log('==========================================');
    console.log('✅ ChromaDB 初始化完成！');
    console.log('==========================================');
    console.log('');
    console.log('📊 统计:');
    console.log(`   - 新创建：${created} 个`);
    console.log(`   - 已存在：${skipped} 个`);
    console.log(`   - 失败：${5 - created - skipped} 个`);
    console.log('');
    console.log('📦 Collections 列表:');
    console.log('   - prod:materials（素材向量）');
    console.log('   - prod:content_dedup（内容去重）');
    console.log('   - prod:topic_recommend（主题推荐）');
    console.log('   - prod:sensitive_variants（敏感变体）');
    console.log('   - prod:comment_sentiment（评论情感）');
    console.log('');
    console.log('🎉 ChromaDB 已完全就绪！');
    console.log('');

  } catch (error) {
    console.error('❌ ChromaDB 初始化失败:', error.message);
    throw error;
  }
}

initChromaDB().catch(console.error);
