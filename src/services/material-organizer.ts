/**
 * 素材整理调度器
 * 
 * 功能：
 * 1. 执行完整的素材整理 Pipeline
 * 2. 并发控制
 * 3. 统计和报告
 */

import { getLogger } from '../utils/logger';
import { scanMaterials } from './material-scanner';
import { batchProcessMaterials } from './material-processor';
import { MaterialOrganizeStats } from '../types/materials';

const logger = getLogger('material-organizer');

/**
 * 执行素材整理
 */
export async function organizeMaterials(): Promise<MaterialOrganizeStats> {
  const startTime = Date.now();
  logger.info('=== 开始执行素材整理 ===');
  
  const stats: MaterialOrganizeStats = {
    scanned: 0,
    added: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
  };
  
  try {
    // 1. 扫描素材目录
    logger.info('步骤 1: 扫描素材目录...');
    const scanResult = await scanMaterials();
    stats.scanned = scanResult.totalScanned;
    stats.skipped = scanResult.skippedCount;
    
    if (scanResult.newMaterials.length === 0) {
      logger.info('没有新素材，整理完成');
      stats.durationMs = Date.now() - startTime;
      return stats;
    }
    
    logger.info(`发现 ${scanResult.newMaterials.length} 个新素材`);
    
    // 2. 批量处理素材
    logger.info('步骤 2: 处理新素材...');
    const processResult = await batchProcessMaterials(scanResult.newMaterials);
    
    stats.added = processResult.successCount;
    stats.failed = processResult.failedCount;
    
    // 3. 生成报告
    stats.durationMs = Date.now() - startTime;
    
    logger.info('=== 素材整理完成 ===');
    logger.info(`统计：扫描${stats.scanned}个，新增${stats.added}个，跳过${stats.skipped}个，失败${stats.failed}个`);
    logger.info(`总耗时：${(stats.durationMs / 1000).toFixed(1)}秒`);
    
    return stats;
  } catch (error) {
    logger.error(`素材整理失败：${error instanceof Error ? error.message : String(error)}`);
    stats.durationMs = Date.now() - startTime;
    throw error;
  }
}

/**
 * 手动触发素材整理（供 API 调用）
 */
export async function manualOrganizeMaterials(): Promise<MaterialOrganizeStats> {
  logger.info('手动触发素材整理请求');
  return organizeMaterials();
}
