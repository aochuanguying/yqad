/**
 * 一次性脚本：ChromaDB 全量重建（维度 1536 -> 1024，bge-m3）
 *
 * 步骤：
 * 1. 删除 5 个 prod_* 集合（旧数据均为无效零向量）
 * 2. 按新维度（1024）重建空集合
 * 3. 从 MySQL 回填 content_dedup（post_history）与 materials（material_record）真实向量
 *
 * 幂等：可重复运行；每次都会先删后建再回填。
 *
 * 用法：
 *   EMBEDDING_URL=http://192.168.50.10:8100/v1/embeddings \
 *   CHROMADB_URL=http://192.168.50.10:8000 \
 *   NODE_ENV=production \
 *   npx ts-node --project tsconfig.json scripts/rebuild-chroma-vectors.ts
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { chromaConnectionManager, getChromaClient } from '../src/utils/chroma-connection-manager';
import { contentDedupStorage } from '../src/storage/chroma/content-dedup-storage';
import { getPostHistoryStorage } from '../src/storage/mysql/post-history-storage';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';
import { materialIndexRebuildService } from '../src/services/material-index-rebuild-service';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';

const PREFIX = (process.env.NODE_ENV === 'production') ? 'prod_' : 'dev_';
const COLLECTIONS = [
  'materials',
  'content_dedup',
  'topic_recommend',
  'sensitive_variants',
  'comment_sentiment',
].map(n => `${PREFIX}${n}`);

async function step(label: string, fn: () => Promise<void>) {
  console.log(`\n=== ${label} ===`);
  await fn();
}

async function main() {
  await step('初始化 MySQL 连接', async () => {
    await MySQLConnectionManager.getInstance().initialize();
    console.log('MySQL 连接成功');
  });

  await step('初始化 ChromaDB 连接', async () => {
    await chromaConnectionManager.initialize();
    console.log('ChromaDB 连接成功');
  });

  await step('删除旧集合（旧维度 1536 零向量数据）', async () => {
    const client = getChromaClient();
    for (const name of COLLECTIONS) {
      try {
        await client.deleteCollection({ name });
        console.log(`  ✓ 已删除 ${name}`);
      } catch (e: any) {
        console.log(`  - 跳过 ${name}（可能不存在）：${e.message}`);
      }
    }
  });

  await step('按新维度（1024）重建空集合', async () => {
    // reset 后重新 initialize，会自动创建缺失的集合
    await chromaConnectionManager.reset();
    await chromaConnectionManager.initialize();
    console.log('空集合重建完成');
  });

  await step('回填 content_dedup（post_history 真实向量）', async () => {
    await contentDedupStorage.initialize();
    const { posts } = await getPostHistoryStorage().queryPosts({ limit: 1000 });
    console.log(`读取到 ${posts.length} 条发帖历史`);
    let success = 0, failed = 0;
    for (const post of posts) {
      try {
        const text = `${post.title} ${post.content || ''}`.trim();
        if (!text) { failed++; continue; }
        const embedding = await embeddingVectorizer.generateEmbedding(text);
        await contentDedupStorage.addPostVector(post.id, embedding, {
          title: post.title,
          topic: post.topic || undefined,
          created_at: new Date(post.published_at).getTime(),
        });
        success++;
        console.log(`  [${success + failed}/${posts.length}] ✓ ${post.title}`);
      } catch (error: any) {
        failed++;
        console.error(`  [${success + failed}/${posts.length}] ✗ ${post.title}: ${error.message}`);
      }
    }
    console.log(`content_dedup 回填完成：成功 ${success}，失败 ${failed}`);
  });

  if (process.argv.includes('--with-materials')) {
    await step('回填 materials（material_record 真实向量，耗时较长）', async () => {
      const result = await materialIndexRebuildService.rebuildAllIndexes({ cleanExisting: false });
      console.log(`materials 回填：${result.message}`);
    });
  } else {
    console.log('\n=== 跳过 materials 回填（未指定 --with-materials）===');
    console.log('materials 集合已重建为空，可稍后单独运行：');
    console.log('  ... scripts/rebuild-chroma-vectors.ts --with-materials');
  }

  console.log('\n=== 全量重建完成 ===');
  process.exit(0);
}

main().catch(err => {
  console.error(`脚本异常退出：${err.message}`);
  process.exit(1);
});
