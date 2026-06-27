#!/usr/bin/env node
/**
 * 生产环境 ChromaDB 初始化脚本
 * 
 * 功能：
 * 1. 连接到 ChromaDB 服务
 * 2. 创建必要的 Collection（素材向量、内容去重等）
 * 3. 验证 Collection 创建成功
 * 
 * 使用方法：
 *   node scripts/prod-init-chromadb.js
 * 
 * 环境变量：
 *   CHROMADB_HOST - ChromaDB 主机地址（默认：localhost）
 *   CHROMADB_PORT - ChromaDB 端口（默认：8000）
 *   CHROMADB_URL - 完整 URL（可选，覆盖 HOST 和 PORT）
 */

const { ChromaClient } = require('chromadb');

// 配置
const config = {
  host: process.env.CHROMADB_HOST || 'localhost',
  port: parseInt(process.env.CHROMADB_PORT || '8000'),
  url: process.env.CHROMADB_URL,
};

// 构建访问 URL
const chromaUrl = config.url || `http://${config.host}:${config.port}`;

console.log('🚀 开始初始化 ChromaDB...');
console.log(`📡 ChromaDB 地址：${chromaUrl}`);
console.log('');

/**
 * 初始化 ChromaDB 客户端
 */
async function initChromaClient() {
  try {
    const chroma = new ChromaClient({
      path: chromaUrl,
    });

    // 测试连接
    const collections = await chroma.listCollections();
    console.log('✅ ChromaDB 连接成功');
    console.log(`   现有 Collection 数量：${collections.length}`);
    if (collections.length > 0) {
      console.log(`   现有 Collection: ${collections.map(c => c.name).join(', ')}`);
    }
    console.log('');

    return chroma;
  } catch (error) {
    console.error('❌ ChromaDB 连接失败');
    console.error(`   错误信息：${error.message}`);
    console.error('');
    console.error('请检查：');
    console.error('   1. ChromaDB 服务是否已启动');
    console.error('   2. CHROMADB_HOST 和 CHROMADB_PORT 环境变量是否正确');
    console.error('   3. 网络连接是否正常');
    console.error('');
    throw error;
  }
}

/**
 * 创建素材向量 Collection
 * 用于素材相似度搜索和推荐
 */
async function createMaterialsCollection(chroma) {
  const collectionName = 'materials';
  const collectionDesc = 'Material embeddings for similarity search and recommendation';
  
  try {
    // 尝试获取现有 Collection
    try {
      const existing = await chroma.getCollection({ name: collectionName });
      console.log(`⚠️  Collection "${collectionName}" 已存在，跳过创建`);
      return existing;
    } catch (error) {
      // Collection 不存在，继续创建
    }

    // 创建 Collection
    const collection = await chroma.createCollection({
      name: collectionName,
      metadata: {
        description: collectionDesc,
        dimension: 512, // 根据使用的 embedding 模型调整（如 ResNet50: 2048, BGE: 1024）
        distance_function: 'cosine', // 余弦相似度
      },
    });

    console.log(`✅ Collection "${collectionName}" 创建成功`);
    console.log(`   描述：${collectionDesc}`);
    console.log(`   距离函数：cosine`);
    console.log('');

    return collection;
  } catch (error) {
    console.error(`❌ 创建 Collection "${collectionName}" 失败`);
    console.error(`   错误信息：${error.message}`);
    console.error('');
    throw error;
  }
}

/**
 * 创建内容去重 Collection
 * 用于发帖内容去重检测
 */
async function createContentDedupCollection(chroma) {
  const collectionName = 'content_dedup';
  const collectionDesc = 'Post content embeddings for duplication detection';
  
  try {
    // 尝试获取现有 Collection
    try {
      const existing = await chroma.getCollection({ name: collectionName });
      console.log(`⚠️  Collection "${collectionName}" 已存在，跳过创建`);
      return existing;
    } catch (error) {
      // Collection 不存在，继续创建
    }

    // 创建 Collection
    const collection = await chroma.createCollection({
      name: collectionName,
      metadata: {
        description: collectionDesc,
        dimension: 768, // 根据使用的 embedding 模型调整（如 BGE: 768/1024）
        distance_function: 'cosine',
      },
    });

    console.log(`✅ Collection "${collectionName}" 创建成功`);
    console.log(`   描述：${collectionDesc}`);
    console.log(`   距离函数：cosine`);
    console.log('');

    return collection;
  } catch (error) {
    console.error(`❌ 创建 Collection "${collectionName}" 失败`);
    console.error(`   错误信息：${error.message}`);
    console.error('');
    throw error;
  }
}

/**
 * 创建主题推荐 Collection
 * 用于主题相似度推荐
 */
async function createTopicRecommendCollection(chroma) {
  const collectionName = 'topic_recommend';
  const collectionDesc = 'Topic embeddings for recommendation system';
  
  try {
    // 尝试获取现有 Collection
    try {
      const existing = await chroma.getCollection({ name: collectionName });
      console.log(`⚠️  Collection "${collectionName}" 已存在，跳过创建`);
      return existing;
    } catch (error) {
      // Collection 不存在，继续创建
    }

    // 创建 Collection
    const collection = await chroma.createCollection({
      name: collectionName,
      metadata: {
        description: collectionDesc,
        dimension: 768,
        distance_function: 'cosine',
      },
    });

    console.log(`✅ Collection "${collectionName}" 创建成功`);
    console.log(`   描述：${collectionDesc}`);
    console.log(`   距离函数：cosine`);
    console.log('');

    return collection;
  } catch (error) {
    console.error(`❌ 创建 Collection "${collectionName}" 失败`);
    console.error(`   错误信息：${error.message}`);
    console.error('');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  let exitCode = 0;

  try {
    // 1. 初始化客户端
    const chroma = await initChromaClient();

    // 2. 创建 Collections
    console.log('📦 开始创建 Collections...');
    console.log('');

    await createMaterialsCollection(chroma);
    await createContentDedupCollection(chroma);
    await createTopicRecommendCollection(chroma);

    // 3. 验证创建结果
    console.log('🔍 验证 Collections 创建结果...');
    console.log('');

    const collections = await chroma.listCollections();
    console.log(`✅ 所有 Collections 创建完成`);
    console.log(`   总数量：${collections.length}`);
    console.log(`   Collection 列表:`);
    for (const collection of collections) {
      console.log(`     - ${collection.name}`);
    }
    console.log('');

    console.log('🎉 ChromaDB 初始化完成！');
    console.log('');
    console.log('下一步：');
    console.log('  1. 运行素材迁移脚本：node scripts/migrate-materials-to-chromadb.js');
    console.log('  2. 运行内容去重迁移脚本：node scripts/migrate-content-dedup.js');
    console.log('  3. 更新应用配置，启用 ChromaDB');
    console.log('');
  } catch (error) {
    console.error('💥 ChromaDB 初始化失败');
    console.error(`   错误：${error.message}`);
    console.error('');
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

// 执行主函数
main();
