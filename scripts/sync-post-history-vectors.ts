/**
 * 一次性脚本：将 post_history 中的历史记录同步到 ChromaDB content_dedup collection
 * 
 * 用法：CHROMADB_URL=http://192.168.50.10:8000 NODE_ENV=production npx ts-node --project tsconfig.json scripts/sync-post-history-vectors.ts
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { getPostHistoryStorage } from '../src/storage/mysql/post-history-storage';
import { contentDedupStorage } from '../src/storage/chroma/content-dedup-storage';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';
import { chromaConnectionManager } from '../src/utils/chroma-connection-manager';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';

async function main() {
  console.log('=== 开始同步 post_history 到 ChromaDB ===');

  // 0. 初始化 MySQL
  console.log('初始化 MySQL 连接...');
  try {
    await MySQLConnectionManager.getInstance().initialize();
    console.log('MySQL 连接成功');
  } catch (err: any) {
    console.error('MySQL 连接失败:', err.message);
    process.exit(1);
  }

  // 1. 初始化 ChromaDB 连接管理器
  console.log('初始化 ChromaDB 连接...');
  try {
    await chromaConnectionManager.initialize();
    console.log('ChromaDB 连接成功');
  } catch (err: any) {
    console.error('ChromaDB 连接失败:', err.message);
    process.exit(1);
  }

  // 2. 初始化 contentDedupStorage
  try {
    await contentDedupStorage.initialize();
    console.log('ChromaDB contentDedupStorage 初始化成功');
  } catch (err: any) {
    console.error('ChromaDB contentDedupStorage 初始化失败:', err.message);
    process.exit(1);
  }

  // 2. 读取所有 post_history
  console.log('从 post_history 读取记录...');
  const storage = getPostHistoryStorage();
  const { posts } = await storage.queryPosts({ limit: 1000 });
  console.log(`读取到 ${posts.length} 条记录`);

  if (posts.length === 0) {
    console.log('没有记录需要同步');
    process.exit(0);
  }

  // 3. 逐条生成 embedding 并写入 ChromaDB
  let success = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      const text = `${post.title} ${post.content || ''}`.trim();
      if (!text) {
        console.log(`跳过空内容：${post.id}`);
        failed++;
        continue;
      }

      const embedding = await embeddingVectorizer.generateEmbedding(text);

      await contentDedupStorage.addPostVector(post.id, embedding, {
        title: post.title,
        topic: post.topic || undefined,
        created_at: new Date(post.published_at).getTime(),
      });

      success++;
      console.log(`[${success + failed}/${posts.length}] ✓ ${post.title}`);

      // 避免 API 限流，每条间隔 300ms
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      failed++;
      console.error(`[${success + failed}/${posts.length}] ✗ ${post.title}: ${error.message}`);
    }
  }

  console.log('=== 同步完成 ===');
  console.log(`总计：${posts.length}，成功：${success}，失败：${failed}`);
  process.exit(0);
}

main().catch(err => {
  console.error(`脚本异常退出：${err.message}`);
  process.exit(1);
});
