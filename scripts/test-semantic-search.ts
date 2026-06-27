/**
 * 历史发帖语义检索功能测试
 * 
 * 测试场景：
 * 1. 使用 post-history-storage 中的 searchPostsBySemantic 方法
 * 2. 语义搜索历史发帖
 * 3. 对比关键词搜索和语义搜索的差异
 * 
 * 运行命令：
 * npx ts-node scripts/test-semantic-search.ts
 */

import { getPostHistoryStorage } from '../src/storage/mysql/post-history-storage';
import { contentDedupStorage } from '../src/storage/chroma/content-dedup-storage';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('test-semantic-search');

async function testSemanticSearch() {
  console.log('='.repeat(60));
  console.log('历史发帖语义检索功能测试');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. 初始化存储
    console.log('1️⃣  初始化存储...');
    await contentDedupStorage.initialize();
    const postStorage = getPostHistoryStorage();
    console.log('✅ 初始化成功\n');

    // 2. 语义搜索测试
    console.log('2️⃣  语义搜索测试...');
    const searchQueries = [
      '奥迪 SUV 试驾体验',
      '新能源汽车充电',
      '车辆保养经验',
    ];

    for (const query of searchQueries) {
      console.log(`\n   🔍 查询："${query}"`);
      
      try {
        // 使用语义搜索
        const results = await postStorage.searchPostsBySemantic(query, 5, 0.6);
        
        if (results.length > 0) {
          console.log(`   📊 找到 ${results.length} 条相关发帖：`);
          for (const result of results) {
            const post = result.post;
            console.log(
              `      - [${post.title}] ` +
              `(相似度：${(result.similarity * 100).toFixed(1)}%)`
            );
          }
        } else {
          console.log('   📭 未找到相关发帖');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`   ⚠️  搜索失败：${errorMsg}`);
      }
    }
    console.log();

    // 3. 直接向量搜索测试
    console.log('3️⃣  直接向量搜索测试...');
    const query = '奥迪驾驶体验';
    const queryEmbedding = await embeddingVectorizer.generateEmbedding(query);
    
    const results = await contentDedupStorage.searchSimilar(queryEmbedding, 5);
    
    console.log(`   🔍 查询："${query}"`);
    if (results.length > 0) {
      console.log(`   📊 找到 ${results.length} 条相关内容：`);
      for (const result of results) {
        console.log(
          `      - ${result.id} (相似度：${(result.similarity * 100).toFixed(1)}%)`
        );
      }
    } else {
      console.log('   📭 未找到相关内容');
    }
    console.log();

    // 4. 统计信息
    console.log('4️⃣  统计信息...');
    const count = await contentDedupStorage.count();
    console.log(`   📊 内容去重向量总数：${count}`);
    const info = await contentDedupStorage.getCollectionInfo();
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
testSemanticSearch();
