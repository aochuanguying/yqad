/**
 * 敏感词变体识别功能测试
 * 
 * 测试场景：
 * 1. 添加敏感词向量到 ChromaDB
 * 2. 检测敏感词变体（同义词、规避词）
 * 3. 批量检测
 * 
 * 运行命令：
 * npx ts-node scripts/test-sensitive-variants.ts
 */

import { sensitiveVariantStorage, SensitiveWordVectorMetadata } from '../src/storage/chroma/sensitive-variant-storage';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('test-sensitive-variants');

async function testSensitiveVariants() {
  console.log('='.repeat(60));
  console.log('敏感词变体识别功能测试');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. 初始化存储
    console.log('1️⃣  初始化敏感词变体存储...');
    await sensitiveVariantStorage.initialize();
    console.log('✅ 初始化成功\n');

    // 2. 添加测试敏感词
    console.log('2️⃣  添加测试敏感词向量...');
    const testWords = [
      { id: 'test_001', text: '加微信', category: '导流', severity: 5, replacement: '加微' },
      { id: 'test_002', text: '淘宝', category: '广告', severity: 3, replacement: '某宝' },
      { id: 'test_003', text: '支付宝', category: '广告', severity: 3, replacement: '某付宝' },
      { id: 'test_004', text: '刷单', category: '诈骗', severity: 5, replacement: '' },
      { id: 'test_005', text: '投资', category: '理财', severity: 4, replacement: '理财' },
    ];

    for (const word of testWords) {
      const embedding = await embeddingVectorizer.generateEmbedding(word.text);
      const metadata: SensitiveWordVectorMetadata = {
        word_text: word.text,
        category: word.category,
        severity: word.severity,
        replacement: word.replacement,
        created_at: Date.now(),
      };
      await sensitiveVariantStorage.addSensitiveWordVector(word.id, embedding, metadata);
      console.log(`   ✅ 添加敏感词：${word.text} (${word.category})`);
    }
    console.log();

    // 3. 检测变体
    console.log('3️⃣  检测敏感词变体...');
    const testCases = [
      { text: '加薇信', expected: '加微信' },
      { text: '某宝购物', expected: '淘宝' },
      { text: '用支付寶', expected: '支付宝' },
      { text: '兼职刷单', expected: '刷单' },
      { text: '稳健投资', expected: '投资' },
    ];

    for (const testCase of testCases) {
      const embedding = await embeddingVectorizer.generateEmbedding(testCase.text);
      const result = await sensitiveVariantStorage.detectVariant(
        testCase.text,
        embedding,
        3,
        0.75  // 降低阈值以检测变体
      );

      if (result.isVariant) {
        console.log(
          `   ✅ "${testCase.text}" -> "${result.matchedWord}" ` +
          `(相似度：${(result.maxSimilarity * 100).toFixed(1)}%, 分类：${result.category})`
        );
      } else {
        console.log(`   ⚠️  "${testCase.text}" 未检测到变体`);
      }
    }
    console.log();

    // 4. 批量检测
    console.log('4️⃣  批量检测...');
    const texts = ['加微信聊', '淘宝买东西', '正常聊天'];
    const embeddings = await embeddingVectorizer.batchGenerateEmbeddings(texts, 10);
    const batchResults = await sensitiveVariantStorage.batchDetectVariants(texts, embeddings, 0.75);

    for (const result of batchResults) {
      if (result.result.isVariant) {
        console.log(
          `   ✅ "${result.text}" -> "${result.result.matchedWord}" ` +
          `(相似度：${(result.result.maxSimilarity * 100).toFixed(1)}%)`
        );
      } else {
        console.log(`   ✅ "${result.text}" 无敏感变体`);
      }
    }
    console.log();

    // 5. 统计信息
    console.log('5️⃣  统计信息...');
    const count = await sensitiveVariantStorage.count();
    console.log(`   📊 向量总数：${count}`);
    const info = await sensitiveVariantStorage.getCollectionInfo();
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
testSensitiveVariants();
