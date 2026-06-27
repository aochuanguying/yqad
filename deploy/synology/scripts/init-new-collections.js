/**
 * 初始化新增的 ChromaDB Collections
 * 
 * 功能：
 * 1. 初始化 sensitive_variants Collection（敏感词变体）
 * 2. 初始化 comment_sentiment Collection（评论情感）
 * 3. 支持批量导入敏感词
 */

const { ChromaClient } = require('chromadb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 配置
const CHROMADB_URL = process.env.CHROMADB_URL || 'http://10.6.0.5:8000';
const ENV_PREFIX = (process.env.NODE_ENV === 'production' ? 'prod:' : 'dev:');

// 敏感词示例数据（实际应该从数据库或配置文件读取）
const DEFAULT_SENSITIVE_WORDS = [
  { id: '1', word: '微信', category: '竞品', severity: 3, replacement: 'VX' },
  { id: '2', word: '支付宝', category: '竞品', severity: 3, replacement: 'ZFB' },
  { id: '3', word: '淘宝', category: '竞品', severity: 3, replacement: 'TB' },
  { id: '4', word: '百度', category: '竞品', severity: 3, replacement: 'BD' },
  { id: '5', word: '加微信', category: '引流', severity: 5, replacement: '加 V' },
  { id: '6', word: '私信我', category: '引流', severity: 4, replacement: '联系我' },
  { id: '7', word: '赚钱', category: '营销', severity: 3, replacement: '米' },
  { id: '8', word: '刷单', category: '违规', severity: 5, replacement: 'SD' },
  { id: '9', word: '兼职', category: '营销', severity: 3, replacement: 'JZ' },
  { id: '10', word: '投资', category: '金融', severity: 4, replacement: 'TZ' },
];

async function getOpenAIEmbedding(text) {
  // 这里简化处理，实际应该调用 OpenAI API
  // 为了演示，返回一个随机向量
  const dimension = 1536;
  const embedding = [];
  for (let i = 0; i < dimension; i++) {
    embedding.push(Math.random() * 2 - 1);
  }
  // 归一化
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function initCollections() {
  console.log(`正在连接 ChromaDB: ${CHROMADB_URL}`);
  
  const client = new ChromaClient({
    path: CHROMADB_URL,
  });

  try {
    // 测试连接
    const collections = await client.listCollections();
    console.log(`✅ ChromaDB 连接成功，现有 ${collections.length} 个 Collections`);
    console.log('现有 Collections:', collections.map(c => c.name).join(', '));
    
    // 1. 创建 sensitive_variants Collection
    const sensitiveCollectionName = `${ENV_PREFIX}sensitive_variants`;
    console.log(`\n正在创建 Collection: ${sensitiveCollectionName}`);
    
    try {
      const sensitiveCollection = await client.createCollection({
        name: sensitiveCollectionName,
        metadata: {
          description: 'Sensitive word variants for semantic detection',
          dimension: 1536,
          distance_function: 'cosine',
        },
      });
      console.log(`✅ Collection "${sensitiveCollectionName}" 创建成功`);
      
      // 导入敏感词向量
      console.log('\n正在导入敏感词向量...');
      const ids = [];
      const embeddings = [];
      const metadatas = [];
      
      for (const wordData of DEFAULT_SENSITIVE_WORDS) {
        const embedding = await getOpenAIEmbedding(wordData.word);
        
        ids.push(`sensitive_${wordData.id}`);
        embeddings.push(embedding);
        metadatas.push({
          word_text: wordData.word,
          category: wordData.category,
          severity: wordData.severity,
          replacement: wordData.replacement,
          created_at: Date.now(),
        });
      }
      
      await sensitiveCollection.add({
        ids,
        embeddings,
        metadatas,
      });
      
      console.log(`✅ 成功导入 ${ids.length} 个敏感词向量`);
      
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log(`⚠️  Collection "${sensitiveCollectionName}" 已存在，跳过创建`);
      } else {
        throw error;
      }
    }
    
    // 2. 创建 comment_sentiment Collection
    const commentCollectionName = `${ENV_PREFIX}comment_sentiment`;
    console.log(`\n正在创建 Collection: ${commentCollectionName}`);
    
    try {
      const commentCollection = await client.createCollection({
        name: commentCollectionName,
        metadata: {
          description: 'Comment sentiment analysis and clustering',
          dimension: 1536,
          distance_function: 'cosine',
        },
      });
      console.log(`✅ Collection "${commentCollectionName}" 创建成功`);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log(`⚠️  Collection "${commentCollectionName}" 已存在，跳过创建`);
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ 所有 Collections 初始化完成！');
    console.log('\n新增 Collections:');
    console.log(`  - ${sensitiveCollectionName} (敏感词变体)`);
    console.log(`  - ${commentCollectionName} (评论情感)`);
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

// 执行初始化
initCollections();
