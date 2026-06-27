const axios = require('axios');

async function initChromaDB() {
  console.log('🚀 开始初始化 ChromaDB...');
  console.log('');

  // 尝试不同的可能地址
  const urls = [
    'http://10.6.0.5:8000',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
  ];

  let chromaUrl = null;

  // 检查哪个地址可用
  console.log('📝 步骤 1: 检查 ChromaDB 连接...');
  for (const url of urls) {
    try {
      const heartbeat = await axios.get(`${url}/api/v1/heartbeat`, { timeout: 3000 });
      console.log(`✅ ChromaDB 连接成功：${url}`);
      console.log(`   状态：${JSON.stringify(heartbeat.data)}`);
      chromaUrl = url;
      break;
    } catch (error) {
      console.log(`⚠️  ${url} 不可用：${error.message}`);
    }
  }

  if (!chromaUrl) {
    console.log('❌ 无法连接到 ChromaDB，请确认服务已启动');
    return;
  }
  console.log('');

  // 列出所有现有 Collections
  console.log('📝 步骤 2: 检查现有 Collections...');
  try {
    const collectionsResponse = await axios.get(`${chromaUrl}/api/v1/collections`);
    const collections = collectionsResponse.data;
    
    if (collections && collections.length > 0) {
      console.log(`✅ 发现 ${collections.length} 个现有 Collections:`);
      collections.forEach(c => {
        console.log(`   - ${c.name || c}`);
      });
    } else {
      console.log('ℹ️  暂无 Collections');
    }
    console.log('');
  } catch (error) {
    console.log('⚠️  无法获取 Collections 列表');
    console.log('');
  }

  // 创建生产环境 Collections
  console.log('📝 步骤 3: 创建生产环境 Collections...');
  
  const collections = [
    'prod:materials',
    'prod:content_dedup',
    'prod:topic_recommend',
    'prod:sensitive_variants',
    'prod:comment_sentiment'
  ];

  let created = 0;
  let skipped = 0;

  for (const collection of collections) {
    try {
      // 检查是否已存在
      try {
        await axios.get(`${chromaUrl}/api/v1/collections/${collection}`);
        console.log(`ℹ️  Collection "${collection}" 已存在，跳过`);
        skipped++;
        continue;
      } catch (error) {
        // Collection 不存在，继续创建
      }

      // 创建 Collection
      const response = await axios.post(`${chromaUrl}/api/v1/collections`, {
        name: collection,
        metadata: {
          description: `Production collection for ${collection}`,
          dimension: 1536,
          distance_function: 'cosine'
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Collection "${collection}" 创建成功`);
      created++;
    } catch (error) {
      console.log(`⚠️  Collection "${collection}" 创建失败：${error.response?.data?.message || error.message}`);
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
  console.log('   - prod:comment_sentiment（评论情感���');
  console.log('');
}

initChromaDB().catch(console.error);
