/**
 * 主题推荐功能测试
 * 
 * 测试场景：
 * 1. 添加主题向量到 ChromaDB
 * 2. 相似主题推荐
 * 3. 主题多样性分析
 * 
 * 运行命令：
 * npx ts-node scripts/test-topic-recommendation.ts
 */

import { topicRecommendStorage } from '../src/storage/chroma/topic-recommend-storage';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('test-topic-recommendation');

async function testTopicRecommendation() {
  console.log('='.repeat(60));
  console.log('主题推荐功能测试');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. 初始化存储
    console.log('1️⃣  初始化主题推荐存储...');
    await topicRecommendStorage.initialize();
    console.log('✅ 初始化成功\n');

    // 2. 添加测试主题
    console.log('2️⃣  添加测试主题向量...');
    const testTopics = [
      {
        id: 'topic_001',
        name: '奥迪 Q5L 试驾体验',
        direction: 'SUV',
        outline: '分享奥迪 Q5L 的试驾感受，包括动力、操控、内饰等',
        tags: ['SUV', '试驾', 'Q5L'],
      },
      {
        id: 'topic_002',
        name: '奥迪 A4L 保养心得',
        direction: '轿车',
        outline: '分享奥迪 A4L 的保养经验和费用',
        tags: ['轿车', '保养', 'A4L'],
      },
      {
        id: 'topic_003',
        name: '电动车充电攻略',
        direction: '新能源',
        outline: '电动车充电站点推荐和充电技巧',
        tags: ['新能源', '充电', '攻略'],
      },
      {
        id: 'topic_004',
        name: '奥迪 e-tron 续航测试',
        direction: '新能源',
        outline: '奥迪 e-tron 真实续航能力测试',
        tags: ['新能源', 'e-tron', '续航'],
      },
      {
        id: 'topic_005',
        name: '周末自驾游路线推荐',
        direction: '旅行',
        outline: '分享适合奥迪 SUV 的自驾游路线',
        tags: ['旅行', 'SUV', '自驾'],
      },
    ];

    for (const topic of testTopics) {
      const topicText = `${topic.name} ${topic.direction} ${topic.outline} ${topic.tags.join(' ')}`;
      const embedding = await embeddingVectorizer.generateEmbedding(topicText);
      const metadata = {
        topic_name: topic.name,
        topic_direction: topic.direction,
        topic_outline: topic.outline,
        tags: topic.tags.join(','),
        created_at: Date.now(),
      };
      await topicRecommendStorage.addTopicVector(topic.id, embedding, metadata);
      console.log(`   ✅ 添加主题：${topic.name} (${topic.direction})`);
    }
    console.log();

    // 3. 相似主题推荐
    console.log('3️⃣  相似主题推荐...');
    const queryTopic = {
      name: '奥迪 Q7 驾驶感受',
      direction: 'SUV',
      outline: '分享奥迪 Q7 的驾驶体验和感受',
    };
    const queryText = `${queryTopic.name} ${queryTopic.direction} ${queryTopic.outline}`;
    const queryEmbedding = await embeddingVectorizer.generateEmbedding(queryText);
    
    const recommendations = await topicRecommendStorage.recommendTopics(
      queryEmbedding,
      3,
      0.6
    );

    console.log(`   🔍 查询主题："${queryTopic.name}"`);
    console.log(`   📊 推荐 ${recommendations.length} 个相似主题：`);
    for (const rec of recommendations) {
      console.log(
        `      - ${rec.metadata.topic_name} (${rec.metadata.topic_direction}) ` +
        `(相似度：${(rec.similarity * 100).toFixed(1)}%)`
      );
    }
    console.log();

    // 4. 不同方向的推荐
    console.log('4️⃣  不同方向的推荐...');
    const新能源 Query = '新能源汽车购买建议';
    const新能源 Embedding = await embeddingVectorizer.generateEmbedding(新能源 Query);
    
    const新能源 Recommendations = await topicRecommendStorage.recommendTopics(
      新能源 Embedding,
      3,
      0.5
    );

    console.log(`   🔍 查询："${新能源 Query}"`);
    console.log(`   📊 推荐 ${新能源 Recommendations.length} 个主题：`);
    for (const rec of 新能源 Recommendations) {
      console.log(
        `      - ${rec.metadata.topic_name} (${rec.metadata.topic_direction}) ` +
        `(相似度：${(rec.similarity * 100).toFixed(1)}%)`
      );
    }
    console.log();

    // 5. 统计信息
    console.log('5️⃣  统计信息...');
    const count = await topicRecommendStorage.count();
    console.log(`   📊 向量总数：${count}`);
    const info = await topicRecommendStorage.getCollectionInfo();
    console.log(`   📊 Collection: ${info?.name || 'N/A'}`);
    console.log();

    console.log('✅ 测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testTopicRecommendation();
