/**
 * 一次性脚本：仅回填 materials 集合的真实向量（不触碰其它集合）
 *
 * 前提：prod_materials 集合已按新维度(1024)重建为空。
 *
 * 用法：
 *   EMBEDDING_URL=http://192.168.50.10:8100/v1/embeddings \
 *   CHROMADB_URL=http://192.168.50.10:8000 \
 *   NODE_ENV=production \
 *   npx ts-node --project tsconfig.json scripts/backfill-materials.ts
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { chromaConnectionManager } from '../src/utils/chroma-connection-manager';
import { materialIndexRebuildService } from '../src/services/material-index-rebuild-service';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';

async function main() {
  console.log('=== 初始化 MySQL ===');
  await MySQLConnectionManager.getInstance().initialize();
  console.log('MySQL 连接成功');

  console.log('=== 初始化 ChromaDB ===');
  await chromaConnectionManager.initialize();
  console.log('ChromaDB 连接成功');

  console.log('=== 回填 materials 真实向量（先清空再回填，保证幂等）===');
  const result = await materialIndexRebuildService.rebuildAllIndexes({ cleanExisting: true });
  console.log(`结果：${result.message}`);
  console.log(`进度：total=${result.progress.total}, success=${result.progress.success}, failed=${result.progress.failed}, 耗时=${result.duration}ms`);

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error(`脚本异常退出：${err.message}`);
  process.exit(1);
});
