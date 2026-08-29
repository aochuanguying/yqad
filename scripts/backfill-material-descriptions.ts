/**
 * 一次性工具：为存量素材重新调 Vision 生成描述并回填，重新向量化
 *
 * 注意：素材文件在生产服务器容器 /app/data 下，本脚本需能访问到素材文件路径。
 * 若在本地运行，路径不一致会全部跳过；建议临时放入 src/tools 编译后在容器内运行：
 *   docker exec yqad node dist/tools/backfill-material-descriptions.js
 *
 * 环境变量：
 *   BACKFILL_LIMIT   限制处理条数（用于小批量验证，默认全部）
 *   BACKFILL_DELAY   每条之间的间隔毫秒（默认 1000）
 *
 * 特性：串行处理、单条失败重试 2 次、只处理缺少有效描述的记录、幂等可重跑。
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import * as fs from 'fs';
import * as path from 'path';
import { chromaConnectionManager } from '../src/utils/chroma-connection-manager';
import { materialVectorStorage } from '../src/storage/chroma/material-vector-storage';
import { getMaterialRecordStorage, MaterialRecord } from '../src/storage/mysql/material-record-storage';
import { prepareImageForVision, generateDescription, generateTags } from '../src/services/material-processor';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { aiProviderStorage } from '../src/storage/mysql/ai-provider-storage';
import { loadAIProvidersFromDB } from '../src/utils/config';
import { initFallbackChain } from '../src/ai/client';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 判断记录是否已有有效描述（非空且不等于文件名） */
function hasValidDescription(record: MaterialRecord): boolean {
  const desc = (record.description || '').trim();
  if (!desc) return false;
  const fileNameNoExt = path.basename(record.path, path.extname(record.path));
  return desc !== fileNameNoExt;
}

async function main() {
  const limit = process.env.BACKFILL_LIMIT ? parseInt(process.env.BACKFILL_LIMIT, 10) : Infinity;
  const delayMs = process.env.BACKFILL_DELAY ? parseInt(process.env.BACKFILL_DELAY, 10) : 1000;

  console.log('=== 初始化 MySQL / AI ===');
  await MySQLConnectionManager.getInstance().initialize();
  await loadAIProvidersFromDB();
  initFallbackChain(); // 启用兜底重试，避免偶发 502 直接降级
  console.log('MySQL / AI Provider / FallbackChain 就绪');

  console.log('=== 初始化 ChromaDB ===');
  await chromaConnectionManager.initialize();
  await materialVectorStorage.initialize();
  console.log('ChromaDB 就绪');

  const hasVision = (await aiProviderStorage.getEnabledProviders()).some(p => p.supportsVision === true);
  console.log(`Vision provider 可用：${hasVision}`);

  const storage = getMaterialRecordStorage();
  const all = await storage.getAllMaterialRecords();
  // 只处理缺少有效描述的记录
  const pending = all.filter(r => !hasValidDescription(r)).slice(0, limit);
  console.log(`总素材 ${all.length} 条，待回填 ${pending.length} 条（limit=${limit === Infinity ? '全部' : limit}, delay=${delayMs}ms）`);

  const minimalMeta: any = { width: 0, height: 0, format: 'jpeg', fileSize: 0 };
  let ok = 0, skip = 0, fail = 0;

  for (const record of pending) {
    const idx = ok + skip + fail + 1;
    if (!fs.existsSync(record.path)) {
      console.warn(`[${idx}/${pending.length}] 跳过（文件不存在）：${record.path}`);
      skip++;
      continue;
    }

    let lastErr: any = null;
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const imageBase64 = hasVision ? await prepareImageForVision(record.path) : null;
        const description = await generateDescription(record.path, minimalMeta, imageBase64);
        const tags = await generateTags(record.path, minimalMeta, imageBase64);

        // 校验描述有效（Vision 成功而非降级到文件名）
        const fileNameNoExt = path.basename(record.path, path.extname(record.path));
        if (!description || description.trim() === fileNameNoExt) {
          throw new Error('生成描述无效（疑似降级到文件名）');
        }

        await storage.upsertMaterialRecord({
          id: record.id,
          source: record.source,
          path: record.path,
          url: record.url,
          description,
          matchedKeywords: tags,
          usageCount: record.usage_count,
        });

        ok++;
        done = true;
        console.log(`[${idx}/${pending.length}] OK ${path.basename(record.path)} -> ${description.slice(0, 50)}`);
      } catch (error: any) {
        lastErr = error;
        if (attempt < 3) {
          console.warn(`[${idx}/${pending.length}] 第 ${attempt} 次失败：${error.message}，重试...`);
          await sleep(3000 * attempt);
        }
      }
    }

    if (!done) {
      fail++;
      console.error(`[${idx}/${pending.length}] FAIL ${record.path}: ${lastErr?.message}`);
    }

    await sleep(delayMs);
  }

  console.log(`\n=== 回填完成：成功 ${ok}，跳过 ${skip}，失败 ${fail} ===`);
  process.exit(0);
}

main().catch(err => {
  console.error(`脚本异常退出：${err.message}`);
  process.exit(1);
});
