/**
 * 向量同步工具
 * 
 * 功能：
 * 1. 批量同步历史素材到 ChromaDB
 * 2. 构建向量文本
 * 3. 批量向量化
 * 4. 进度跟踪
 */

import * as path from 'path';
import { getLogger } from '../utils/logger';
import { getMaterialRecordStorage, MaterialRecord } from '../storage/mysql/material-record-storage';
import { materialVectorStorage } from '../storage/chroma/material-vector-storage';
import { embeddingVectorizer } from '../utils/embedding-vectorizer';

const logger = getLogger('vector-sync');
const materialRecordStorage = getMaterialRecordStorage();

/**
 * 同步进度
 */
interface SyncProgress {
  /** 总素材数 */
  total: number;
  /** 已处理数 */
  processed: number;
  /** 成功数 */
  success: number;
  /** 失败数 */
  failed: number;
  /** 跳过数 */
  skipped: number;
  /** 当前批次 */
  currentBatch: number;
  /** 总批次 */
  totalBatches: number;
}

/**
 * 批量同步历史素材到 ChromaDB
 */
export async function syncHistoricalMaterials(options?: {
  /** 批次大小 */
  batchSize?: number;
  /** 强制重新生成（忽略现有向量） */
  force?: boolean;
}): Promise<SyncProgress> {
  const batchSize = options?.batchSize || 100;
  const force = options?.force || false;
  
  logger.info('=== 开始批量同步历史素材到 ChromaDB ===');
  logger.info(`批次大小：${batchSize}, 强制重新生成：${force}`);
  
  const progress: SyncProgress = {
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    currentBatch: 0,
    totalBatches: 0,
  };
  
  try {
    // 1. 初始化 ChromaDB
    logger.info('初始化 ChromaDB...');
    await materialVectorStorage.initialize();
    logger.info('ChromaDB 初始化成功');
    
    // 2. 获取所有素材记录
    logger.info('从 MySQL 加载素材记录...');
    const allRecords = await materialRecordStorage.getAllMaterialRecords();
    progress.total = allRecords.length;
    progress.totalBatches = Math.ceil(progress.total / batchSize);
    
    logger.info(`加载完成：共${progress.total}个素材，分${progress.totalBatches}批`);
    
    if (progress.total === 0) {
      logger.info('没有素材需要同步');
      return progress;
    }
    
    // 3. 分批处理
    for (let i = 0; i < allRecords.length; i += batchSize) {
      progress.currentBatch = Math.floor(i / batchSize) + 1;
      const batch = allRecords.slice(i, i + batchSize);
      
      logger.info(`处理批次 ${progress.currentBatch}/${progress.totalBatches} (${i + 1}-${Math.min(i + batchSize, progress.total)})`);
      
      // 4. 处理批次内的素材
      for (const record of batch) {
        try {
          await processSingleRecord(record, force);
          progress.success++;
        } catch (error) {
          logger.warn(`处理素材失败 ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
          progress.failed++;
        }
        progress.processed++;
      }
      
      // 批次间暂停
      if (i + batchSize < allRecords.length) {
        logger.info(`批次 ${progress.currentBatch} 完成，暂停 1 秒...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info('=== 批量同步完成 ===');
    logger.info(`统计：总计${progress.total}个，成功${progress.success}个，失败${progress.failed}个，跳过${progress.skipped}个`);
    
    return progress;
  } catch (error) {
    logger.error(`批量同步失败：${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 处理单个素材记录
 */
async function processSingleRecord(record: MaterialRecord, force: boolean): Promise<void> {
  // 检查是否已存在向量（非强制模式）
  if (!force) {
    const existingId = await materialVectorStorage.findByFilePath(record.processed_path);
    if (existingId) {
      logger.debug(`跳过已存在向量：${record.processed_path}`);
      return;
    }
  }
  
  // 构建向量文本
  const vectorText = buildVectorText(record);
  if (!vectorText.trim()) {
    logger.warn(`向量为空，跳过：${record.id}`);
    return;
  }
  
  // 生成向量
  const embedding = await embeddingVectorizer.generateEmbedding(vectorText);
  
  // 添加到 ChromaDB
  const vectorId = `material_${record.id}`;
  
  if (force) {
    // 强制模式：先删除再添加
    try {
      await materialVectorStorage.deleteVector(vectorId);
    } catch (error) {
      // 删除失败（可能不存在），继续
    }
  }
  
  await materialVectorStorage.addVector(
    vectorId,
    embedding,
    {
      file_path: record.processed_path,
      file_name: path.basename(record.processed_path),
      description: record.description || '',
      tags: record.tags ? record.tags.split(',').filter(t => t.trim()) : [],
    }
  );
  
  logger.debug(`添加向量：${vectorId}`);
}

/**
 * 构建向量��本
 */
function buildVectorText(record: MaterialRecord): string {
  const fileName = path.basename(record.processed_path);
  const parts = [
    fileName,
    record.description || '',
    record.tags || '',
    record.ocr_text || '',
  ];
  return parts.filter(p => p.trim()).join(' ');
}

/**
 * 为单个素材同步向量（用于新增素材）
 */
export async function syncSingleMaterial(record: MaterialRecord): Promise<boolean> {
  try {
    await materialVectorStorage.initialize();
    await processSingleRecord(record, false);
    return true;
  } catch (error) {
    logger.error(`同步单个素材失败 ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * 强制重新生成所有向量
 */
export async function rebuildAllVectors(): Promise<SyncProgress> {
  logger.info('=== 强制重新生成所有向量 ===');
  return syncHistoricalMaterials({ force: true, batchSize: 100 });
}
